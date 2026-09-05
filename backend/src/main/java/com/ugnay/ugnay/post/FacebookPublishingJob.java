package com.ugnay.ugnay.post;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import com.ugnay.ugnay.core.User;
import com.ugnay.ugnay.core.UserRepository;
import com.ugnay.ugnay.media.MediaAsset;
import com.ugnay.ugnay.media.MediaService;
import com.ugnay.ugnay.org.Organization;
import com.ugnay.ugnay.org.OrganizationRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Component
@RequiredArgsConstructor
@Slf4j
public class FacebookPublishingJob {

    private static final Duration N8N_TIMEOUT = Duration.ofSeconds(60);

    @Value("${n8n.facebook.publish.webhook-url}")
    private String n8nWebhookUrl;

    @Value("${n8n.facebook.publish.webhook-secret:}")
    private String n8nWebhookSecret;

    private final PostRepository postRepository;
    private final UserRepository userRepository;
    private final OrganizationRepository organizationRepository;
    private final MediaService mediaService;

    private final WebClient webClient = WebClient.builder().build();

    /**
     * Resolves the Facebook Page credentials for the post.
     * Organization-scoped posts use the organization's Facebook Page.
     * Legacy non-organization posts use the author's Facebook Page.
     */
    private record PublishCredentials(
        String pageId,
        String accessToken,
        boolean orgScoped
    ) {}

    public void publishScheduledPost(UUID postId) {
        publishInternal(postId, false);
    }

    public void publishImmediately(UUID postId) {
        publishInternal(postId, true);
    }

    private void publishInternal(UUID postId, boolean manualTrigger) {

        Post post = postRepository.findDetailedById(postId)
            .orElseThrow(() ->
                new IllegalArgumentException("Post not found")
            );

        User user = userRepository.findById(post.getUser().getId())
            .orElseThrow(() ->
                new IllegalArgumentException("User not found")
            );

        PublishCredentials credentials =
            resolveCredentials(post, user);

        if (credentials.pageId() == null
            || credentials.pageId().isBlank()
            || credentials.accessToken() == null
            || credentials.accessToken().isBlank()) {

            markFailed(
                postId,
                new IllegalStateException(
                    "Facebook Page connection is missing"
                )
            );

            return;
        }

        boolean hasImage =
            post.getMediaAsset() != null
            && post.getMediaAsset().getFileUrl() != null
            && !post.getMediaAsset().getFileUrl().isBlank();

        String message = buildMessage(post);

        /*
         * Important:
         *
         * UGNAY already handles scheduling through
         * PostSchedulerService. Therefore, when this method
         * is called at the scheduled time, n8n should publish
         * immediately rather than schedule another Facebook post.
         *
         * We therefore send scheduledPublishTime as null.
         */

        Map<String, Object> payload = new HashMap<>();

        payload.put("postId", post.getId().toString());
        payload.put("pageId", credentials.pageId());
        payload.put("pageAccessToken", credentials.accessToken());
        payload.put("caption", message);

        payload.put(
            "imageUrl",
            hasImage
                ? post.getMediaAsset().getFileUrl()
                : ""
        );

        payload.put(
            "scheduledPublishTime",
            null
        );

        payload.put(
            "manualTrigger",
            manualTrigger
        );

        try {

            log.info(
                "Sending UGNAY post {} to n8n for Facebook publishing",
                postId
            );

            Map<String, Object> response = webClient.post()
                .uri(n8nWebhookUrl)
                .contentType(MediaType.APPLICATION_JSON)
                .headers(headers -> {

                    if (n8nWebhookSecret != null
                        && !n8nWebhookSecret.isBlank()) {

                        headers.set(
                            "X-UGNAY-Webhook-Secret",
                            n8nWebhookSecret
                        );
                    }
                })
                .bodyValue(payload)
                .retrieve()
                .bodyToMono(
                    new ParameterizedTypeReference<
                        Map<String, Object>
                    >() {}
                )
                .timeout(N8N_TIMEOUT)
                .block();

            if (response == null) {

                throw new IllegalStateException(
                    "n8n returned an empty response"
                );
            }

            boolean success =
                Boolean.TRUE.equals(response.get("success"));

            if (!success) {

                Object error = response.get("error");

                throw new IllegalStateException(
                    error != null
                        ? String.valueOf(error)
                        : "n8n failed to publish the Facebook post"
                );
            }

            markPublished(postId, response);

            log.info(
                "UGNAY post {} successfully published through n8n",
                postId
            );

        } catch (Exception error) {

            markFailed(postId, error);

        }
    }

    private PublishCredentials resolveCredentials(
        Post post,
        User user
    ) {

        Organization organization = post.getOrganization();

        if (organization != null) {

            return new PublishCredentials(
                organization.getFbPageId(),
                organization.getFbAccessToken(),
                true
            );
        }

        return new PublishCredentials(
            user.getFbPageId(),
            user.getFbAccessToken(),
            false
        );
    }

    private String buildMessage(Post post) {

        String hashtags =
            post.getHashtags() != null
            && post.getHashtags().length > 0

            ? "\n\n"
                + String.join(
                    " ",
                    post.getHashtags()
                )

            : "";

        return post.getCaption() + hashtags;
    }

    @Transactional
    protected void markPublished(
        UUID postId,
        Map<String, Object> response
    ) {

        postRepository.findById(postId)
            .ifPresent(post -> {

                post.setStatus(
                    Post.PostStatus.PUBLISHED
                );

                post.setPublishedAt(
                    Instant.now()
                );

                Object facebookPostId =
                    response.get("facebookPostId");

                /*
                 * Fallback for the raw Facebook response
                 * returned by the n8n workflow.
                 */
                if (facebookPostId == null) {

                    Object facebook =
                        response.get("facebook");

                    if (facebook instanceof Map<?, ?> fb) {

                        Object nestedId =
                            fb.get("post_id") != null
                                ? fb.get("post_id")
                                : fb.get("id");

                        facebookPostId = nestedId;
                    }
                }

                if (facebookPostId != null) {

                    post.setFbPostId(
                        String.valueOf(
                            facebookPostId
                        )
                    );
                }

                MediaAsset publishedAsset =
                    post.getMediaAsset();

                post.setMediaAsset(null);

                postRepository.save(post);

                if (publishedAsset != null) {

                    mediaService.releasePublishedAsset(
                        publishedAsset.getId()
                    );
                }

                log.info(
                    "Published post {} through n8n, facebookPostId={}",
                    postId,
                    facebookPostId
                );
            });
    }

    @Transactional
    protected void markFailed(
        UUID postId,
        Throwable error
    ) {

        postRepository.findById(postId)
            .ifPresent(post -> {

                post.setStatus(
                    Post.PostStatus.FAILED
                );

                postRepository.save(post);

                /*
                 * Only clear Facebook credentials when the
                 * actual Facebook authorization appears invalid.
                 */
                if (isConnectionInvalid(error)) {

                    if (post.getOrganization() != null) {

                        organizationRepository
                            .findById(
                                post.getOrganization().getId()
                            )
                            .ifPresent(org -> {

                                org.setFbPageId(null);
                                org.setFbAccessToken(null);

                                organizationRepository.save(org);

                                log.warn(
                                    "Cleared invalid Facebook credentials for organization {}",
                                    org.getId()
                                );
                            });

                    } else {

                        userRepository
                            .findById(
                                post.getUser().getId()
                            )
                            .ifPresent(user -> {

                                user.setFbPageId(null);
                                user.setFbAccessToken(null);

                                userRepository.save(user);

                                log.warn(
                                    "Cleared invalid Facebook credentials for user {}",
                                    user.getId()
                                );
                            });
                    }
                }

                log.error(
                    "Failed to publish post {} through n8n",
                    postId,
                    error
                );
            });
    }

    private boolean isConnectionInvalid(
        Throwable error
    ) {

        if (error instanceof WebClientResponseException webClientError) {

            int status =
                webClientError
                    .getStatusCode()
                    .value();

            if (status == 401 || status == 403) {
                return true;
            }

            String body =
                webClientError
                    .getResponseBodyAsString();

            return body != null
                && (
                    body.contains("OAuthException")
                    || body.contains("190")
                    || body.contains(
                        "Invalid OAuth access token"
                    )
                );
        }

        return false;
    }
}