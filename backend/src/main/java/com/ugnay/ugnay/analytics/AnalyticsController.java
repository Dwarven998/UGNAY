package com.ugnay.ugnay.analytics;


import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
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

    @GetMapping("/summary")
    public ResponseEntity<AnalyticsService.AnalyticsSummary> getSummary(
            @AuthenticationPrincipal User user,
            @RequestParam(required = false) UUID orgId) {
        return ResponseEntity.ok(analyticsService.syncNow(user, orgId));
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