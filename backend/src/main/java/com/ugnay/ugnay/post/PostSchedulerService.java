package com.ugnay.ugnay.post;

import java.time.Instant;
import java.util.Date;
import java.util.NoSuchElementException;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;

import org.springframework.context.event.EventListener;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ugnay.ugnay.core.User;
import com.ugnay.ugnay.media.MediaAsset;
import com.ugnay.ugnay.media.MediaAssetRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class PostSchedulerService {

    private final PostRepository postRepository;
    private final MediaAssetRepository assetRepository;
    private final ConflictDetectionService conflictDetectionService;
    private final FacebookPublishingJob facebookPublishingJob;
    private final TaskScheduler postTaskScheduler;
    private final ConcurrentHashMap<UUID, ScheduledFuture<?>> scheduledTasks = new ConcurrentHashMap<>();

    @EventListener(ApplicationReadyEvent.class)
    public void restoreScheduledPosts() {
        Instant now = Instant.now();
        postRepository.findByStatusAndScheduledAtAfterOrderByScheduledAtAsc(Post.PostStatus.SCHEDULED, now)
            .forEach(this::schedulePost);
    }

    @Transactional
    public PostController.PostDto createPost(User user, PostController.CreatePostRequest req) {
        Post post = buildPost(user, req, null);
        postRepository.save(post);
        schedulePost(post);
        return toDto(post);
    }

    @Transactional
    public PostController.PostDto updatePost(User user, UUID postId, PostController.CreatePostRequest req) {
        Post post = postRepository.findDetailedById(postId)
            .filter(existing -> existing.getUser().getId().equals(user.getId()))
            .orElseThrow(() -> new NoSuchElementException("Post not found"));

        cancelScheduledTask(post.getId());

        applyRequest(post, user, req, post.getId());
        postRepository.save(post);
        schedulePost(post);
        return toDto(post);
    }

    @Transactional
    public void deletePost(User user, UUID postId) {
        postRepository.findDetailedById(postId)
            .filter(existing -> existing.getUser().getId().equals(user.getId()))
            .ifPresent(post -> {
                cancelScheduledTask(post.getId());
                postRepository.delete(post);
            });
    }

    @Transactional
    public void publishNow(User user, UUID postId) {
        postRepository.findDetailedById(postId)
            .filter(existing -> existing.getUser().getId().equals(user.getId()))
            .ifPresent(post -> {
                cancelScheduledTask(post.getId());
                facebookPublishingJob.publishImmediately(post.getId());
            });
    }

    private Post buildPost(User user, PostController.CreatePostRequest req, UUID excludePostId) {
        Post post = new Post();
        applyRequest(post, user, req, excludePostId);
        return post;
    }

    private void applyRequest(Post post, User user, PostController.CreatePostRequest req, UUID excludePostId) {
        Instant scheduledAt = parseScheduledAt(req.scheduledAt());
        if (scheduledAt != null) {
            conflictDetectionService.findConflict(user.getOrgName(), scheduledAt, excludePostId)
                .ifPresent(conflict -> { throw new SchedulingConflictException(conflict); });
        }

        MediaAsset asset = req.mediaAssetId() != null
            ? assetRepository.findById(req.mediaAssetId()).orElse(null)
            : post.getMediaAsset();

        post.setUser(user);
        post.setMediaAsset(asset);
        post.setCaption(req.caption());
        post.setHashtags(req.hashtags());
        post.setTone(req.tone());
        post.setScheduledAt(scheduledAt);
        post.setStatus(scheduledAt != null ? Post.PostStatus.SCHEDULED : Post.PostStatus.DRAFT);
        if (scheduledAt == null) {
            post.setPublishedAt(null);
            post.setFbPostId(null);
        }
    }

    private Instant parseScheduledAt(String scheduledAt) {
        if (scheduledAt == null || scheduledAt.isBlank()) {
            return null;
        }
        return Instant.parse(scheduledAt);
    }

    private void schedulePost(Post post) {
        if (post.getScheduledAt() == null || !Post.PostStatus.SCHEDULED.equals(post.getStatus())) {
            return;
        }

        Instant scheduledAt = post.getScheduledAt();
        if (scheduledAt.isBefore(Instant.now())) {
            facebookPublishingJob.publishScheduledPost(post.getId());
            return;
        }

        ScheduledFuture<?> future = postTaskScheduler.schedule(
            () -> facebookPublishingJob.publishScheduledPost(post.getId()),
            Date.from(scheduledAt)
        );
        if (future != null) {
            scheduledTasks.put(post.getId(), future);
        }
    }

    private void cancelScheduledTask(UUID postId) {
        ScheduledFuture<?> future = scheduledTasks.remove(postId);
        if (future != null) {
            future.cancel(false);
        }
    }

    private PostController.PostDto toDto(Post post) {
        return new PostController.PostDto(
            post.getId(),
            post.getCaption(),
            post.getHashtags(),
            post.getTone(),
            post.getStatus().name(),
            post.getScheduledAt() != null ? post.getScheduledAt().toString() : null,
            post.getMediaAsset() != null ? post.getMediaAsset().getFileUrl() : null,
            post.getFbPostId()
        );
    }
}