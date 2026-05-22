package com.ugnay.ugnay.post;


import java.time.Instant;
import java.util.List;

import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.ugnay.ugnay.facebook.FacebookService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Component
@EnableScheduling
@RequiredArgsConstructor
@Slf4j
public class PostSchedulerJob {

    private final PostRepository postRepository;
    private final FacebookService facebookService;

    // Run every minute
    @Scheduled(fixedRate = 60_000)
    public void publishDuePosts() {
        List<Post> duePosts = postRepository
            .findByStatusAndScheduledAtBefore(Post.PostStatus.SCHEDULED, Instant.now());

        for (Post post : duePosts) {
            try {
                String caption = post.getCaption()
                    + (post.getHashtags() != null ? "\n\n" + String.join(" ", post.getHashtags()) : "");
                String fbPostId = facebookService.publishPost(
                    post.getUser().getFbAccessToken(),
                    post.getUser().getFbPageId(),
                    caption,
                    post.getMediaAsset() != null ? post.getMediaAsset().getFileUrl() : null
                );
                post.setFbPostId(fbPostId);
                post.setStatus(Post.PostStatus.PUBLISHED);
                post.setPublishedAt(Instant.now());
                log.info("Published post {}", post.getId());
            } catch (Exception e) {
                post.setStatus(Post.PostStatus.FAILED);
                log.error("Failed to publish post {}: {}", post.getId(), e.getMessage());
            }
            postRepository.save(post);
        }
    }
}