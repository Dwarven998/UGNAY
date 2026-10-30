package com.ugnay.ugnay.analytics;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import com.ugnay.ugnay.core.User;
import com.ugnay.ugnay.org.ConnectedPageResolver;
import com.ugnay.ugnay.org.OrganizationPermissionService;
import com.ugnay.ugnay.org.OrganizationRepository;
import com.ugnay.ugnay.post.EngagementSyncService;
import com.ugnay.ugnay.post.Post;
import com.ugnay.ugnay.post.PostEngagement;
import com.ugnay.ugnay.post.PostEngagementRepository;
import com.ugnay.ugnay.post.PostRepository;

class AnalyticsServiceTest {

    private static final ZoneId MANILA_ZONE = ZoneId.of("Asia/Manila");

    private PostRepository postRepository;
    private PostEngagementRepository engagementRepository;
    private OrganizationRepository organizationRepository;
    private OrganizationPermissionService permissionService;
    private ConnectedPageResolver connectedPageResolver;
    private EngagementSyncService engagementSyncService;
    private AnalyticsService service;

    private User user;
    private UUID orgId;

    @BeforeEach
    void setUp() {
        postRepository = mock(PostRepository.class);
        engagementRepository = mock(PostEngagementRepository.class);
        organizationRepository = mock(OrganizationRepository.class);
        permissionService = mock(OrganizationPermissionService.class);
        connectedPageResolver = mock(ConnectedPageResolver.class);
        engagementSyncService = mock(EngagementSyncService.class);

        service = new AnalyticsService(
            postRepository,
            engagementRepository,
            organizationRepository,
            permissionService,
            connectedPageResolver,
            engagementSyncService
        );

        user = User.builder().id(UUID.randomUUID()).fbPageId("page_123").build();
        orgId = UUID.randomUUID();
    }

    @Test
    void getPostingRecommendation_notApprovedMember_throwsForbidden() {
        doThrow(new ResponseStatusException(HttpStatus.FORBIDDEN, "Requires approved membership in this organization"))
            .when(permissionService).requireApprovedMember(user.getId(), orgId);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
            service.getPostingRecommendation(user, orgId)
        );

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
    }

    @Test
    void getPostingRecommendation_noConnectedPage_returnsColdStart() {
        when(connectedPageResolver.currentPageId(user, orgId)).thenReturn(null);

        AnalyticsService.RecommendationDto dto = service.getPostingRecommendation(user, orgId);

        assertNotNull(dto);
        assertFalse(dto.personalized());
        assertEquals("Post at least 5 times to unlock personalized recommendations.", dto.headline());
        assertEquals("General Tip: Post on weekday afternoons (2-5 PM) for maximum student reach.", dto.detail());
    }

    @Test
    void getPostingRecommendation_lessThanFivePosts_returnsColdStart() {
        when(connectedPageResolver.currentPageId(user, orgId)).thenReturn("page_123");

        List<Post> posts = new ArrayList<>();
        List<UUID> postIds = new ArrayList<>();
        for (int i = 0; i < 3; i++) {
            Post post = Post.builder()
                .id(UUID.randomUUID())
                .status(Post.PostStatus.PUBLISHED)
                .publishedAt(Instant.now())
                .build();
            posts.add(post);
            postIds.add(post.getId());
        }

        when(postRepository.findInScope(orgId, user, "page_123")).thenReturn(posts);

        List<PostEngagement> engagements = posts.stream()
            .map(p -> PostEngagement.builder().id(UUID.randomUUID()).post(p).likes(10).comments(2).shares(1).build())
            .toList();

        when(engagementRepository.findByPost_IdInOrderByTotalEngagementDesc(postIds)).thenReturn(engagements);

        AnalyticsService.RecommendationDto dto = service.getPostingRecommendation(user, orgId);

        assertNotNull(dto);
        assertFalse(dto.personalized());
        assertEquals("Post at least 5 times to unlock personalized recommendations.", dto.headline());
        assertEquals("General Tip: Post on weekday afternoons (2-5 PM) for maximum student reach.", dto.detail());
    }

    @Test
    void getPostingRecommendation_draftPostsNotCountedTowardsFive() {
        when(connectedPageResolver.currentPageId(user, orgId)).thenReturn("page_123");

        List<Post> posts = new ArrayList<>();
        // 4 published, 2 drafts
        for (int i = 0; i < 4; i++) {
            posts.add(Post.builder().id(UUID.randomUUID()).status(Post.PostStatus.PUBLISHED).publishedAt(Instant.now()).build());
        }
        for (int i = 0; i < 2; i++) {
            posts.add(Post.builder().id(UUID.randomUUID()).status(Post.PostStatus.DRAFT).build());
        }

        when(postRepository.findInScope(orgId, user, "page_123")).thenReturn(posts);

        List<UUID> publishedIds = posts.stream()
            .filter(p -> p.getStatus() == Post.PostStatus.PUBLISHED)
            .map(Post::getId)
            .toList();

        List<PostEngagement> engagements = publishedIds.stream()
            .map(id -> PostEngagement.builder().id(UUID.randomUUID()).post(posts.stream().filter(p -> p.getId().equals(id)).findFirst().get()).likes(5).build())
            .toList();

        when(engagementRepository.findByPost_IdInOrderByTotalEngagementDesc(publishedIds)).thenReturn(engagements);

        AnalyticsService.RecommendationDto dto = service.getPostingRecommendation(user, orgId);

        assertNotNull(dto);
        assertFalse(dto.personalized());
    }

    @Test
    void getPostingRecommendation_fiveOrMoreEngagements_returnsPersonalizedRecommendationInManilaTime() {
        when(connectedPageResolver.currentPageId(user, orgId)).thenReturn("page_123");

        // Create 6 published posts at specific Philippine times
        // Manila 7 PM = 19:00 Manila = 11:00 UTC
        Instant manila7pm = ZonedDateTime.of(2026, 10, 20, 19, 0, 0, 0, MANILA_ZONE).toInstant();
        Instant manila2pm = ZonedDateTime.of(2026, 10, 21, 14, 0, 0, 0, MANILA_ZONE).toInstant();
        Instant manila9am = ZonedDateTime.of(2026, 10, 22, 9, 0, 0, 0, MANILA_ZONE).toInstant();

        List<Post> posts = new ArrayList<>();
        // Post 1: 7 PM (high engagement)
        Post p1 = Post.builder().id(UUID.randomUUID()).status(Post.PostStatus.PUBLISHED).publishedAt(manila7pm).build();
        // Post 2: 7 PM (high engagement)
        Post p2 = Post.builder().id(UUID.randomUUID()).status(Post.PostStatus.PUBLISHED).publishedAt(manila7pm).build();
        // Post 3: 7 PM (high engagement)
        Post p3 = Post.builder().id(UUID.randomUUID()).status(Post.PostStatus.PUBLISHED).publishedAt(manila7pm).build();
        // Post 4: 2 PM
        Post p4 = Post.builder().id(UUID.randomUUID()).status(Post.PostStatus.PUBLISHED).publishedAt(manila2pm).build();
        // Post 5: 9 AM
        Post p5 = Post.builder().id(UUID.randomUUID()).status(Post.PostStatus.PUBLISHED).publishedAt(manila9am).build();
        // Post 6: 2 PM (lower engagement)
        Post p6 = Post.builder().id(UUID.randomUUID()).status(Post.PostStatus.PUBLISHED).publishedAt(manila2pm).build();

        posts.addAll(List.of(p1, p2, p3, p4, p5, p6));
        when(postRepository.findInScope(orgId, user, "page_123")).thenReturn(posts);

        List<UUID> postIds = posts.stream().map(Post::getId).toList();

        List<PostEngagement> engagements = List.of(
            PostEngagement.builder().post(p1).likes(100).comments(20).shares(10).build(), // 130 (7 PM)
            PostEngagement.builder().post(p2).likes(80).comments(10).shares(5).build(),   // 95 (7 PM)
            PostEngagement.builder().post(p3).likes(50).comments(5).shares(2).build(),    // 57 (7 PM)
            PostEngagement.builder().post(p4).likes(30).comments(2).shares(1).build(),    // 33 (2 PM)
            PostEngagement.builder().post(p5).likes(20).comments(1).shares(0).build(),    // 21 (9 AM)
            PostEngagement.builder().post(p6).likes(5).comments(0).shares(0).build()      // 5 (2 PM)
        );

        when(engagementRepository.findByPost_IdInOrderByTotalEngagementDesc(postIds)).thenReturn(engagements);

        AnalyticsService.RecommendationDto dto = service.getPostingRecommendation(user, orgId);

        assertNotNull(dto);
        assertTrue(dto.personalized());
        assertEquals("Your posts at 7 PM perform best!", dto.headline());
        assertTrue(dto.detail().contains("7 PM-9 PM"), "Detail should contain the 2-hour window 7 PM-9 PM, got: " + dto.detail());
    }

    @Test
    void getPostingRecommendation_windowWrapAroundAtMidnight() {
        when(connectedPageResolver.currentPageId(user, orgId)).thenReturn("page_123");

        // Manila 11 PM (23:00 Manila) -> 2-hour window should be 11 PM-1 AM
        Instant manila11pm = ZonedDateTime.of(2026, 10, 20, 23, 30, 0, 0, MANILA_ZONE).toInstant();

        List<Post> posts = new ArrayList<>();
        List<PostEngagement> engagements = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            Post p = Post.builder().id(UUID.randomUUID()).status(Post.PostStatus.PUBLISHED).publishedAt(manila11pm).build();
            posts.add(p);
            engagements.add(PostEngagement.builder().post(p).likes(50 - i).build());
        }

        when(postRepository.findInScope(orgId, user, "page_123")).thenReturn(posts);
        when(engagementRepository.findByPost_IdInOrderByTotalEngagementDesc(posts.stream().map(Post::getId).toList()))
            .thenReturn(engagements);

        AnalyticsService.RecommendationDto dto = service.getPostingRecommendation(user, orgId);

        assertNotNull(dto);
        assertTrue(dto.personalized());
        assertEquals("Your posts at 11 PM perform best!", dto.headline());
        assertTrue(dto.detail().contains("11 PM-1 AM"), "Detail should contain the 2-hour window 11 PM-1 AM, got: " + dto.detail());
    }
}

