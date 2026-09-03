package com.ugnay.ugnay.analytics;


import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.ugnay.ugnay.core.User;
import com.ugnay.ugnay.org.Organization;
import com.ugnay.ugnay.org.OrganizationPermissionService;
import com.ugnay.ugnay.org.OrganizationRepository;
import com.ugnay.ugnay.post.EngagementSyncService;
import com.ugnay.ugnay.post.Post;
import com.ugnay.ugnay.post.PostEngagement;
import com.ugnay.ugnay.post.PostEngagementRepository;
import com.ugnay.ugnay.post.PostRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AnalyticsService {

    private final PostRepository postRepository;
    private final PostEngagementRepository engagementRepository;
    private final OrganizationRepository organizationRepository;
    private final OrganizationPermissionService organizationPermissionService;
    private final EngagementSyncService engagementSyncService;

    public AnalyticsSummary getSummary(User user, UUID orgId) {
        return getSummary(user, orgId, false);
    }

    public AnalyticsSummary getSummary(User user, UUID orgId, boolean forceSync) {
        List<Post> posts = resolveScopedPosts(user, orgId);
        syncEngagement(posts, user, orgId, forceSync);

        long totalPosts = posts.size();
        long publishedPosts = posts.stream()
            .filter(p -> p.getStatus() == Post.PostStatus.PUBLISHED).count();

        List<PostEngagement> engagements = engagementsFor(posts);
        long totalEngagement = engagements.stream()
            .mapToLong(e -> e.getLikes() + e.getComments() + e.getShares()).sum();
        double avgEngagement = publishedPosts > 0 ? (double) totalEngagement / publishedPosts : 0;

        return new AnalyticsSummary(totalPosts, publishedPosts, totalEngagement, avgEngagement);
    }

    public AnalyticsSummary syncNow(User user, UUID orgId) {
        return getSummary(user, orgId, true);
    }

    public List<TopPostDto> getTopPosts(User user, UUID orgId) {
        List<Post> posts = resolveScopedPosts(user, orgId);
        List<UUID> postIds = postIdsOf(posts);
        if (postIds.isEmpty()) {
            return List.of();
        }
        return engagementRepository.findByPost_IdInOrderByTotalEngagementDesc(postIds).stream()
            .limit(3)
            .map(e -> new TopPostDto(
                e.getPost().getId().toString(),
                e.getPost().getCaption().substring(0, Math.min(80, e.getPost().getCaption().length())),
                e.getLikes() + e.getComments() + e.getShares(),
                e.getPost().getPublishedAt() != null ? e.getPost().getPublishedAt().toString() : null
            ))
            .collect(Collectors.toList());
    }

    public RecommendationDto getPostingRecommendation(User user, UUID orgId) {
        List<Post> posts = resolveScopedPosts(user, orgId);
        List<UUID> postIds = postIdsOf(posts);
        List<PostEngagement> top = postIds.isEmpty()
            ? List.of()
            : engagementRepository.findByPost_IdInOrderByTotalEngagementDesc(postIds);
        if (top.size() < 5) {
            return new RecommendationDto("Post at least 5 times to unlock personalized recommendations.",
                "General Tip: Post on weekday afternoons (2–5 PM) for maximum student reach.", false);
        }
        // Analyze top 5 most engaged posts
        Map<Integer, Long> hourCounts = top.stream().limit(5)
            .filter(e -> e.getPost().getPublishedAt() != null)
            .collect(Collectors.groupingBy(
                e -> e.getPost().getPublishedAt().atZone(java.time.ZoneOffset.UTC).getHour(),
                Collectors.counting()
            ));
        int bestHour = hourCounts.entrySet().stream()
            .max(Map.Entry.comparingByValue())
            .map(Map.Entry::getKey).orElse(14);

        String period = bestHour < 12 ? "morning" : bestHour < 17 ? "afternoon" : "evening";
        return new RecommendationDto(
            String.format("Your posts at %d:00 perform best!", bestHour),
            String.format("Post more in the %s (%d:00–%d:00) for maximum Org Yield.", period, bestHour, bestHour + 2),
            true
        );
    }

    /**
     * Resolves the posts visible for this analytics request: either a specific organization
     * (requires the caller to be an approved member of THAT organization) or the caller's own
     * personal, non-org posts. This is the sole gate keeping one organization's analytics from
     * ever being computed from another organization's — or another user's — posts.
     */
    private List<Post> resolveScopedPosts(User user, UUID orgId) {
        if (orgId != null) {
            organizationPermissionService.requireApprovedMember(user.getId(), orgId);
            return postRepository.findByOrganization_IdOrderByCreatedAtDesc(orgId);
        }
        return postRepository.findByUserAndOrganizationIsNullOrderByCreatedAtDesc(user);
    }

    private List<PostEngagement> engagementsFor(List<Post> posts) {
        List<UUID> postIds = postIdsOf(posts);
        return postIds.isEmpty() ? List.of() : engagementRepository.findByPost_IdIn(postIds);
    }

    private List<UUID> postIdsOf(List<Post> posts) {
        return posts.stream().map(Post::getId).collect(Collectors.toList());
    }

    /** Pulls fresh like/comment/share counts from Facebook for this scope's own Page token before the numbers are read. */
    private void syncEngagement(List<Post> posts, User user, UUID orgId) {
        syncEngagement(posts, user, orgId, false);
    }

    private void syncEngagement(List<Post> posts, User user, UUID orgId, boolean forceSync) {
        String accessToken = orgId != null
            ? organizationRepository.findById(orgId).map(Organization::getFbAccessToken).orElse(null)
            : user.getFbAccessToken();
        engagementSyncService.syncPosts(posts, accessToken, forceSync);
    }

    // DTOs
    public record AnalyticsSummary(long totalPosts, long publishedPosts,
                                   long totalEngagement, double avgEngagement) {}
    public record TopPostDto(String id, String captionPreview, long totalEngagement, String publishedAt) {}
    public record RecommendationDto(String headline, String detail, boolean personalized) {}
}
