package com.ugnay.ugnay.post;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
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

        List<String> imageUrls = new ArrayList<>();
        if (post.getMediaAssets() != null && !post.getMediaAssets().isEmpty()) {
            for (MediaAsset asset : post.getMediaAssets()) {
                if (asset != null && asset.getFileUrl() != null && !asset.getFileUrl().isBlank()) {
                    imageUrls.add(asset.getFileUrl());
                }
            }
        } else if (post.getMediaAsset() != null
            && post.getMediaAsset().getFileUrl() != null
            && !post.getMediaAsset().getFileUrl().isBlank()) {
            imageUrls.add(post.getMediaAsset().getFileUrl());
        }

        String message = buildMessage(post);

        try {

            log.info(
                "Publishing UGNAY post {} with {} image(s) to Facebook{}",
                postId,
                imageUrls.size(),
                manualTrigger ? " (manual trigger)" : ""
            );

            String facebookPostId = facebookService.publishPost(
                credentials.accessToken(),
                credentials.pageId(),
                message,
                imageUrls
            );

            if (facebookPostId == null || facebookPostId.isBlank()) {
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

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markPublished(
        UUID postId,
        String facebookPostId
    ) {

        postRepository.findDetailedById(postId)
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

                List<MediaAsset> assetsToRelease = new ArrayList<>();
                if (post.getMediaAssets() != null && !post.getMediaAssets().isEmpty()) {
                    assetsToRelease.addAll(post.getMediaAssets());
                    post.getMediaAssets().clear();
                } else if (post.getMediaAsset() != null) {
                    assetsToRelease.add(post.getMediaAsset());
                }

                post.setMediaAsset(null);

                postRepository.saveAndFlush(post);

                for (MediaAsset asset : assetsToRelease) {
                    try {
                        mediaService.releasePublishedAsset(asset.getId());
                    } catch (Exception ex) {
                        log.warn(
                            "Failed to release published asset {} for post {}: {}",
                            asset.getId(),
                            postId,
                            ex.getMessage()
                        );
                    }
                }

                log.info(
                    "Published post {}, facebookPostId={}",
                    postId,
                    facebookPostId
                );
            });
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markFailed(
        UUID postId,
        Throwable error
    ) {

        postRepository.findById(postId)
            .ifPresent(post -> {

                post.setStatus(
                    Post.PostStatus.FAILED
                );

                postRepository.saveAndFlush(post);

                if (error instanceof WebClientResponseException wce) {
                    log.error(
                        "Failed to publish post {} to Facebook [HTTP {}]: {}. Facebook credentials preserved.",
                        postId,
                        wce.getStatusCode(),
                        wce.getResponseBodyAsString(),
                        error
                    );
                } else {
                    log.error(
                        "Failed to publish post {} to Facebook. Facebook credentials preserved.",
                        postId,
                        error
                    );
                }
            });
    }
}