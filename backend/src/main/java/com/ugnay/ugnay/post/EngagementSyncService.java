package com.ugnay.ugnay.post;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;

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

    /** Skip re-fetching a post's engagement if it was refreshed more recently than this, to avoid hammering the Graph API. */
    private static final Duration MIN_REFRESH_INTERVAL = Duration.ofSeconds(30);

    private final PostEngagementRepository engagementRepository;
    private final FacebookService facebookService;

    public void syncPosts(List<Post> posts, String accessToken) {
        syncPosts(posts, accessToken, false);
    }

    public void syncPosts(List<Post> posts, String accessToken, boolean forceRefresh) {
        if (accessToken == null || accessToken.isBlank()) {
            return;
        }
        Instant now = Instant.now();
        for (Post post : posts) {
            if (post.getStatus() != Post.PostStatus.PUBLISHED
                || post.getFbPostId() == null || post.getFbPostId().isBlank()) {
                continue;
            }
            syncPost(post, accessToken, now, forceRefresh);
        }
    }

    private void syncPost(Post post, String accessToken, Instant now, boolean forceRefresh) {
        PostEngagement engagement = engagementRepository.findFirstByPost_Id(post.getId()).orElse(null);
        if (!forceRefresh && engagement != null && engagement.getFetchedAt() != null
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
