package com.ugnay.ugnay.post;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
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
import com.ugnay.ugnay.media.MediaAsset;
import com.ugnay.ugnay.org.Organization;
import com.ugnay.ugnay.org.OrganizationRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import reactor.core.publisher.Flux;
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
    private final UserRepository userRepository;
    private final OrganizationRepository organizationRepository;
    private final WebClient webClient = WebClient.builder().build();

    /** Resolves which (pageId, accessToken) to publish with: the post's org if it has one, else the author's legacy personal connection. */
    private record PublishCredentials(String pageId, String accessToken, boolean orgScoped) {}

    private PublishCredentials resolveCredentials(Post post, User user) {
        Organization organization = post.getOrganization();
        if (organization != null) {
            return new PublishCredentials(organization.getFbPageId(), organization.getFbAccessToken(), true);
        }
        return new PublishCredentials(user.getFbPageId(), user.getFbAccessToken(), false);
    }

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

        PublishCredentials credentials = resolveCredentials(post, user);
        if (credentials.pageId() == null || credentials.pageId().isBlank()
            || credentials.accessToken() == null || credentials.accessToken().isBlank()) {
            markFailed(postId, new IllegalStateException("Facebook Page connection is missing"));
            return;
        }

        List<String> imageUrls = new ArrayList<>();
        if (post.getMediaAssets() != null && !post.getMediaAssets().isEmpty()) {
            for (MediaAsset asset : post.getMediaAssets()) {
                if (asset != null && asset.getFileUrl() != null && !asset.getFileUrl().isBlank()) {
                    imageUrls.add(asset.getFileUrl());
                }
            }
        }
        if (imageUrls.isEmpty() && post.getMediaAsset() != null
            && post.getMediaAsset().getFileUrl() != null
            && !post.getMediaAsset().getFileUrl().isBlank()) {
            imageUrls.add(post.getMediaAsset().getFileUrl());
        }

        String message = buildMessage(post);
        Mono<Map<String, Object>> publishMono;

        if (imageUrls.size() > 1) {
            // Multi-photo publishing:
            // 1. Upload each photo to /{page-id}/photos with published=false to obtain media_fbid
            // 2. Publish /{page-id}/feed with attached_media containing all photo IDs
            log.info("Publishing multi-photo post {} ({} images) to Facebook Page {}", postId, imageUrls.size(), credentials.pageId());
            publishMono = Flux.fromIterable(imageUrls)
                .concatMap(url -> uploadUnpublishedPhoto(credentials, url))
                .collectList()
                .flatMap(photoIds -> {
                    List<Map<String, String>> attachedMedia = photoIds.stream()
                        .map(id -> Map.of("media_fbid", id))
                        .toList();

                    Map<String, Object> payload = new HashMap<>();
                    payload.put("access_token", credentials.accessToken());
                    payload.put("message", message);
                    payload.put("attached_media", attachedMedia);

                    return webClient.post()
                        .uri(facebookApiUrl + "/" + credentials.pageId() + "/feed")
                        .bodyValue(payload)
                        .retrieve()
                        .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {});
                });
        } else if (imageUrls.size() == 1) {
            // Single-photo publishing: direct to /{page-id}/photos with url and caption
            log.info("Publishing single-photo post {} to Facebook Page {}", postId, credentials.pageId());
            Map<String, Object> payload = new HashMap<>();
            payload.put("access_token", credentials.accessToken());
            payload.put("url", imageUrls.get(0));
            payload.put("caption", message);

            publishMono = webClient.post()
                .uri(facebookApiUrl + "/" + credentials.pageId() + "/photos")
                .bodyValue(payload)
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {});
        } else {
            // Text-only publishing: direct to /{page-id}/feed with message
            log.info("Publishing text-only post {} to Facebook Page {}", postId, credentials.pageId());
            Map<String, Object> payload = new HashMap<>();
            payload.put("access_token", credentials.accessToken());
            payload.put("message", message);

            publishMono = webClient.post()
                .uri(facebookApiUrl + "/" + credentials.pageId() + "/feed")
                .bodyValue(payload)
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {});
        }

        publishMono
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

    private Mono<String> uploadUnpublishedPhoto(PublishCredentials credentials, String imageUrl) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("access_token", credentials.accessToken());
        payload.put("url", imageUrl);
        payload.put("published", false);

        return webClient.post()
            .uri(facebookApiUrl + "/" + credentials.pageId() + "/photos")
            .bodyValue(payload)
            .retrieve()
            .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
            .map(res -> String.valueOf(res.get("id")));
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
                if (post.getOrganization() != null) {
                    organizationRepository.findById(post.getOrganization().getId()).ifPresent(org -> {
                        org.setFbPageId(null);
                        org.setFbAccessToken(null);
                        organizationRepository.save(org);
                        log.warn("Cleared invalid FB credentials for organization {}", org.getId());
                    });
                } else {
                    userRepository.findById(post.getUser().getId()).ifPresent(user -> {
                        user.setFbPageId(null);
                        user.setFbAccessToken(null);
                        userRepository.save(user);
                        log.warn("Cleared invalid FB credentials for user {}", user.getId());
                    });
                }
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