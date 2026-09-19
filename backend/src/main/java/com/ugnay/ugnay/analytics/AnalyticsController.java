package com.ugnay.ugnay.analytics;


import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.ugnay.ugnay.core.User;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/analytics")
@RequiredArgsConstructor
public class AnalyticsController {

    private final AnalyticsService analyticsService;
    private final AnalyticsDashboardService dashboardService;

    @GetMapping("/summary")
    public ResponseEntity<AnalyticsService.AnalyticsSummary> getSummary(
            @AuthenticationPrincipal User user,
            @RequestParam(required = false) UUID orgId) {
        return ResponseEntity.ok(analyticsService.getSummary(user, orgId));
    }

    /** Everything the Analytics panel shows, from one consistent snapshot. */
    @GetMapping("/dashboard")
    public ResponseEntity<AnalyticsDtos.Dashboard> getDashboard(
            @AuthenticationPrincipal User user,
            @RequestParam(required = false) UUID orgId,
            @RequestParam(defaultValue = "28") int days) {
        return ResponseEntity.ok(dashboardService.getDashboard(user, orgId, days));
    }

    /** Live insights and every comment for one post of the caller's own Page. */
    @GetMapping("/posts/{fbPostId}")
    public ResponseEntity<AnalyticsDtos.PostDetail> getPostDetail(
            @AuthenticationPrincipal User user,
            @PathVariable String fbPostId,
            @RequestParam(required = false) UUID orgId) {
        return ResponseEntity.ok(dashboardService.getPostDetail(user, orgId, fbPostId));
    }

    @GetMapping("/top-posts")
    public ResponseEntity<?> getTopPosts(@AuthenticationPrincipal User user,
                                         @RequestParam(required = false) UUID orgId) {
        return ResponseEntity.ok(analyticsService.getTopPosts(user, orgId));
    }

    @GetMapping("/recommendation")
    public ResponseEntity<?> getRecommendation(@AuthenticationPrincipal User user,
                                               @RequestParam(required = false) UUID orgId) {
        return ResponseEntity.ok(analyticsService.getPostingRecommendation(user, orgId));
    }
}