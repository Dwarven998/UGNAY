package com.ugnay.ugnay.analytics;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.server.ResponseStatusException;

import com.ugnay.ugnay.core.User;

class AnalyticsControllerTest {

    private AnalyticsService analyticsService;
    private AnalyticsDashboardService dashboardService;
    private AnalyticsController controller;

    private User user;
    private UUID orgId;

    @BeforeEach
    void setUp() {
        analyticsService = mock(AnalyticsService.class);
        dashboardService = mock(AnalyticsDashboardService.class);
        controller = new AnalyticsController(analyticsService, dashboardService);

        user = User.builder().id(UUID.randomUUID()).build();
        orgId = UUID.randomUUID();
    }

    @Test
    void getRecommendation_returns200OkWithRecommendationDto() {
        AnalyticsService.RecommendationDto expectedDto = new AnalyticsService.RecommendationDto(
            "Your posts at 7 PM perform best!",
            "Post between 7 PM-9 PM for maximum student reach.",
            true
        );

        when(analyticsService.getPostingRecommendation(user, orgId)).thenReturn(expectedDto);

        ResponseEntity<AnalyticsService.RecommendationDto> response = controller.getRecommendation(user, orgId);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(expectedDto.headline(), response.getBody().headline());
        assertEquals(expectedDto.detail(), response.getBody().detail());
        assertEquals(expectedDto.personalized(), response.getBody().personalized());
        verify(analyticsService).getPostingRecommendation(user, orgId);
    }

    @Test
    void getRecommendation_propagates403ForbiddenWhenNotApprovedMember() {
        when(analyticsService.getPostingRecommendation(user, orgId))
            .thenThrow(new ResponseStatusException(HttpStatus.FORBIDDEN, "Requires approved membership in this organization"));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
            controller.getRecommendation(user, orgId)
        );

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        verify(analyticsService).getPostingRecommendation(user, orgId);
    }
}

