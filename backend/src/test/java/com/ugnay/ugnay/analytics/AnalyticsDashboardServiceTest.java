package com.ugnay.ugnay.analytics;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import com.sun.net.httpserver.HttpServer;
import com.ugnay.ugnay.analytics.AnalyticsDtos.Dashboard;
import com.ugnay.ugnay.analytics.AnalyticsDtos.PostDetail;
import com.ugnay.ugnay.core.User;
import com.ugnay.ugnay.facebook.FacebookInsightsClient;
import com.ugnay.ugnay.org.Organization;
import com.ugnay.ugnay.org.OrganizationPermissionService;
import com.ugnay.ugnay.org.OrganizationRepository;
import com.ugnay.ugnay.post.EngagementSyncService;
import com.ugnay.ugnay.post.PostRepository;
import com.ugnay.ugnay.post.PostTotals;

/** Runs the dashboard service against a canned local Graph API so parsing and aggregation are checked end to end. */
class AnalyticsDashboardServiceTest {

    private static final String PAGE = "1001";
    private static final DateTimeFormatter GRAPH_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ssZ");

    private HttpServer server;
    private AnalyticsDashboardService service;
    private final UUID orgId = UUID.randomUUID();
    private final User user = User.builder().id(UUID.randomUUID()).build();

    @BeforeEach
    void setUp() throws IOException {
        Instant now = Instant.now();
        String created1 = GRAPH_TIME.format(now.minusSeconds(3 * 86400).atOffset(ZoneOffset.UTC));
        String created2 = GRAPH_TIME.format(now.minusSeconds(2 * 86400).atOffset(ZoneOffset.UTC));
        LocalDate yesterday = LocalDate.now(ZoneOffset.UTC).minusDays(1);
        LocalDate twoDaysAgo = yesterday.minusDays(1);

        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        // The batch handler calls back into this server, so it needs more than the default single thread.
        server.setExecutor(java.util.concurrent.Executors.newFixedThreadPool(4));
        server.createContext("/", exchange -> {
            String path = exchange.getRequestURI().getPath();
            String query = exchange.getRequestURI().getQuery();
            String body;
            int status = 200;
            if (exchange.getRequestMethod().equals("POST")) {
                // Graph batch: replay each relative URL against this same server and wrap the answers.
                String form = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
                String batchJson = java.net.URLDecoder.decode(form.replaceAll(".*batch=([^&]*).*", "$1"), StandardCharsets.UTF_8);
                var mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                var out = mapper.createArrayNode();
                try {
                    for (var entry : mapper.readTree(batchJson)) {
                        var reply = java.net.http.HttpClient.newHttpClient().send(
                            java.net.http.HttpRequest.newBuilder(java.net.URI.create("http://127.0.0.1:"
                                + server.getAddress().getPort() + "/" + entry.path("relative_url").asText())).build(),
                            java.net.http.HttpResponse.BodyHandlers.ofString());
                        out.addObject().put("code", reply.statusCode()).put("body", reply.body());
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
                body = out.toString();
            } else if (path.equals("/" + PAGE + "/published_posts")) {
                body = """
                    {"data":[
                      {"id":"1001_111","message":"Hello world","created_time":"%s","permalink_url":"https://www.facebook.com/1001/posts/111",
                       "full_picture":"https://img/1.jpg","attachments":{"data":[{"media_type":"photo"}]},
                       "reactions":{"summary":{"total_count":3}},"comments":{"summary":{"total_count":2}},"shares":{"count":1},
                       "insights":{"data":[{"name":"post_media_view","values":[{"value":40}]},{"name":"post_total_media_view_unique","values":[{"value":9}]}]}},
                      {"id":"1001_222","message":"Text only","created_time":"%s",
                       "reactions":{"summary":{"total_count":0}},"comments":{"summary":{"total_count":0}},
                       "insights":{"data":[{"name":"post_media_view","values":[{"value":10}]}]}}
                    ]}""".formatted(created1, created2);
            } else if (path.equals("/" + PAGE + "/insights")) {
                String metric = query.replaceAll(".*metric=([a-z_]+).*", "$1");
                if (metric.equals("page_media_view")) {
                    body = """
                        {"data":[{"name":"page_media_view","values":[
                          {"value":30,"end_time":"%s"},{"value":20,"end_time":"%s"}]}]}"""
                        .formatted(endTime(twoDaysAgo), endTime(yesterday));
                } else if (metric.equals("page_total_media_view_unique")) {
                    body = "{\"data\":[{\"values\":[{\"value\":7,\"end_time\":\"" + endTime(yesterday) + "\"}]}]}";
                } else {
                    status = 400;
                    body = "{\"error\":{\"message\":\"(#100) metric not supported\"}}";
                }
            } else if (path.equals("/1001_111/comments")) {
                body = """
                    {"data":[
                      {"id":"c1","message":"First!","created_time":"%s","from":{"id":"u1","name":"Ana","picture":{"data":{"url":"https://img/a.jpg"}}},
                       "like_count":2,"comment_count":1,"comments":{"data":[
                         {"id":"c1r","message":"Reply","created_time":"%s","from":{"id":"u2","name":"Ben"},"like_count":0,"comment_count":0}]}}
                    ]}""".formatted(created1, created2);
            } else if (path.equals("/1001_111/insights") && query.contains("post_clicks_by_type")) {
                body = "{\"data\":[{\"values\":[{\"value\":{\"link clicks\":4,\"photo view\":9}}]}]}";
            } else if (path.equals("/1001_111/insights")) {
                body = "{\"data\":[{\"name\":\"post_media_view\",\"values\":[{\"value\":40}]},"
                    + "{\"name\":\"post_total_media_view_unique\",\"values\":[{\"value\":9}]}]}";
            } else if (path.equals("/1001_222/insights")) {
                body = "{\"data\":[{\"name\":\"post_media_view\",\"values\":[{\"value\":10}]}]}";
            } else if (path.equals("/1001_111")) {
                body = """
                    {"id":"1001_111","message":"Hello world","created_time":"%s","permalink_url":"https://www.facebook.com/1001/posts/111",
                     "reactions":{"summary":{"total_count":3}},"comments":{"summary":{"total_count":2}},"shares":{"count":1},
                     "insights":{"data":[{"name":"post_media_view","values":[{"value":40}]},{"name":"post_total_media_view_unique","values":[{"value":9}]}]}}"""
                    .formatted(created1);
            } else {
                status = 404;
                body = "{\"error\":{\"message\":\"Unsupported get request\"}}";
            }
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(status, bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        });
        server.start();

        PostRepository postRepository = mock(PostRepository.class);
        when(postRepository.findByOrganization_IdOrderByCreatedAtDesc(any())).thenReturn(List.of());
        PostTotals totals = mock(PostTotals.class);
        when(totals.getTotalPosts()).thenReturn(9L);
        when(totals.getPublishedPosts()).thenReturn(7L);
        when(totals.getTotalEngagement()).thenReturn(15L);
        when(postRepository.totalsForOrganization(any())).thenReturn(totals);
        OrganizationRepository organizationRepository = mock(OrganizationRepository.class);
        when(organizationRepository.findById(orgId)).thenReturn(Optional.of(
            Organization.builder().id(orgId).name("CCS").fbPageId(PAGE).fbAccessToken("tok").build()));

        service = new AnalyticsDashboardService(
            postRepository, organizationRepository,
            mock(OrganizationPermissionService.class), mock(EngagementSyncService.class),
            new FacebookInsightsClient("http://127.0.0.1:" + server.getAddress().getPort()),
            mock(PostViewSnapshotStore.class));
    }

    @AfterEach
    void tearDown() {
        server.stop(0);
    }

    private static String endTime(LocalDate day) {
        // Facebook labels a day by the instant it ends (Pacific midnight ≈ 07:00-08:00 UTC the next day).
        return GRAPH_TIME.format(day.plusDays(1).atTime(7, 0).atOffset(ZoneOffset.UTC));
    }

    @Test
    void dashboardAggregatesOneConsistentSnapshot() {
        Dashboard d = service.getDashboard(user, orgId, 28);

        assertTrue(d.connected());
        assertTrue(d.warnings().stream().noneMatch(w -> w.startsWith("Posts")), () -> d.warnings().toString());
        assertEquals(28, d.overview().viewsSeries().size());
        assertEquals(50, d.overview().views().value());                 // 30 + 20, sum of the plotted series
        assertEquals(50, d.overview().viewsSeries().stream().mapToLong(AnalyticsDtos.DayPoint::value).sum());
        assertEquals(7L, d.overview().viewers());
        assertEquals(9, d.kpis().totalPosts());
        assertEquals(15, d.kpis().totalEngagement());
        assertEquals(15.0 / 7, d.kpis().avgEngagement(), 1e-9);
        assertEquals(6, d.overview().interactions().value());            // 3 reactions + 2 comments + 1 share, plus 0 for the text post
    }

    @Test
    void contentIsSortedByViewsAndFormatsAddUp() {
        Dashboard d = service.getDashboard(user, orgId, 28);

        assertEquals(List.of("1001_111", "1001_222"), d.content().stream().map(AnalyticsDtos.ContentItem::id).toList());
        assertEquals("PHOTO", d.content().get(0).format());
        assertEquals("TEXT", d.content().get(1).format());
        assertEquals(50, d.formats().stream().mapToLong(AnalyticsDtos.FormatStat::views).sum());
        assertEquals(2, d.formats().stream().mapToInt(AnalyticsDtos.FormatStat::published).sum());
    }

    @Test
    void unsupportedMetricsDegradeToZeroWithoutFailing() {
        Dashboard d = service.getDashboard(user, orgId, 7);

        assertEquals(0, d.overview().threeSecondViews().value());
        assertEquals(0, d.overview().watchTimeSeconds().value());
        assertTrue(d.viewsAvailable());
    }

    @Test
    void postDetailIncludesEveryCommentAndReply() {
        PostDetail p = service.getPostDetail(user, orgId, "1001_111");

        assertEquals(40L, p.views());
        assertEquals(9L, p.viewers());
        assertEquals(4L, p.linkClicks());
        assertEquals(2, p.comments());                                   // 1 comment + 1 reply, counted from the loaded thread
        assertEquals(3 + 2 + 1, p.interactions());
        assertTrue(p.commentsComplete());
        assertEquals(1, p.commentList().size());
        assertEquals("Reply", p.commentList().get(0).replies().get(0).message());
        assertEquals("https://www.facebook.com/1001/posts/111", p.permalinkUrl());
        assertNotNull(p.series().get(p.series().size() - 1));
        assertEquals(40L, p.series().get(p.series().size() - 1).views()); // graph ends on the live total
        assertEquals(10L, p.typicalViews());                             // the only other post
        assertEquals("above", p.comparison());
    }

    @Test
    void postFromAnotherPageIsRejected() {
        assertThrows(ResponseStatusException.class, () -> service.getPostDetail(user, orgId, "9999_111"));
        assertThrows(ResponseStatusException.class, () -> service.getPostDetail(user, orgId, "1001_111/../x"));
        assertFalse(service.getPostDetail(user, orgId, "1001_111").id().isEmpty());
    }
}
