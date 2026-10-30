package com.ugnay.ugnay.analytics;

import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.ugnay.ugnay.core.User;
import com.ugnay.ugnay.org.ConnectedPageResolver;
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

    private static final ZoneId MANILA_ZONE = ZoneId.of("Asia/Manila");

    private final PostRepository postRepository;
    private final PostEngagementRepository engagementRepository;
    private final OrganizationRepository organizationRepository;
    private final OrganizationPermissionService permissionService;
    private final ConnectedPageResolver connectedPageResolver;
    private final EngagementSyncService engagementSyncService;

    /** Answers from stored engagement right away; a fresh Facebook sync runs in the background for the next poll. */
    public AnalyticsSummary getSummary(User user, UUID orgId) {
        List<Post> posts = resolveScopedPosts(user, orgId);
        syncEngagement(posts, user, orgId);

        long totalPosts = posts.size();
        long publishedPosts = posts.stream()
            .filter(p -> p.getStatus() == Post.PostStatus.PUBLISHED).count();

        List<PostEngagement> engagements = engagementsFor(posts);
        long totalEngagement = engagements.stream()
            .mapToLong(e -> e.getLikes() + e.getComments() + e.getShares()).sum();
        double avgEngagement = publishedPosts > 0 ? (double) totalEngagement / publishedPosts : 0;

        return new AnalyticsSummary(totalPosts, publishedPosts, totalEngagement, avgEngagement);
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
        if (orgId != null) {
            permissionService.requireApprovedMember(user.getId(), orgId);
        }
        String pageId = connectedPageResolver.currentPageId(user, orgId);
        if (pageId == null) {
            return new RecommendationDto(
                "Post at least 5 times to unlock personalized recommendations.",
                "General Tip: Post on weekday afternoons (2-5 PM) for maximum student reach.",
                false
            );
        }

        List<Post> posts = postRepository.findInScope(orgId, user, pageId);
        List<Post> publishedPosts = posts.stream()
            .filter(p -> p.getStatus() == Post.PostStatus.PUBLISHED)
            .toList();

        List<UUID> postIds = publishedPosts.stream()
            .map(Post::getId)
            .toList();

        if (postIds.isEmpty()) {
            return new RecommendationDto(
                "Post at least 5 times to unlock personalized recommendations.",
                "General Tip: Post on weekday afternoons (2-5 PM) for maximum student reach.",
                false
            );
        }

        List<PostEngagement> engagements = engagementRepository.findByPost_IdInOrderByTotalEngagementDesc(postIds);

        List<PostEngagement> validEngagements = engagements.stream()
            .filter(e -> e.getPost() != null && e.getPost().getPublishedAt() != null)
            .toList();

        if (validEngagements.size() < 5) {
            return new RecommendationDto(
                "Post at least 5 times to unlock personalized recommendations.",
                "General Tip: Post on weekday afternoons (2-5 PM) for maximum student reach.",
                false
            );
        }

        List<PostEngagement> top5 = validEngagements.stream()
            .limit(5)
            .toList();

        Map<Integer, Long> hourCounts = new LinkedHashMap<>();
        for (PostEngagement e : top5) {
            int hour = e.getPost().getPublishedAt().atZone(MANILA_ZONE).getHour();
            hourCounts.put(hour, hourCounts.getOrDefault(hour, 0L) + 1L);
        }

        int bestHour = 14;
        long maxCount = 0;
        for (Map.Entry<Integer, Long> entry : hourCounts.entrySet()) {
            if (entry.getValue() > maxCount) {
                maxCount = entry.getValue();
                bestHour = entry.getKey();
            }
        }

        String targetHourStr = formatHour12(bestHour);
        String endHourStr = formatHour12(bestHour + 2);
        String window = targetHourStr + "-" + endHourStr;

        return new RecommendationDto(
            String.format("Your posts at %s perform best!", targetHourStr),
            String.format("Try scheduling your next posts between %s for maximum reach.", window),
            true
        );
    }

    private static String formatHour12(int hour24) {
        int normalized = ((hour24 % 24) + 24) % 24;
        int h = normalized % 12;
        if (h == 0) {
            h = 12;
        }
        String ampm = normalized < 12 ? "AM" : "PM";
        return h + " " + ampm;
    }

    /**
     * Resolves the posts visible for this analytics request: either a specific organization
     * (requires the caller to be an approved member of THAT organization) or the caller's own
     * personal, non-org posts, limited to the Facebook Page currently connected to that workspace.
     * This is the sole gate keeping one organization's or Page's analytics from ever being computed
     * from another organization's, another Page's, or another user's posts.
     */
    private List<Post> resolveScopedPosts(User user, UUID orgId) {
        String pageId = connectedPageResolver.currentPageId(user, orgId);
        if (pageId == null) {
            return List.of();
        }
        return postRepository.findInScope(orgId, user, pageId);
    }

    private List<PostEngagement> engagementsFor(List<Post> posts) {
        List<UUID> postIds = postIdsOf(posts);
        return postIds.isEmpty() ? List.of() : engagementRepository.findByPost_IdIn(postIds);
    }

    private List<UUID> postIdsOf(List<Post> posts) {
        return posts.stream().map(Post::getId).collect(Collectors.toList());
    }

    /** Starts a background pull of fresh like/comment/share counts from Facebook using this scope's own Page token. */
    private void syncEngagement(List<Post> posts, User user, UUID orgId) {
        String accessToken = orgId != null
            ? organizationRepository.findById(orgId).map(Organization::getFbAccessToken).orElse(null)
            : user.getFbAccessToken();
        String pageId = ConnectedPageResolver.normalize(orgId != null
            ? organizationRepository.findById(orgId).map(Organization::getFbPageId).orElse(null)
            : user.getFbPageId());
        String scopeKey = (orgId != null ? "org:" + orgId : "user:" + user.getId()) + "|page:" + pageId;
        engagementSyncService.syncPostsInBackground(scopeKey, posts, accessToken);
    }

    // DTOs
    public record AnalyticsSummary(long totalPosts, long publishedPosts,
                                   long totalEngagement, double avgEngagement) {}
    public record TopPostDto(String id, String captionPreview, long totalEngagement, String publishedAt) {}
    public record RecommendationDto(String headline, String detail, boolean personalized) {}
}
