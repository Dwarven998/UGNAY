package com.ugnay.ugnay.analytics;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Supplier;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.fasterxml.jackson.databind.JsonNode;
import com.ugnay.ugnay.analytics.AnalyticsDtos.Comment;
import com.ugnay.ugnay.analytics.AnalyticsDtos.ContentItem;
import com.ugnay.ugnay.analytics.AnalyticsDtos.DayPoint;
import com.ugnay.ugnay.analytics.AnalyticsDtos.Dashboard;
import com.ugnay.ugnay.analytics.AnalyticsDtos.FormatStat;
import com.ugnay.ugnay.analytics.AnalyticsDtos.Kpis;
import com.ugnay.ugnay.analytics.AnalyticsDtos.Overview;
import com.ugnay.ugnay.analytics.AnalyticsDtos.PostDetail;
import com.ugnay.ugnay.analytics.AnalyticsDtos.SeriesPoint;
import com.ugnay.ugnay.analytics.AnalyticsDtos.Trend;
import com.ugnay.ugnay.core.User;
import com.ugnay.ugnay.facebook.FacebookInsightsClient;
import com.ugnay.ugnay.facebook.FacebookInsightsClient.GraphException;
import com.ugnay.ugnay.org.Organization;
import com.ugnay.ugnay.org.OrganizationPermissionService;
import com.ugnay.ugnay.org.OrganizationRepository;
import com.ugnay.ugnay.post.EngagementSyncService;
import com.ugnay.ugnay.post.Post;
import com.ugnay.ugnay.post.PostRepository;
import com.ugnay.ugnay.post.PostTotals;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Builds the Facebook-style Analytics dashboard and per-post insights.
 *
 * Isolation: every request first resolves a {@link Scope} — either an organization the caller is an
 * approved member of, or the caller's own personal Page — and only ever talks to Facebook with THAT
 * scope's Page token, filtered to THAT Page's id. Cache keys include the scope, so one organization's
 * numbers can never be served to another.
 *
 * Consistency: the headline numbers, charts, top content and format breakdown of one response are all
 * derived from the same Graph snapshot, and the stored engagement rows are updated from it, so no two
 * parts of the panel can disagree.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AnalyticsDashboardService {

    private static final Duration CACHE_TTL = Duration.ofSeconds(3);
    private static final DateTimeFormatter GRAPH_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ssZ");
    private static final int MAX_POST_PAGES = 4;
    private static final Duration POST_PAGING_BUDGET = Duration.ofMillis(3500);
    private static final int MAX_COMMENT_PAGES = 10;
    private static final int TYPICAL_WINDOW_DAYS = 28;

    private static final String POST_BASE_FIELDS =
        "id,message,story,created_time,permalink_url,full_picture,attachments{media_type,type},"
            + "reactions.summary(true).limit(0),comments.filter(stream).summary(true).limit(0),shares";
    private static final String COMMENT_CORE =
        "id,message,created_time,from{id,name,picture{url}},like_count,comment_count,permalink_url,"
            + "attachment{media{image{src}}}";

    /** Insight metric sets tried in order; Facebook renamed its reach/impression metrics to "media views". */
    private static final List<String[]> POST_METRIC_SETS = List.of(
        new String[] {"post_media_view", "post_total_media_view_unique"},
        new String[] {"post_impressions", "post_impressions_unique"},
        new String[0]);

    private final PostRepository postRepository;
    private final OrganizationRepository organizationRepository;
    private final OrganizationPermissionService permissionService;
    private final EngagementSyncService engagementSyncService;
    private final FacebookInsightsClient graph;
    private final PostViewSnapshotStore snapshots;

    private final TtlCache<Live> liveCache = new TtlCache<>(CACHE_TTL);
    private final TtlCache<PostDetail> detailCache = new TtlCache<>(CACHE_TTL);
    private final TtlCache<Scope> scopeCache = new TtlCache<>(Duration.ofSeconds(15));
    /** The "typical post" baseline only needs to be roughly current, so post pages reuse it for a minute. */
    private final TtlCache<Live> baselineCache = new TtlCache<>(Duration.ofSeconds(60));
    private final ExecutorService graphPool = Executors.newFixedThreadPool(8, runnable -> {
        Thread thread = new Thread(runnable, "analytics-graph");
        thread.setDaemon(true);
        return thread;
    });

    /** Database writes triggered by a read happen here, off the request path. */
    private final ExecutorService persistPool = Executors.newSingleThreadExecutor(runnable -> {
        Thread thread = new Thread(runnable, "analytics-persist");
        thread.setDaemon(true);
        return thread;
    });
    private final java.util.Set<String> persisting = java.util.concurrent.ConcurrentHashMap.newKeySet();

    // ───────────────────────── scope ─────────────────────────

    private record Scope(String key, UUID orgId, User user, String pageId, String token) {
        boolean connected() {
            return pageId != null && !pageId.isBlank() && token != null && !token.isBlank();
        }
    }

    /**
     * Membership and Page-token lookups cost several database round trips, so they are reused for a few
     * seconds per (user, organization). A revoked membership therefore stops working within this window.
     */
    private Scope resolveScope(User user, UUID orgId) {
        return scopeCache.get(user.getId() + "|" + orgId, () -> loadScope(user, orgId));
    }

    private Scope loadScope(User user, UUID orgId) {
        if (orgId != null) {
            permissionService.requireApprovedMember(user.getId(), orgId);
            Organization org = organizationRepository.findById(orgId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organization not found"));
            return new Scope("org:" + orgId, orgId, user, org.getFbPageId(), org.getFbAccessToken());
        }
        return new Scope("user:" + user.getId(), null, user, user.getFbPageId(), user.getFbAccessToken());
    }

    private List<Post> scopedPosts(Scope scope) {
        return scope.orgId() != null
            ? postRepository.findByOrganization_IdOrderByCreatedAtDesc(scope.orgId())
            : postRepository.findByUserAndOrganizationIsNullOrderByCreatedAtDesc(scope.user());
    }

    // ───────────────────────── live Graph snapshot ─────────────────────────

    private record LivePost(String id, String message, Instant created, String permalink, String image,
                            String format, Long views, Long viewers, long reactions, long comments, long shares) {
        long interactions() {
            return reactions + comments + shares;
        }
    }

    private record DailySeries(Map<LocalDate, Long> values, String error) {
        static DailySeries failed(String error) {
            return new DailySeries(null, error);
        }
        boolean ok() {
            return values != null;
        }
    }

    private record Live(int days, List<LivePost> posts, String postsError, DailySeries views,
                        DailySeries threeSecond, DailySeries watchTime, Long viewers, Kpis kpis, long fetchedAt) {}

    private Live loadLive(Scope scope, int days) {
        return liveCache.get(scope.key() + "|" + days, () -> fetchLive(scope, days));
    }

    private Live fetchLive(Scope scope, int days) {
        long startedAt = System.nanoTime();
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        long sinceEpoch = today.minusDays(2L * days + 1).atStartOfDay(ZoneOffset.UTC).toEpochSecond();
        long untilEpoch = Instant.now().getEpochSecond();
        String viewersPeriod = days <= 7 ? "week" : "days_28";

        // Everything below runs in parallel, so the slowest single Graph call sets the load time.
        CompletableFuture<Object> posts = async(() -> {
            try {
                List<LivePost> fetched = fetchPosts(scope, sinceEpoch);
                logStep("posts fetched", startedAt, fetched.size() + " posts");
                List<LivePost> withViews = attachViews(scope, fetched, days);
                logStep("post views fetched", startedAt, "");
                return withViews;
            } catch (GraphException ex) {
                return ex;
            }
        });
        CompletableFuture<DailySeries> views = async(() -> fetchDaily(scope, sinceEpoch, untilEpoch, "day",
            "page_media_view", "page_impressions"));
        CompletableFuture<DailySeries> threeSecond = async(() -> fetchDaily(scope, sinceEpoch, untilEpoch, "day",
            "page_video_views"));
        CompletableFuture<DailySeries> watch = async(() -> fetchDaily(scope, sinceEpoch, untilEpoch, "day",
            "page_video_view_time"));
        CompletableFuture<Long> viewers = async(() -> fetchLatest(scope, sinceEpoch, untilEpoch, viewersPeriod,
            "page_total_media_view_unique", "page_impressions_unique"));
        CompletableFuture<Kpis> kpis = async(() -> kpis(scope));
        timed("page views series", startedAt, views);
        timed("3-second views series", startedAt, threeSecond);
        timed("watch time series", startedAt, watch);
        timed("viewers", startedAt, viewers);
        timed("summary cards (db)", startedAt, kpis);

        List<LivePost> livePosts = List.of();
        String postsError = null;
        Object postResult = posts.join();
        if (postResult instanceof GraphException ex) {
            postsError = ex.getMessage();
        } else {
            @SuppressWarnings("unchecked")
            List<LivePost> parsed = (List<LivePost>) postResult;
            livePosts = parsed;
        }

        Live live = new Live(days, livePosts, postsError, views.join(), threeSecond.join(), watch.join(),
            viewers.join(), kpis.join(), System.currentTimeMillis());
        logStep("dashboard ready", startedAt, "page series ok=" + live.views().ok());
        persistInBackground(scope, livePosts);
        return live;
    }

    private void timed(String step, long startedAtNanos, CompletableFuture<?> future) {
        future.whenComplete((result, error) -> logStep(step, startedAtNanos, error == null ? "" : "FAILED"));
    }

    private void logStep(String step, long startedAtNanos, String detail) {
        log.info("analytics: {} after {} ms {}", step, (System.nanoTime() - startedAtNanos) / 1_000_000, detail);
    }

    private <T> CompletableFuture<T> async(Supplier<T> task) {
        return CompletableFuture.supplyAsync(task, graphPool);
    }

    /**
     * Post views come from one Graph batch call rather than an insights expansion on the post list, which
     * Facebook answers very slowly for many posts. Posts whose metric is rejected are retried with the
     * older metric names; posts that still fail simply have no view count.
     */
    private List<LivePost> attachViews(Scope scope, List<LivePost> posts, int days) {
        Instant cutoff = Instant.now().minus(Duration.ofDays(days + 1L));
        List<String> pending = posts.stream()
            .filter(p -> p.created() != null && p.created().isAfter(cutoff))
            .map(LivePost::id).collect(Collectors.toCollection(ArrayList::new));
        Map<String, Long[]> found = new HashMap<>();
        for (String[] metrics : POST_METRIC_SETS) {
            if (metrics.length == 0 || pending.isEmpty()) continue;
            List<JsonNode> responses = graph.batchGet(scope.token(), pending.stream()
                .map(id -> id + "/insights?metric=" + String.join(",", metrics)).toList());
            List<String> failed = new ArrayList<>();
            for (int i = 0; i < pending.size(); i++) {
                JsonNode body = responses.get(i);
                if (body == null) {
                    failed.add(pending.get(i));
                    continue;
                }
                Long[] pair = new Long[2];
                applyInsights(body.path("data"), pair);
                found.put(pending.get(i), pair);
            }
            pending = failed;
        }
        return posts.stream().map(p -> {
            Long[] pair = found.get(p.id());
            return pair == null || pair[0] == null ? p
                : new LivePost(p.id(), p.message(), p.created(), p.permalink(), p.image(), p.format(),
                    pair[0], pair[1], p.reactions(), p.comments(), p.shares());
        }).toList();
    }

    /** Reads views/viewers out of an insights "data" array (new or legacy metric names). */
    private void applyInsights(JsonNode data, Long[] pair) {
        for (JsonNode metric : data) {
            long value = metric.path("values").path(0).path("value").asLong(0);
            String name = metric.path("name").asText("");
            if (name.equals("post_media_view") || name.equals("post_impressions")) pair[0] = value;
            else if (name.equals("post_total_media_view_unique") || name.equals("post_impressions_unique")) pair[1] = value;
        }
    }

    /**
     * Stores what was just read (engagement rows, view history) without holding up the response. At most one
     * write per scope runs at a time; a reading skipped this way is simply superseded by the next poll.
     */
    private void persistInBackground(Scope scope, List<LivePost> livePosts) {
        if (livePosts.isEmpty() || !persisting.add(scope.key())) return;
        persistPool.execute(() -> {
            try {
                persistLive(scope, livePosts);
            } finally {
                persisting.remove(scope.key());
            }
        });
    }

    /** Keeps stored engagement and the view-history table in step with what was just read from Facebook. */
    private void persistLive(Scope scope, List<LivePost> livePosts) {
        if (livePosts.isEmpty()) return;
        try {
            Map<String, Post> dbPosts = new HashMap<>();
            for (Post post : scopedPosts(scope)) {
                if (post.getFbPostId() != null) dbPosts.put(post.getFbPostId(), post);
            }
            for (LivePost live : livePosts) {
                Post post = dbPosts.get(live.id());
                if (post != null) {
                    engagementSyncService.recordLive(post, (int) live.reactions(), (int) live.comments(),
                        (int) live.shares(), live.viewers() == null ? null : live.viewers().intValue());
                }
            }
        } catch (Exception ex) {
            log.warn("Could not store live engagement: {}", ex.getMessage());
        }
        snapshots.recordIfChanged(scope.pageId(), livePosts.stream()
            .filter(p -> p.views() != null)
            .map(p -> new PostViewSnapshotStore.Sample(p.id(), p.views(), p.viewers(), p.reactions(), p.comments(), p.shares()))
            .toList());
    }

    private List<LivePost> fetchPosts(Scope scope, long sinceEpoch) {
        Map<String, String> params = new LinkedHashMap<>();
        params.put("fields", POST_BASE_FIELDS);
        params.put("limit", "50");
        params.put("since", String.valueOf(sinceEpoch));
        JsonNode page = graph.get("/" + scope.pageId() + "/published_posts", scope.token(), params);
        List<LivePost> result = new ArrayList<>();
        long deadline = System.nanoTime() + POST_PAGING_BUDGET.toNanos();
        for (int i = 0; i < MAX_POST_PAGES; i++) {
            for (JsonNode node : page.path("data")) {
                LivePost post = parsePost(node);
                if (post != null) result.add(post);
            }
            String next = page.path("paging").path("next").asText("");
            // Keep the panel inside its load-time target: later pages only add older posts.
            if (next.isEmpty() || System.nanoTime() > deadline) break;
            page = graph.getNext(next);
        }
        return result;
    }

    private String postFields(String[] metrics) {
        return metrics.length == 0
            ? POST_BASE_FIELDS
            : POST_BASE_FIELDS + ",insights.metric(" + String.join(",", metrics) + "){name,values}";
    }

    private LivePost parsePost(JsonNode node) {
        String id = node.path("id").asText("");
        if (id.isEmpty()) return null;
        String message = node.path("message").asText("");
        if (message.isEmpty()) message = node.path("story").asText("");

        Long views = null;
        Long viewers = null;
        for (JsonNode metric : node.path("insights").path("data")) {
            long value = metric.path("values").path(0).path("value").asLong(0);
            String name = metric.path("name").asText("");
            if (name.equals("post_media_view") || name.equals("post_impressions")) views = value;
            else if (name.equals("post_total_media_view_unique") || name.equals("post_impressions_unique")) viewers = value;
        }
        return new LivePost(id, message, parseInstant(node.path("created_time").asText("")),
            node.path("permalink_url").asText(""), node.path("full_picture").asText(""),
            formatOf(node.path("attachments").path("data").path(0)), views, viewers,
            node.path("reactions").path("summary").path("total_count").asLong(0),
            node.path("comments").path("summary").path("total_count").asLong(0),
            node.path("shares").path("count").asLong(0));
    }

    private String formatOf(JsonNode attachment) {
        if (attachment.isMissingNode() || attachment.isNull()) return "TEXT";
        String type = (attachment.path("media_type").asText("") + " " + attachment.path("type").asText("")).toLowerCase();
        if (type.contains("photo") || type.contains("album")) return "PHOTO";
        if (type.contains("video")) return "VIDEO";
        if (type.contains("link") || type.contains("share")) return "LINK";
        return type.isBlank() ? "TEXT" : "OTHER";
    }

    private Instant parseInstant(String text) {
        try {
            return OffsetDateTime.parse(text, GRAPH_TIME).toInstant();
        } catch (Exception ex) {
            return null;
        }
    }

    /** Daily values for the first metric name Facebook accepts, keyed by the calendar day they cover. */
    private DailySeries fetchDaily(Scope scope, long since, long until, String period, String... metricNames) {
        String error = null;
        for (String metric : metricNames) {
            try {
                Map<LocalDate, Long> values = new TreeMap<>();
                for (JsonNode point : firstMetricValues(scope, since, until, period, metric)) {
                    OffsetDateTime end = OffsetDateTime.parse(point.path("end_time").asText(), GRAPH_TIME);
                    LocalDate day = end.withOffsetSameInstant(ZoneOffset.UTC).minusDays(1).toLocalDate();
                    values.merge(day, point.path("value").asLong(0), Long::sum);
                }
                return new DailySeries(values, null);
            } catch (GraphException ex) {
                error = ex.getMessage();
            } catch (RuntimeException ex) {
                error = "Unexpected response from Facebook";
            }
        }
        return DailySeries.failed(error);
    }

    private Long fetchLatest(Scope scope, long since, long until, String period, String... metricNames) {
        for (String metric : metricNames) {
            try {
                JsonNode values = firstMetricValues(scope, since, until, period, metric);
                if (values.size() > 0) return values.get(values.size() - 1).path("value").asLong(0);
            } catch (RuntimeException ignored) {
                // try the next metric name
            }
        }
        return null;
    }

    private JsonNode firstMetricValues(Scope scope, long since, long until, String period, String metric) {
        Map<String, String> params = new LinkedHashMap<>();
        params.put("metric", metric);
        params.put("period", period);
        params.put("since", String.valueOf(since));
        params.put("until", String.valueOf(until));
        JsonNode response = graph.get("/" + scope.pageId() + "/insights", scope.token(), params);
        return response.path("data").path(0).path("values");
    }

    // ───────────────────────── dashboard ─────────────────────────

    public Dashboard getDashboard(User user, UUID orgId, int requestedDays) {
        int days = requestedDays == 7 ? 7 : 28;
        Scope scope = resolveScope(user, orgId);

        if (!scope.connected()) {
            return new Dashboard(false, days, kpis(scope), emptyOverview(days), List.of(), List.of(),
                false, List.of(), System.currentTimeMillis());
        }

        Live live = loadLive(scope, days);
        List<String> warnings = new ArrayList<>();
        if (live.postsError() != null) warnings.add("Posts: " + live.postsError());
        if (live.views().error() != null) warnings.add("Views: " + live.views().error());

        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        LocalDate lastDate = today.minusDays(1);
        if (live.views().ok() && !live.views().values().isEmpty()) {
            LocalDate latest = java.util.Collections.max(live.views().values().keySet());
            if (latest.isAfter(lastDate)) lastDate = latest;
        }
        LocalDate currentStart = lastDate.minusDays(days - 1L);
        LocalDate previousStart = currentStart.minusDays(days);
        LocalDate previousEnd = currentStart.minusDays(1);

        List<LivePost> current = live.posts().stream().filter(p -> inRange(p, currentStart, today)).toList();
        List<LivePost> previous = live.posts().stream().filter(p -> inRange(p, previousStart, previousEnd)).toList();

        List<DayPoint> viewsSeries = filled(live.views(), currentStart, lastDate, 1);
        List<DayPoint> threeSecondSeries = filled(live.threeSecond(), currentStart, lastDate, 1);
        List<DayPoint> watchSeries = filled(live.watchTime(), currentStart, lastDate, 1000);
        Map<LocalDate, Long> byPublishDay = new HashMap<>();
        for (LivePost p : current) {
            if (p.created() != null) byPublishDay.merge(dayOf(p), p.interactions(), Long::sum);
        }
        List<DayPoint> interactionsSeries = filled(new DailySeries(byPublishDay, null), currentStart, lastDate, 1);

        long views = sum(viewsSeries);
        long previousViews = sumRange(live.views(), previousStart, previousEnd, 1);
        long interactions = current.stream().mapToLong(LivePost::interactions).sum();
        long previousInteractions = previous.stream().mapToLong(LivePost::interactions).sum();

        boolean postViews = live.posts().stream().anyMatch(p -> p.views() != null);
        Overview overview = new Overview(
            trend(views, previousViews),
            trend(sum(threeSecondSeries), sumRange(live.threeSecond(), previousStart, previousEnd, 1)),
            trend(interactions, previousInteractions),
            trend(sum(watchSeries), sumRange(live.watchTime(), previousStart, previousEnd, 1000)),
            live.viewers(), viewsSeries, threeSecondSeries, interactionsSeries, watchSeries,
            currentStart.toString(), lastDate.toString());

        List<ContentItem> content = current.stream()
            .sorted(Comparator.comparingLong((LivePost p) -> p.views() == null ? -1 : p.views()).reversed()
                .thenComparing(LivePost::created, Comparator.nullsLast(Comparator.reverseOrder())))
            .map(p -> new ContentItem(p.id(), p.message(), p.created() == null ? null : p.created().toString(),
                p.permalink(), p.image(), p.format(), p.views(), p.reactions(), p.comments(), p.shares()))
            .toList();

        return new Dashboard(true, days, live.kpis(), overview, content, formats(current),
            live.views().ok() || postViews, warnings, live.fetchedAt());
    }

    private Kpis kpis(Scope scope) {
        PostTotals totals = scope.orgId() != null
            ? postRepository.totalsForOrganization(scope.orgId())
            : postRepository.totalsForPersonal(scope.user());
        long published = totals.getPublishedPosts();
        long engagement = totals.getTotalEngagement();
        return new Kpis(totals.getTotalPosts(), published, engagement, published > 0 ? (double) engagement / published : 0);
    }

    private Overview emptyOverview(int days) {
        LocalDate end = LocalDate.now(ZoneOffset.UTC).minusDays(1);
        LocalDate start = end.minusDays(days - 1L);
        Trend zero = new Trend(0, 0, 0);
        List<DayPoint> series = filled(new DailySeries(Map.of(), null), start, end, 1);
        return new Overview(zero, zero, zero, zero, null, series, series, series, series, start.toString(), end.toString());
    }

    private boolean inRange(LivePost post, LocalDate from, LocalDate to) {
        if (post.created() == null) return false;
        LocalDate day = dayOf(post);
        return !day.isBefore(from) && !day.isAfter(to);
    }

    private LocalDate dayOf(LivePost post) {
        return post.created().atZone(ZoneOffset.UTC).toLocalDate();
    }

    private List<DayPoint> filled(DailySeries series, LocalDate from, LocalDate to, long divisor) {
        List<DayPoint> points = new ArrayList<>();
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            long value = series.ok() ? series.values().getOrDefault(day, 0L) : 0;
            points.add(new DayPoint(day.toString(), value / divisor));
        }
        return points;
    }

    private long sum(List<DayPoint> points) {
        return points.stream().mapToLong(DayPoint::value).sum();
    }

    private long sumRange(DailySeries series, LocalDate from, LocalDate to, long divisor) {
        return series.ok() ? sum(filled(series, from, to, divisor)) : 0;
    }

    private Trend trend(long value, long previous) {
        int pct = previous == 0 ? (value == 0 ? 0 : 100) : (int) Math.round((value - previous) * 100.0 / previous);
        return new Trend(value, previous, pct);
    }

    private List<FormatStat> formats(List<LivePost> posts) {
        Map<String, String> labels = new LinkedHashMap<>();
        labels.put("PHOTO", "Photos");
        labels.put("VIDEO", "Videos");
        labels.put("LINK", "Links");
        labels.put("TEXT", "Text");
        labels.put("OTHER", "Others");
        List<FormatStat> stats = new ArrayList<>();
        labels.forEach((key, label) -> {
            List<LivePost> group = posts.stream().filter(p -> p.format().equals(key)).toList();
            if (!group.isEmpty()) {
                stats.add(new FormatStat(key, label, group.size(),
                    group.stream().mapToLong(p -> p.views() == null ? 0 : p.views()).sum(),
                    group.stream().mapToLong(LivePost::interactions).sum()));
            }
        });
        return stats;
    }

    // ───────────────────────── single post ─────────────────────────

    public PostDetail getPostDetail(User user, UUID orgId, String fbPostId) {
        Scope scope = resolveScope(user, orgId);
        if (!scope.connected() || !fbPostId.matches("\\d+_\\d+") || !fbPostId.startsWith(scope.pageId() + "_")) {
            // A post id that isn't on this scope's own Page is indistinguishable from a missing one.
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Post not found");
        }
        return detailCache.get(scope.key() + "|" + fbPostId, () -> fetchPostDetail(scope, fbPostId));
    }

    private PostDetail fetchPostDetail(Scope scope, String fbPostId) {
        long startedAt = System.nanoTime();
        CompletableFuture<LivePost> postFuture = async(() -> fetchSinglePost(scope, fbPostId));
        CompletableFuture<CommentResult> commentsFuture = async(() -> fetchComments(scope, fbPostId));
        CompletableFuture<Long> clicksFuture = async(() -> fetchLinkClicks(scope, fbPostId));
        CompletableFuture<List<PostViewSnapshotStore.Reading>> historyFuture =
            async(() -> snapshots.history(scope.pageId(), fbPostId));
        timed("post " + fbPostId, startedAt, postFuture);
        timed("comments", startedAt, commentsFuture);
        timed("link clicks", startedAt, clicksFuture);
        timed("view history (db)", startedAt, historyFuture);
        // Loaded on this thread, not the pool: fetchLive itself fans out onto the pool and would starve it.
        Live live;
        try {
            live = baselineCache.get(scope.key() + "|" + TYPICAL_WINDOW_DAYS, () -> fetchLive(scope, TYPICAL_WINDOW_DAYS));
        } catch (RuntimeException ex) {
            live = null;
        }

        LivePost post;
        try {
            post = postFuture.join();
        } catch (java.util.concurrent.CompletionException ex) {
            if (ex.getCause() instanceof GraphException graphEx && (graphEx.getStatus() == 400 || graphEx.getStatus() == 404)) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Post not found");
            }
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Facebook could not be reached");
        }
        CommentResult comments = commentsFuture.join();

        long commentCount = comments.complete() ? comments.total() : Math.max(post.comments(), comments.total());
        long interactions = post.reactions() + commentCount + post.shares();

        List<PostViewSnapshotStore.Reading> history = List.of();
        if (post.views() != null) {
            // The write goes to the background; the live value is appended to the graph below regardless.
            PostViewSnapshotStore.Sample sample = new PostViewSnapshotStore.Sample(
                post.id(), post.views(), post.viewers(), post.reactions(), commentCount, post.shares());
            persistPool.execute(() -> snapshots.recordIfChanged(scope.pageId(), List.of(sample)));
            history = historyFuture.join();
        }
        List<SeriesPoint> series = new ArrayList<>();
        for (PostViewSnapshotStore.Reading reading : history) {
            series.add(new SeriesPoint(reading.capturedAt().toEpochMilli(), reading.views()));
        }
        if (post.views() != null) series.add(new SeriesPoint(System.currentTimeMillis(), post.views()));
        String trackingSince = history.isEmpty() ? null : history.get(0).capturedAt().toString();

        Long typical = null;
        String comparison = null;
        if (post.views() != null && live != null) {
            List<Long> others = live.posts().stream()
                .filter(p -> !p.id().equals(post.id()) && p.views() != null)
                .map(LivePost::views).sorted().toList();
            if (!others.isEmpty()) {
                typical = others.get(others.size() / 2);
                comparison = post.views() >= typical * 1.25 ? "above" : post.views() <= typical * 0.75 ? "below" : "typical";
            }
        }

        logStep("post detail ready", startedAt, "");
        // Link clicks and follows are only reported for some post types; null renders as "--".
        return new PostDetail(post.id(), post.message(), post.created() == null ? null : post.created().toString(),
            permalinkOf(post), post.image(), post.format(), post.views(), post.viewers(), clicksFuture.join(),
            interactions, post.reactions(), commentCount, post.shares(), series, trackingSince, typical, comparison,
            comments.comments(), comments.complete(), post.views() != null, System.currentTimeMillis());
    }

    private String permalinkOf(LivePost post) {
        return post.permalink() == null || post.permalink().isBlank()
            ? "https://www.facebook.com/" + post.id()
            : post.permalink().startsWith("http") ? post.permalink() : "https://www.facebook.com" + post.permalink();
    }

    private LivePost fetchSinglePost(Scope scope, String fbPostId) {
        GraphException last = null;
        for (String[] metrics : POST_METRIC_SETS) {
            try {
                JsonNode node = graph.get("/" + fbPostId, scope.token(), Map.of("fields", postFields(metrics)));
                LivePost post = parsePost(node);
                if (post != null) return post;
            } catch (GraphException ex) {
                last = ex;
                if (ex.getStatus() == 401 || ex.getStatus() >= 500) break;
            }
        }
        throw last != null ? last : new GraphException(404, "Post not found", null);
    }

    private Long fetchLinkClicks(Scope scope, String fbPostId) {
        try {
            JsonNode response = graph.get("/" + fbPostId + "/insights", scope.token(),
                Map.of("metric", "post_clicks_by_type", "period", "lifetime"));
            JsonNode value = response.path("data").path(0).path("values").path(0).path("value");
            return value.has("link clicks") ? value.path("link clicks").asLong(0) : null;
        } catch (RuntimeException ex) {
            return null;
        }
    }

    // ───────────────────────── comments ─────────────────────────

    private record CommentResult(List<Comment> comments, long total, boolean complete) {}

    private CommentResult fetchComments(Scope scope, String fbPostId) {
        List<Comment> comments = new ArrayList<>();
        boolean complete = true;
        try {
            Map<String, String> params = new LinkedHashMap<>();
            params.put("fields", COMMENT_CORE + ",comments.limit(100).order(chronological){" + COMMENT_CORE + "}");
            params.put("filter", "toplevel");
            params.put("order", "chronological");
            params.put("limit", "100");
            JsonNode page = graph.get("/" + fbPostId + "/comments", scope.token(), params);
            for (int i = 0; ; i++) {
                for (JsonNode node : page.path("data")) comments.add(parseComment(node, scope));
                String next = page.path("paging").path("next").asText("");
                if (next.isEmpty()) break;
                if (i + 1 >= MAX_COMMENT_PAGES) {
                    complete = false;
                    break;
                }
                page = graph.getNext(next);
            }
        } catch (GraphException ex) {
            log.warn("Could not load comments for {}: {}", fbPostId, ex.getMessage());
            complete = false;
        }
        long total = comments.size() + comments.stream().mapToLong(c -> c.replies().size()).sum();
        return new CommentResult(comments, total, complete);
    }

    private Comment parseComment(JsonNode node, Scope scope) {
        List<Comment> replies = new ArrayList<>();
        JsonNode inline = node.path("comments").path("data");
        for (JsonNode reply : inline) replies.add(parseComment(reply, scope));

        long expected = node.path("comment_count").asLong(0);
        if (replies.size() < expected && node.path("comments").path("paging").has("next")) {
            // More replies than fit in the inline page: pull the rest of this thread.
            try {
                replies.clear();
                Map<String, String> params = new LinkedHashMap<>();
                params.put("fields", COMMENT_CORE);
                params.put("order", "chronological");
                params.put("limit", "100");
                JsonNode page = graph.get("/" + node.path("id").asText() + "/comments", scope.token(), params);
                for (int i = 0; i < MAX_COMMENT_PAGES; i++) {
                    for (JsonNode reply : page.path("data")) replies.add(parseComment(reply, scope));
                    String next = page.path("paging").path("next").asText("");
                    if (next.isEmpty()) break;
                    page = graph.getNext(next);
                }
            } catch (GraphException ex) {
                log.debug("Could not load full reply thread: {}", ex.getMessage());
            }
        }

        JsonNode from = node.path("from");
        Instant created = parseInstant(node.path("created_time").asText(""));
        return new Comment(node.path("id").asText(""), node.path("message").asText(""),
            created == null ? null : created.toString(),
            from.path("name").asText(""), from.path("id").asText(""),
            from.path("picture").path("data").path("url").asText(""),
            node.path("like_count").asLong(0), node.path("permalink_url").asText(""),
            node.path("attachment").path("media").path("image").path("src").asText(""), replies);
    }
}
