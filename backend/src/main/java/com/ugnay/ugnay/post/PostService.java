package com.ugnay.ugnay.post;


import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import java.time.Instant;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ugnay.ugnay.core.User;
import com.ugnay.ugnay.facebook.FacebookService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class PostService {

    private final PostRepository postRepository;
    private final FacebookService facebookService;
    private final PostSchedulerService postSchedulerService;

    public List<PostController.PostDto> getPostsByUser(User user) {
        return postRepository.findByUserOrderByCreatedAtDesc(user).stream()
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
        postRepository.findById(postId)
            .filter(p -> p.getUser().getId().equals(user.getId()))
            .ifPresent(postRepository::delete);
    }

    @Transactional
    public PostController.PostDto publishPost(User user, UUID postId) {
        Post post = postRepository.findById(postId)
            .filter(p -> p.getUser().getId().equals(user.getId()))
            .orElseThrow();

        // Build caption with hashtags
        String fullCaption = post.getCaption()
            + (post.getHashtags() != null ? "\n\n" + String.join(" ", post.getHashtags()) : "");

        try {
            String fbPostId = facebookService.publishPost(
                user.getFbAccessToken(), user.getFbPageId(),
                fullCaption, post.getMediaAsset() != null ? post.getMediaAsset().getFileUrl() : null
            );
            post.setFbPostId(fbPostId);
            post.setStatus(Post.PostStatus.PUBLISHED);
            post.setPublishedAt(Instant.now());
        } catch (Exception e) {
            post.setStatus(Post.PostStatus.FAILED);
            log.error("Manual publish failed for post {}", postId, e);
        }

        postRepository.save(post);
        return toDto(post);
    }

    private PostController.PostDto toDto(Post p) {
        return new PostController.PostDto(
            p.getId(), p.getCaption(), p.getHashtags(), p.getTone(),
            p.getStatus().name(),
            p.getScheduledAt() != null ? p.getScheduledAt().toString() : null,
            p.getMediaAsset() != null ? p.getMediaAsset().getFileUrl() : null,
            p.getFbPostId()
        );
    }
}
