package com.ugnay.ugnay.post;

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

    @Transactional
    public PostController.PostDto requestAppeal(User user, UUID postId, String type) {
        return postSchedulerService.requestAppeal(user, postId, Post.PostAppealType.valueOf(type));
    }

    @Transactional
    public void resolveAppeal(User user, UUID postId, boolean approve) {
        postSchedulerService.resolveAppeal(user, postId, approve);
    }

    private PostController.PostDto toDto(Post p) {
        return new PostController.PostDto(
            p.getId(), p.getCaption(), p.getHashtags(), p.getTone(),
            p.getStatus().name(),
            p.getScheduledAt() != null ? p.getScheduledAt().toString() : null,
            p.getMediaAsset() != null ? p.getMediaAsset().getFileUrl() : null,
            p.getFbPostId(),
            p.getOrganization() != null ? p.getOrganization().getId() : null,
            p.getUser() != null ? p.getUser().getId() : null,
            p.getAppealType() != null ? p.getAppealType().name() : null,
            p.isEditUnlocked()
        );
    }
}