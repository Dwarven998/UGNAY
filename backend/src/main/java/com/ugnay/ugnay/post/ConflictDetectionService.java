package com.ugnay.ugnay.post;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.ugnay.ugnay.core.User;
import com.ugnay.ugnay.org.Organization;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ConflictDetectionService {

    private static final long WINDOW_SECONDS = 30 * 60;

    private final PostRepository postRepository;

    /**
     * Finds a post already scheduled close to the proposed time in the SAME workspace on the SAME Facebook
     * Page. Posts of other Pages (or other organizations) are never considered, so a conflict can't reveal them.
     */
    public Optional<PostConflictDto> findConflict(User user, Organization organization, String pageId,
                                                  Instant proposedScheduledAt, UUID excludePostId) {
        if (pageId == null) {
            return Optional.empty();
        }
        Instant windowStart = proposedScheduledAt.minusSeconds(WINDOW_SECONDS);
        Instant windowEnd = proposedScheduledAt.plusSeconds(WINDOW_SECONDS);

        List<Post> conflicts = organization != null
            ? postRepository.findConflictingScheduledPostsForOrganization(organization.getId(), pageId, windowStart, windowEnd, excludePostId)
            : postRepository.findConflictingScheduledPostsForUser(user, pageId, windowStart, windowEnd, excludePostId);

        return conflicts.stream()
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
