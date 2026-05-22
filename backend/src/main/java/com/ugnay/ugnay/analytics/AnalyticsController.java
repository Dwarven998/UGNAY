package com.ugnay.ugnay.analytics;


import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ugnay.ugnay.core.User;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/analytics")
@RequiredArgsConstructor
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    @GetMapping("/summary")
    public ResponseEntity<AnalyticsService.AnalyticsSummary> getSummary(
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(analyticsService.getSummary(user));
    }

    @GetMapping("/top-posts")
    public ResponseEntity<?> getTopPosts(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(analyticsService.getTopPosts(user));
    }

    @GetMapping("/recommendation")
    public ResponseEntity<?> getRecommendation(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(analyticsService.getPostingRecommendation(user));
    }
}