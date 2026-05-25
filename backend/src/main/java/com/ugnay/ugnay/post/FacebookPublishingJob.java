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

import com.ugnay.ugnay.core.User;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import reactor.core.publisher.Mono;
import reactor.util.retry.Retry;

@Component
@RequiredArgsConstructor
@Slf4j
public class FacebookPublishingJob {

    private static final int MAX_RETRIES = 3;

    @Value("${facebook.api.url}")
    private String facebookApiUrl;

    private final PostRepository postRepository;
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

        User user = post.getUser();
        String message = buildMessage(post);
        Map<String, Object> payload = buildPayload(user, post, message);

        webClient.post()
            .uri(facebookApiUrl + "/" + user.getFbPageId() + "/feed")
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

    private Map<String, Object> buildPayload(User user, Post post, String message) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("message", message);
        payload.put("access_token", user.getFbAccessToken());
        if (post.getMediaAsset() != null && post.getMediaAsset().getFileUrl() != null) {
            payload.put("link", post.getMediaAsset().getFileUrl());
        }
        if (post.getScheduledAt() != null) {
            payload.put("scheduled_publish_time", post.getScheduledAt().getEpochSecond());
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
        return true;
    }

    @Transactional
    protected void markPublished(UUID postId, Map<String, Object> response) {
        postRepository.findById(postId).ifPresent(post -> {
            post.setStatus(Post.PostStatus.PUBLISHED);
            post.setPublishedAt(Instant.now());
            Object fbPostId = response.get("id");
            if (fbPostId != null) {
                post.setFbPostId(String.valueOf(fbPostId));
            }
            postRepository.save(post);
            log.info("Published post {} to Facebook", postId);
        });
    }

    @Transactional
    protected void markFailed(UUID postId, Throwable error) {
        postRepository.findById(postId).ifPresent(post -> {
            post.setStatus(Post.PostStatus.FAILED);
            postRepository.save(post);
            log.error("Failed to publish post {}", postId, error);
        });
    }
}