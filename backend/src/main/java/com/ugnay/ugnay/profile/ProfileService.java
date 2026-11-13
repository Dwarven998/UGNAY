package com.ugnay.ugnay.profile;

import com.ugnay.ugnay.core.User;
import com.ugnay.ugnay.core.UserRepository;
import com.ugnay.ugnay.media.MediaAsset;
import com.ugnay.ugnay.org.Organization;
import com.ugnay.ugnay.org.OrganizationMembership;
import com.ugnay.ugnay.org.OrganizationMembershipRepository;
import com.ugnay.ugnay.post.Post;
import com.ugnay.ugnay.post.PostRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Builds the signed-in user's own profile. Data isolation rules:
 * <ul>
 *   <li>The only input is the authenticated user's id; nothing from the request selects whose data is read.</li>
 *   <li>Responses are explicit DTOs — no entity is serialized, so password hashes, Facebook tokens and
 *       organization join codes can never leak.</li>
 *   <li>Posts are limited to the user's own posts in places they can still reach (see
 *       {@link PostRepository#findAuthoredByUserInReach}).</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class ProfileService {

    /** Most recent posts returned; the counts always cover every post. */
    static final int RECENT_POST_LIMIT = 100;
    private static final int CAPTION_PREVIEW_CHARS = 280;

    private final UserRepository userRepository;
    private final OrganizationMembershipRepository membershipRepository;
    private final PostRepository postRepository;

    @Transactional(readOnly = true)
    public ProfileDto load(UUID userId) {
        User user = userRepository.findById(userId).orElseThrow();

        List<MembershipDto> memberships = membershipRepository.findByUserId(userId).stream()
            .map(ProfileService::toMembership)
            .sorted(Comparator.comparing(MembershipDto::status)
                .thenComparing(MembershipDto::orgName, String.CASE_INSENSITIVE_ORDER))
            .toList();

        Map<Post.PostStatus, Long> counts = new EnumMap<>(Post.PostStatus.class);
        for (Object[] row : postRepository.countAuthoredByUserInReachByStatus(userId)) {
            counts.put((Post.PostStatus) row[0], (Long) row[1]);
        }
        long total = counts.values().stream().mapToLong(Long::longValue).sum();
        PostStatsDto stats = new PostStatsDto(
            total,
            counts.getOrDefault(Post.PostStatus.PUBLISHED, 0L),
            counts.getOrDefault(Post.PostStatus.SCHEDULED, 0L),
            counts.getOrDefault(Post.PostStatus.DRAFT, 0L),
            counts.getOrDefault(Post.PostStatus.PENDING_REVIEW, 0L),
            counts.getOrDefault(Post.PostStatus.REJECTED, 0L),
            counts.getOrDefault(Post.PostStatus.FAILED, 0L));

        List<PostSummaryDto> posts = postRepository
            .findAuthoredByUserInReach(userId, PageRequest.of(0, RECENT_POST_LIMIT)).stream()
            .map(ProfileService::toPostSummary)
            .toList();

        return new ProfileDto(user.getEmail(), user.getPasswordChangedAt(), memberships, stats, posts, RECENT_POST_LIMIT);
    }

    private static MembershipDto toMembership(OrganizationMembership m) {
        Organization org = m.getOrganization();
        return new MembershipDto(org.getId(), org.getName(), org.getType(), m.getRole(), m.getStatus(),
            m.getRequestedAt(), m.getJoinedAt());
    }

    private static PostSummaryDto toPostSummary(Post p) {
        Organization org = p.getOrganization();
        String caption = p.getCaption() == null ? "" : p.getCaption().strip();
        if (caption.length() > CAPTION_PREVIEW_CHARS) {
            caption = caption.substring(0, CAPTION_PREVIEW_CHARS).stripTrailing() + "…";
        }
        return new PostSummaryDto(p.getId(), caption, p.getStatus(),
            org == null ? null : org.getId(), org == null ? null : org.getName(),
            p.getCreatedAt(), p.getScheduledAt(), p.getPublishedAt(), firstMediaUrl(p));
    }

    private static String firstMediaUrl(Post p) {
        if (p.getMediaAssets() != null && !p.getMediaAssets().isEmpty()) {
            MediaAsset first = p.getMediaAssets().get(0);
            if (first != null) return first.getFileUrl();
        }
        return p.getMediaAsset() == null ? null : p.getMediaAsset().getFileUrl();
    }

    // --- DTOs ---

    public record ProfileDto(
        String email,
        Instant passwordChangedAt,
        List<MembershipDto> memberships,
        PostStatsDto postStats,
        List<PostSummaryDto> recentPosts,
        int recentPostLimit
    ) {}

    public record MembershipDto(
        UUID orgId,
        String orgName,
        Organization.OrgType orgType,
        OrganizationMembership.OrgRole role,
        OrganizationMembership.MembershipStatus status,
        Instant requestedAt,
        Instant joinedAt
    ) {}

    public record PostStatsDto(
        long total,
        long published,
        long scheduled,
        long drafts,
        long pendingReview,
        long rejected,
        long failed
    ) {}

    public record PostSummaryDto(
        UUID id,
        String caption,
        Post.PostStatus status,
        UUID orgId,
        String orgName,
        Instant createdAt,
        Instant scheduledAt,
        Instant publishedAt,
        String mediaUrl
    ) {}
}
