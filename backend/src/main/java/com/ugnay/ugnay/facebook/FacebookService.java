package com.ugnay.ugnay.facebook;

import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class FacebookService {

    @Value("${facebook.api.url}")
    private String fbApiUrl;

    private final WebClient webClient = WebClient.builder().build();

    /**
     * Publish a post to a Facebook Page feed.
     * Returns the fb_post_id on success.
     */
    public String publishPost(String accessToken, String pageId, String message, String imageUrl) {
        Map<String, Object> body = new java.util.HashMap<>();
        body.put("message", message);
        body.put("access_token", accessToken);
        if (imageUrl != null && !imageUrl.isBlank()) {
            body.put("link", imageUrl);
        }

        Map<String, Object> response = webClient.post()
            .uri(fbApiUrl + "/" + pageId + "/feed")
            .bodyValue(body)
            .retrieve()
            .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
            .block();

        return response != null ? (String) response.get("id") : null;
    }

    /**
     * Fetch engagement metrics for a published post.
     * Queries reactions, comments, and shares with resilient fallback so that
     * partial permissions or unsupported fields on specific post types do not
     * prevent capturing available metrics.
     */
    public Map<String, Object> getPostInsights(String accessToken, String fbPostId) {
        try {
            return webClient.get()
                .uri(fbApiUrl + "/" + fbPostId
                    + "?fields=reactions.summary(true).limit(0),comments.summary(true).limit(0),shares&access_token=" + accessToken)
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
                .block();
        } catch (WebClientResponseException ex) {
            log.debug("Primary Graph API engagement query failed for post {} (HTTP {}): {}, attempting resilient fallback",
                fbPostId, ex.getStatusCode(), ex.getResponseBodyAsString());
            return fetchInsightsResiliently(accessToken, fbPostId);
        } catch (Exception ex) {
            log.debug("Primary Graph API engagement query error for post {}: {}, attempting resilient fallback",
                fbPostId, ex.getMessage());
            return fetchInsightsResiliently(accessToken, fbPostId);
        }
    }

    private Map<String, Object> fetchInsightsResiliently(String accessToken, String fbPostId) {
        Map<String, Object> combined = new HashMap<>();

        // 1. Try reactions summary (counts all reaction types: like, love, haha, wow, sad, angry, care)
        Map<String, Object> reactions = fetchFieldQuietly(accessToken, fbPostId, "reactions.summary(true).limit(0)");
        if (reactions != null && reactions.containsKey("reactions")) {
            combined.put("reactions", reactions.get("reactions"));
        } else {
            // Fallback: try likes summary
            Map<String, Object> likes = fetchFieldQuietly(accessToken, fbPostId, "likes.summary(true).limit(0)");
            if (likes != null && likes.containsKey("likes")) {
                combined.put("likes", likes.get("likes"));
            }
        }

        // 2. Try comments summary
        Map<String, Object> comments = fetchFieldQuietly(accessToken, fbPostId, "comments.summary(true).limit(0)");
        if (comments != null && comments.containsKey("comments")) {
            combined.put("comments", comments.get("comments"));
        }

        // 3. Try shares
        Map<String, Object> shares = fetchFieldQuietly(accessToken, fbPostId, "shares");
        if (shares != null && shares.containsKey("shares")) {
            combined.put("shares", shares.get("shares"));
        }

        return combined;
    }

    private Map<String, Object> fetchFieldQuietly(String accessToken, String fbPostId, String field) {
        try {
            return webClient.get()
                .uri(fbApiUrl + "/" + fbPostId + "?fields=" + field + "&access_token=" + accessToken)
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
                .block();
        } catch (Exception ignored) {
            return null;
        }
    }
}