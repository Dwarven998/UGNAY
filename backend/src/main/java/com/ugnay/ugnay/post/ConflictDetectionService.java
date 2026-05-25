package com.ugnay.ugnay.post;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ConflictDetectionService {

    private static final long WINDOW_SECONDS = 30 * 60;

    private final PostRepository postRepository;

    public Optional<PostConflictDto> findConflict(String orgName, Instant proposedScheduledAt, UUID excludePostId) {
        Instant windowStart = proposedScheduledAt.minusSeconds(WINDOW_SECONDS);
        Instant windowEnd = proposedScheduledAt.plusSeconds(WINDOW_SECONDS);

        return postRepository.findConflictingScheduledPosts(orgName, windowStart, windowEnd, excludePostId)
            .stream()
            .findFirst()
            .map(post -> new PostConflictDto(
                post.getId(),
                post.getCaption(),
                post.getScheduledAt() != null ? post.getScheduledAt().toString() : null,
                post.getStatus() != null ? post.getStatus().name() : null,
                post.getMediaAsset() != null ? post.getMediaAsset().getFileUrl() : null
            ));
    }
}