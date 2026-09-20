package com.ugnay.ugnay.facebook;

import java.net.URI;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeoutException;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.util.retry.Retry;

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
     * Overload for publishing with a single image or null.
     */
    public String publishPost(
        String accessToken,
        String pageId,
        String message,
        String imageUrl
    ) {
        List<String> urls = (imageUrl != null && !imageUrl.isBlank())
            ? List.of(imageUrl)
            : List.of();
        return publishPost(accessToken, pageId, message, urls);
    }

    /**
     * Publish a post with multiple images (or single image, or text only) to a Facebook Page.
     *
     * <ul>
     *   <li>Multi-image: Uploads each photo with {@code published=false} to {@code POST /{pageId}/photos},
     *       collects the photo IDs, then creates a feed post with {@code POST /{pageId}/feed}
     *       referencing {@code attached_media}.</li>
     *   <li>Single image: {@code POST /{pageId}/photos} with {@code url} and {@code message}.</li>
     *   <li>Without image: {@code POST /{pageId}/feed} with {@code message}.</li>
     * </ul>
     *
     * @return the Facebook post ID on success
     */
    public String publishPost(
        String accessToken,
        String pageId,
        String message,
        List<String> imageUrls
    ) {
        List<String> validUrls = imageUrls != null
            ? imageUrls.stream().filter(u -> u != null && !u.isBlank()).toList()
            : List.of();

        if (validUrls.isEmpty()) {
            return publishTextPost(accessToken, pageId, message);
        } else if (validUrls.size() == 1) {
            return publishSingleImagePost(accessToken, pageId, message, validUrls.get(0));
        } else {
            return publishMultiImagePost(accessToken, pageId, message, validUrls);
        }
    }

    private String publishSingleImagePost(
        String accessToken,
        String pageId,
        String message,
        String imageUrl
    ) {
        Map<String, Object> body = new HashMap<>();
        body.put("message", message);
        body.put("access_token", accessToken);
        body.put("url", sanitizeUrl(imageUrl));

        Map<String, Object> response = webClient.post()
            .uri(fbApiUrl + "/" + pageId + "/photos")
            .bodyValue(body)
            .retrieve()
            .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
            .timeout(Duration.ofSeconds(30))
            .retryWhen(Retry.backoff(2, Duration.ofSeconds(1)).filter(this::isRetryable))
            .doOnError(WebClientResponseException.class, ex ->
                log.error("Facebook Graph API error publishing single image [HTTP {}]: {}",
                    ex.getStatusCode(), ex.getResponseBodyAsString()))
            .block();

        if (response == null) {
            return null;
        }

        Object postId = response.get("post_id");
        return postId != null
            ? String.valueOf(postId)
            : String.valueOf(response.get("id"));
    }

    private String publishMultiImagePost(
        String accessToken,
        String pageId,
        String message,
        List<String> imageUrls
    ) {
        log.info("Uploading {} photos for multi-image Facebook post on page {}", imageUrls.size(), pageId);
        List<Map<String, String>> attachedMedia = new ArrayList<>();
        for (String url : imageUrls) {
            String photoId = uploadUnpublishedPhoto(accessToken, pageId, url);
            attachedMedia.add(Map.of("media_fbid", photoId));
        }

        Map<String, Object> body = new HashMap<>();
        body.put("message", message);
        body.put("attached_media", attachedMedia);
        body.put("access_token", accessToken);

        Map<String, Object> response = webClient.post()
            .uri(fbApiUrl + "/" + pageId + "/feed")
            .bodyValue(body)
            .retrieve()
            .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
            .timeout(Duration.ofSeconds(30))
            .retryWhen(Retry.backoff(2, Duration.ofSeconds(1)).filter(this::isRetryable))
            .doOnError(WebClientResponseException.class, ex ->
                log.error("Facebook Graph API error publishing multi-image feed post [HTTP {}]: {}",
                    ex.getStatusCode(), ex.getResponseBodyAsString()))
            .block();

        if (response == null || response.get("id") == null) {
            throw new IllegalStateException("Facebook feed post returned empty response");
        }
        return String.valueOf(response.get("id"));
    }

    private String uploadUnpublishedPhoto(String accessToken, String pageId, String imageUrl) {
        String sanitizedUrl = sanitizeUrl(imageUrl);
        Map<String, Object> body = new HashMap<>();
        body.put("url", sanitizedUrl);
        body.put("published", false);
        body.put("access_token", accessToken);

        Map<String, Object> response = webClient.post()
            .uri(fbApiUrl + "/" + pageId + "/photos")
            .bodyValue(body)
            .retrieve()
            .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
            .timeout(Duration.ofSeconds(30))
            .retryWhen(Retry.backoff(2, Duration.ofSeconds(1)).filter(this::isRetryable))
            .doOnError(WebClientResponseException.class, ex ->
                log.error("Facebook Graph API error uploading unpublished photo [HTTP {}]: {} (url={})",
                    ex.getStatusCode(), ex.getResponseBodyAsString(), sanitizedUrl))
            .block();

        if (response == null || response.get("id") == null) {
            throw new IllegalStateException("Facebook photo upload returned empty response for: " + sanitizedUrl);
        }
        return String.valueOf(response.get("id"));
    }

    private String publishTextPost(
        String accessToken,
        String pageId,
        String message
    ) {
        Map<String, Object> body = new HashMap<>();
        body.put("message", message);
        body.put("access_token", accessToken);

        Map<String, Object> response = webClient.post()
            .uri(fbApiUrl + "/" + pageId + "/feed")
            .bodyValue(body)
            .retrieve()
            .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
            .timeout(Duration.ofSeconds(30))
            .retryWhen(Retry.backoff(2, Duration.ofSeconds(1)).filter(this::isRetryable))
            .doOnError(WebClientResponseException.class, ex ->
                log.error("Facebook Graph API error publishing text post [HTTP {}]: {}",
                    ex.getStatusCode(), ex.getResponseBodyAsString()))
            .block();

        return response != null
            ? (String) response.get("id")
            : null;
    }

    private boolean isRetryable(Throwable error) {
        return error instanceof TimeoutException
            || error instanceof WebClientRequestException
            || (error instanceof WebClientResponseException wce && wce.getStatusCode().is5xxServerError());
    }

    /**
     * Sanitize a URL for the Facebook Graph API by encoding spaces and
     * other unsafe characters.  Uses {@link java.net.URL} to parse the
     * raw URL (which tolerates spaces), then reconstructs via the
     * {@link URI} multi-arg constructor to get proper percent-encoding.
     */
    private String sanitizeUrl(String rawUrl) {
        if (rawUrl == null || rawUrl.isBlank()) {
            return rawUrl;
        }
        try {
            @SuppressWarnings("deprecation")
            java.net.URL parsed = new java.net.URL(rawUrl.trim());
            URI encoded = new URI(
                parsed.getProtocol(),
                parsed.getAuthority(),
                parsed.getPath(),
                parsed.getQuery(),
                parsed.getRef()
            );
            return encoded.toASCIIString();
        } catch (Exception e) {
            log.warn("Failed to sanitize URL '{}', falling back to simple encoding: {}", rawUrl, e.getMessage());
            // Minimal fallback: encode spaces
            return rawUrl.trim().replace(" ", "%20");
        }
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