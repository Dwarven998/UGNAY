package com.ugnay.ugnay.post;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import com.ugnay.ugnay.core.User;
import com.ugnay.ugnay.core.UserRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import reactor.util.retry.Retry;

@Component
@RequiredArgsConstructor
@Slf4j
public class FacebookPublishingJob {

    private static final int MAX_RETRIES = 3;

    @Value("${facebook.api.url}")
    private String facebookApiUrl;

    private final PostRepository postRepository;
    private final UserRepository userRepository;
    private final WebClient webClient = WebClient.builder().build();

    public void publishScheduledPost(UUID postId) {
        publishInternal(postId, false);
    }

    public void publishImmediately(UUID postId) {
        publishInternal(postId, true);
    }

    private void publishInternal(UUID postId, boolean manualTrigger) {
        Post post = postRepository.findDetailedById(postId)
            .orElseThrow(() -> new IllegalArgumentException("Post not found"));

        User user = userRepository.findById(post.getUser().getId())
            .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (user.getFbPageId() == null || user.getFbPageId().isBlank()
            || user.getFbAccessToken() == null || user.getFbAccessToken().isBlank()) {
            markFailed(postId, new IllegalStateException("Facebook Page connection is missing"));
            return;
        }

        boolean hasImage = post.getMediaAsset() != null
            && post.getMediaAsset().getFileUrl() != null
            && !post.getMediaAsset().getFileUrl().isBlank();

        // Route to the correct endpoint:
        // - /photos  → publishes an actual image + caption (visible as a photo post)
        // - /feed    → publishes text only
        String endpoint = hasImage
            ? facebookApiUrl + "/" + user.getFbPageId() + "/photos"
            : facebookApiUrl + "/" + user.getFbPageId() + "/feed";

        Map<String, Object> payload = buildPayload(user, post, hasImage);

        log.info("Publishing post {} to Facebook endpoint: {} (hasImage={})", postId, endpoint, hasImage);

        webClient.post()
            .uri(endpoint)
            .bodyValue(payload)
            .retrieve()
            .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
            .retryWhen(
                Retry.backoff(MAX_RETRIES, Duration.ofSeconds(5))
                    .filter(this::isRetryable)
                    .doBeforeRetry(signal -> log.warn(
                        "Retrying Facebook publish for post {} attempt {}",
                        postId,
                        signal.totalRetries() + 1
                    ))
            )
            .doOnSuccess(response -> markPublished(postId, response))
            .doOnError(error -> markFailed(postId, error))
            .subscribe();

        if (manualTrigger) {
            log.info("Triggered manual publish for post {}", postId);
        }
    }

    private Map<String, Object> buildPayload(User user, Post post, boolean hasImage) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("access_token", user.getFbAccessToken());

        String message = buildMessage(post);

        if (hasImage) {
            // /photos endpoint uses "url" for the image and "caption" for the text
            payload.put("url",     post.getMediaAsset().getFileUrl());
            payload.put("caption", message);
        } else {
            // /feed endpoint uses "message" for text-only posts
            payload.put("message", message);
        }

        return payload;
    }

    private String buildMessage(Post post) {
        String hashtags = post.getHashtags() != null && post.getHashtags().length > 0
            ? "\n\n" + String.join(" ", post.getHashtags())
            : "";
        return post.getCaption() + hashtags;
    }

    private boolean isRetryable(Throwable error) {
        return !isConnectionInvalid(error);
    }

    @Transactional
    protected void markPublished(UUID postId, Map<String, Object> response) {
        postRepository.findById(postId).ifPresent(post -> {
            post.setStatus(Post.PostStatus.PUBLISHED);
            post.setPublishedAt(Instant.now());
            // /photos returns { "id": "photo_id", "post_id": "page_post_id" }
            // /feed   returns { "id": "page_post_id" }
            // Prefer post_id (the timeline post) when available
            Object fbPostId = response.containsKey("post_id")
                ? response.get("post_id")
                : response.get("id");
            if (fbPostId != null) {
                post.setFbPostId(String.valueOf(fbPostId));
            }
            postRepository.save(post);
            log.info("Published post {} to Facebook, fb_post_id={}", postId, fbPostId);
        });
    }

    @Transactional
    protected void markFailed(UUID postId, Throwable error) {
        postRepository.findById(postId).ifPresent(post -> {
            post.setStatus(Post.PostStatus.FAILED);
            postRepository.save(post);
            if (isConnectionInvalid(error)) {
                userRepository.findById(post.getUser().getId()).ifPresent(user -> {
                    user.setFbPageId(null);
                    user.setFbAccessToken(null);
                    userRepository.save(user);
                    log.warn("Cleared invalid FB credentials for user {}", user.getId());
                });
            }
            log.error("Failed to publish post {}", postId, error);
        });
    }

    private boolean isConnectionInvalid(Throwable error) {
        if (error instanceof WebClientResponseException webClientError) {
            int status = webClientError.getStatusCode().value();
            if (status == 401 || status == 403) return true;
            String body = webClientError.getResponseBodyAsString();
            return body != null && (body.contains("OAuthException")
                || body.contains("190")
                || body.contains("Invalid OAuth access token"));
        }
        return false;
    }
}