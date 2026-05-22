package com.ugnay.ugnay.post;


import java.time.Instant;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ugnay.ugnay.core.User;
import com.ugnay.ugnay.facebook.FacebookService;
import com.ugnay.ugnay.media.MediaAsset;
import com.ugnay.ugnay.media.MediaAssetRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class PostService {

    private final PostRepository postRepository;
    private final MediaAssetRepository assetRepository;
    private final FacebookService facebookService;

    public List<PostController.PostDto> getPostsByUser(User user) {
        return postRepository.findByUserOrderByCreatedAtDesc(user).stream()
            .map(this::toDto)
            .collect(Collectors.toList());
    }

    @Transactional
    public PostController.PostDto createPost(User user, PostController.CreatePostRequest req) {
        // Conflict detection: check 30-min window around scheduledAt
        if (req.scheduledAt() != null) {
            Instant desired = Instant.parse(req.scheduledAt());
            Instant windowStart = desired.minusSeconds(1800);
            Instant windowEnd = desired.plusSeconds(1800);
            boolean conflict = postRepository.existsByUserAndScheduledAtBetween(
                user, windowStart, windowEnd);
            if (conflict) throw new IllegalStateException("Schedule conflict detected within 30-minute window");
        }

        MediaAsset asset = req.mediaAssetId() != null
            ? assetRepository.findById(req.mediaAssetId()).orElse(null) : null;

        Post post = Post.builder()
            .user(user)
            .mediaAsset(asset)
            .caption(req.caption())
            .hashtags(req.hashtags())
            .tone(req.tone())
            .status(req.scheduledAt() != null ? Post.PostStatus.SCHEDULED : Post.PostStatus.DRAFT)
            .scheduledAt(req.scheduledAt() != null ? Instant.parse(req.scheduledAt()) : null)
            .build();

        postRepository.save(post);
        return toDto(post);
    }

    @Transactional
    public PostController.PostDto updatePost(User user, UUID postId, PostController.CreatePostRequest req) {
        Post post = postRepository.findById(postId)
            .filter(p -> p.getUser().getId().equals(user.getId()))
            .orElseThrow(() -> new NoSuchElementException("Post not found"));

        post.setCaption(req.caption());
        post.setHashtags(req.hashtags());
        post.setTone(req.tone());
        if (req.scheduledAt() != null) {
            post.setScheduledAt(Instant.parse(req.scheduledAt()));
            post.setStatus(Post.PostStatus.SCHEDULED);
        }
        postRepository.save(post);
        return toDto(post);
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
