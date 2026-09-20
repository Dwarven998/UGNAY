package com.ugnay.ugnay.post;

import java.time.Instant;
import java.util.UUID;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import com.ugnay.ugnay.core.User;
import com.ugnay.ugnay.core.UserRepository;
import com.ugnay.ugnay.facebook.FacebookService;
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

    private final PostRepository postRepository;
    private final UserRepository userRepository;
    private final OrganizationRepository organizationRepository;
    private final MediaService mediaService;
    private final FacebookService facebookService;

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
        String imageUrl = hasImage
            ? post.getMediaAsset().getFileUrl()
            : null;

        try {

            log.info(
                "Publishing UGNAY post {} to Facebook{}",
                postId,
                manualTrigger ? " (manual trigger)" : ""
            );

            String facebookPostId = facebookService.publishPost(
                credentials.accessToken(),
                credentials.pageId(),
                message,
                imageUrl
            );

            if (facebookPostId == null
                || facebookPostId.isBlank()) {

                throw new IllegalStateException(
                    "Facebook returned an empty post ID"
                );
            }

            markPublished(postId, facebookPostId);

            log.info(
                "UGNAY post {} successfully published to Facebook, facebookPostId={}",
                postId,
                facebookPostId
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
        String facebookPostId
    ) {

        postRepository.findById(postId)
            .ifPresent(post -> {

                post.setStatus(
                    Post.PostStatus.PUBLISHED
                );

                post.setPublishedAt(
                    Instant.now()
                );

                if (facebookPostId != null) {

                    post.setFbPostId(facebookPostId);
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
                    "Published post {}, facebookPostId={}",
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
                    "Failed to publish post {} to Facebook",
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