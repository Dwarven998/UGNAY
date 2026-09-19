package com.ugnay.ugnay.post;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import com.ugnay.ugnay.facebook.FacebookService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Keeps {@link PostEngagement} rows in sync with live Facebook Graph API counts. Callers
 * always pass an already permission-scoped list of posts (a single organization's or a single
 * user's personal posts) and that scope's own access token, so a sync never reads or writes
 * engagement data belonging to another organization or user.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class EngagementSyncService {

    /**
     * Skip re-fetching a post's engagement if it was refreshed more recently than this, to avoid hammering the Graph API.
     * Kept just under the Analytics panel's poll interval so every poll can trigger a fresh fetch.
     */
    private static final Duration MIN_REFRESH_INTERVAL = Duration.ofSeconds(3);

    private final PostEngagementRepository engagementRepository;
    private final FacebookService facebookService;

    /** Scopes (an organization or a personal account) that already have a background sync running. */
    private final Set<String> inFlightScopes = ConcurrentHashMap.newKeySet();

    /** Graph API calls are blocking, so posts are fetched in parallel instead of one after another. */
    private final ExecutorService postFetchPool = Executors.newFixedThreadPool(4, runnable -> {
        Thread thread = new Thread(runnable, "engagement-sync");
        thread.setDaemon(true);
        return thread;
    });

    public void syncPosts(List<Post> posts, String accessToken) {
        if (accessToken == null || accessToken.isBlank()) {
            return;
        }
        Instant now = Instant.now();
        for (Post post : posts) {
            if (isSyncable(post)) {
                syncPost(post, accessToken, now);
            }
        }
    }

    /**
     * Refreshes engagement without blocking the caller, so an API request can answer from the database
     * immediately while fresh Facebook counts land in time for the next poll. At most one background
     * sync runs per scope; overlapping requests for the same scope are skipped.
     */
    public void syncPostsInBackground(String scopeKey, List<Post> posts, String accessToken) {
        if (accessToken == null || accessToken.isBlank() || !inFlightScopes.add(scopeKey)) {
            return;
        }
        try {
            Instant now = Instant.now();
            CompletableFuture<?>[] tasks = posts.stream()
                .filter(this::isSyncable)
                .map(post -> CompletableFuture.runAsync(() -> syncPost(post, accessToken, now), postFetchPool))
                .toArray(CompletableFuture[]::new);
            CompletableFuture.allOf(tasks).whenComplete((result, error) -> inFlightScopes.remove(scopeKey));
        } catch (RuntimeException ex) {
            inFlightScopes.remove(scopeKey);
            throw ex;
        }
    }

    /**
     * Stores counts the Analytics panel has just read live from Facebook, so the stored totals used by the
     * summary cards never lag behind what the rest of the panel shows. No-op when nothing changed.
     */
    public void recordLive(Post post, int likes, int comments, int shares, Integer reach) {
        PostEngagement engagement = engagementRepository.findFirstByPost_Id(post.getId()).orElse(null);
        if (engagement == null) {
            engagement = PostEngagement.builder().post(post).build();
        } else if (engagement.getLikes() == likes && engagement.getComments() == comments
            && engagement.getShares() == shares && (reach == null || engagement.getReach() == reach)) {
            return;
        }
        engagement.setLikes(likes);
        engagement.setComments(comments);
        engagement.setShares(shares);
        if (reach != null) engagement.setReach(reach);
        engagement.setFetchedAt(Instant.now());
        engagementRepository.save(engagement);
    }

    private boolean isSyncable(Post post) {
        return post.getStatus() == Post.PostStatus.PUBLISHED
            && post.getFbPostId() != null && !post.getFbPostId().isBlank();
    }

    private void syncPost(Post post, String accessToken, Instant now) {
        PostEngagement engagement = engagementRepository.findFirstByPost_Id(post.getId()).orElse(null);
        if (engagement != null && engagement.getFetchedAt() != null
            && Duration.between(engagement.getFetchedAt(), now).compareTo(MIN_REFRESH_INTERVAL) < 0) {
            return;
        }
        try {
            Map<String, Object> insights = facebookService.getPostInsights(accessToken, post.getFbPostId());
            if (insights == null || insights.isEmpty()) {
                return;
            }
            if (engagement == null) {
                engagement = PostEngagement.builder().post(post).build();
            }
            // Count total reactions (like, love, haha, wow, sad, angry, care), fallback to likes
            int reactions = extractSummaryCount(insights.get("reactions"));
            if (reactions == 0 && insights.containsKey("likes")) {
                reactions = extractSummaryCount(insights.get("likes"));
            }
            engagement.setLikes(reactions);
            engagement.setComments(extractSummaryCount(insights.get("comments")));
            engagement.setShares(extractShareCount(insights.get("shares")));
            engagement.setFetchedAt(now);
            engagementRepository.save(engagement);
            log.debug("Synced engagement for post {}: reactions={}, comments={}, shares={}",
                post.getId(), reactions, engagement.getComments(), engagement.getShares());
        } catch (WebClientResponseException ex) {
            log.warn("Failed to sync Facebook engagement for post {} ({}): {} - {}",
                post.getId(), post.getFbPostId(), ex.getStatusCode(), ex.getResponseBodyAsString());
        } catch (Exception ex) {
            Throwable root = ex;
            while (root.getCause() != null && root.getCause() != root) {
                if (root instanceof WebClientResponseException) break;
                root = root.getCause();
            }
            if (root instanceof WebClientResponseException wce) {
                log.warn("Failed to sync Facebook engagement for post {} ({}): {} - {}",
                    post.getId(), post.getFbPostId(), wce.getStatusCode(), wce.getResponseBodyAsString());
            } else {
                log.warn("Failed to sync Facebook engagement for post {}: {}", post.getId(), ex.getMessage());
            }
        }
    }

    private int extractSummaryCount(Object field) {
        if (!(field instanceof Map<?, ?> map)) return 0;
        Object summary = map.get("summary");
        if (!(summary instanceof Map<?, ?> summaryMap)) return 0;
        Object count = summaryMap.get("total_count");
        return count instanceof Number number ? number.intValue() : 0;
    }

    private int extractShareCount(Object field) {
        if (!(field instanceof Map<?, ?> map)) return 0;
        Object count = map.get("count");
        return count instanceof Number number ? number.intValue() : 0;
    }
}
