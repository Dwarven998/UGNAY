package com.ugnay.ugnay.post;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ugnay.ugnay.core.User;
import com.ugnay.ugnay.org.OrganizationPermissionService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class PostService {

    private final PostRepository postRepository;
    private final PostSchedulerService postSchedulerService;
    private final OrganizationPermissionService organizationPermissionService;

    @Transactional(readOnly = true)
    public List<PostController.PostDto> getPostsByUser(User user, UUID orgId) {
        if (orgId != null) {
            organizationPermissionService.requireApprovedMember(user.getId(), orgId);
        }
        List<Post> posts = orgId != null
            ? postRepository.findByOrganization_IdOrderByCreatedAtDesc(orgId)
            : postRepository.findByUserAndOrganizationIsNullOrderByCreatedAtDesc(user);
        return posts.stream()
            .map(this::toDto)
            .collect(Collectors.toList());
    }

    @Transactional
    public PostController.PostDto createPost(User user, PostController.CreatePostRequest req) {
        return postSchedulerService.createPost(user, req);
    }

    @Transactional
    public PostController.PostDto updatePost(User user, UUID postId, PostController.CreatePostRequest req) {
        return postSchedulerService.updatePost(user, postId, req);
    }

    @Transactional
    public void deletePost(User user, UUID postId) {
        postSchedulerService.deletePost(user, postId);
    }

    public List<PostController.PostDto> getPendingForModeration(User user, UUID orgId) {
        return postSchedulerService.listPendingForModeration(user, orgId);
    }

    @Transactional
    public PostController.PostDto approvePost(User user, UUID postId) {
        return postSchedulerService.approvePost(user, postId);
    }

    @Transactional
    public PostController.PostDto rejectPost(User user, UUID postId) {
        return postSchedulerService.rejectPost(user, postId);
    }

    @Transactional
    public PostController.PostDto publishPost(User user, UUID postId) {
        // Delegates entirely to PostSchedulerService → FacebookPublishingJob
        // which uses findDetailedById (eager fetch) and the correct FB endpoint
        postSchedulerService.publishNow(user, postId);

        // Return the latest state after publish attempt
        return postRepository.findDetailedById(postId)
            .map(this::toDto)
            .orElseThrow();
    }

    private PostController.PostDto toDto(Post p) {
        List<String> mediaUrls = new ArrayList<>();
        List<UUID> mediaAssetIds = new ArrayList<>();
        if (p.getMediaAssets() != null && !p.getMediaAssets().isEmpty()) {
            for (com.ugnay.ugnay.media.MediaAsset a : p.getMediaAssets()) {
                if (a != null) {
                    mediaUrls.add(a.getFileUrl());
                    mediaAssetIds.add(a.getId());
                }
            }
        } else if (p.getMediaAsset() != null) {
            mediaUrls.add(p.getMediaAsset().getFileUrl());
            mediaAssetIds.add(p.getMediaAsset().getId());
        }

        String primaryMediaUrl = p.getMediaAsset() != null
            ? p.getMediaAsset().getFileUrl()
            : (!mediaUrls.isEmpty() ? mediaUrls.get(0) : null);

        return new PostController.PostDto(
            p.getId(), p.getCaption(), p.getHashtags(), p.getTone(),
            p.getStatus().name(),
            p.getScheduledAt() != null ? p.getScheduledAt().toString() : null,
            primaryMediaUrl,
            mediaUrls,
            mediaAssetIds,
            p.getFbPostId(),
            p.getOrganization() != null ? p.getOrganization().getId() : null
        );
    }
}