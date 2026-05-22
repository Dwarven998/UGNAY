package com.ugnay.ugnay.analytics;


import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.ugnay.ugnay.core.User;
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

    public AnalyticsSummary getSummary(User user) {
        List<Post> posts = postRepository.findByUserOrderByCreatedAtDesc(user);
        long totalPosts = posts.size();
        long publishedPosts = posts.stream()
            .filter(p -> p.getStatus() == Post.PostStatus.PUBLISHED).count();

        List<PostEngagement> engagements = engagementRepository.findByPost_User(user);
        long totalEngagement = engagements.stream()
            .mapToLong(e -> e.getLikes() + e.getComments() + e.getShares()).sum();
        double avgEngagement = publishedPosts > 0 ? (double) totalEngagement / publishedPosts : 0;

        return new AnalyticsSummary(totalPosts, publishedPosts, totalEngagement, avgEngagement);
    }

    public List<TopPostDto> getTopPosts(User user) {
        return engagementRepository.findByPost_UserOrderByTotalEngagementDesc(user).stream()
            .limit(3)
            .map(e -> new TopPostDto(
                e.getPost().getId().toString(),
                e.getPost().getCaption().substring(0, Math.min(80, e.getPost().getCaption().length())),
                e.getLikes() + e.getComments() + e.getShares(),
                e.getPost().getPublishedAt() != null ? e.getPost().getPublishedAt().toString() : null
            ))
            .collect(Collectors.toList());
    }

    public RecommendationDto getPostingRecommendation(User user) {
        // Simple pattern: find what hour most engaged posts were published
        List<PostEngagement> top = engagementRepository.findByPost_UserOrderByTotalEngagementDesc(user);
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

    // DTOs
    public record AnalyticsSummary(long totalPosts, long publishedPosts,
                                   long totalEngagement, double avgEngagement) {}
    public record TopPostDto(String id, String captionPreview, long totalEngagement, String publishedAt) {}
    public record RecommendationDto(String headline, String detail, boolean personalized) {}
}