package com.ugnay.ugnay.post;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import com.ugnay.ugnay.core.User;
import com.ugnay.ugnay.core.UserRepository;
import com.ugnay.ugnay.facebook.FacebookService;
import com.ugnay.ugnay.media.MediaAsset;
import com.ugnay.ugnay.media.MediaService;
import com.ugnay.ugnay.org.Organization;
import com.ugnay.ugnay.org.OrganizationRepository;

class FacebookPublishingJobTest {

    private PostRepository postRepository;
    private UserRepository userRepository;
    private OrganizationRepository organizationRepository;
    private MediaService mediaService;
    private FacebookService facebookService;
    private FacebookPublishingJob job;

    @BeforeEach
    void setUp() {
        postRepository = mock(PostRepository.class);
        userRepository = mock(UserRepository.class);
        organizationRepository = mock(OrganizationRepository.class);
        mediaService = mock(MediaService.class);
        facebookService = mock(FacebookService.class);

        job = new FacebookPublishingJob(
            postRepository,
            userRepository,
            organizationRepository,
            mediaService,
            facebookService
        );
    }

    @Test
    void markFailed_doesNotClearOrganizationFacebookCredentialsOnFailedPost() {
        UUID postId = UUID.randomUUID();
        UUID orgId = UUID.randomUUID();

        Organization org = Organization.builder()
            .id(orgId)
            .name("Test Org")
            .fbPageId("page_123")
            .fbAccessToken("token_xyz")
            .build();

        Post post = Post.builder()
            .id(postId)
            .organization(org)
            .status(Post.PostStatus.SCHEDULED)
            .caption("Hello World")
            .build();

        when(postRepository.findById(postId)).thenReturn(Optional.of(post));

        // Simulate a Graph API OAuthException error that previously wiped credentials
        byte[] body = "{\"error\":{\"message\":\"Some post error\",\"type\":\"OAuthException\",\"code\":100}}".getBytes();
        WebClientResponseException error = WebClientResponseException.create(
            HttpStatus.BAD_REQUEST.value(),
            "Bad Request",
            HttpHeaders.EMPTY,
            body,
            null
        );

        job.markFailed(postId, error);

        // Status should be set to FAILED
        assertEquals(Post.PostStatus.FAILED, post.getStatus());
        verify(postRepository).save(post);

        // Crucial bug fix verification: organizationRepository.save MUST NEVER be called to wipe credentials
        verify(organizationRepository, never()).save(any());
        assertEquals("page_123", org.getFbPageId());
        assertEquals("token_xyz", org.getFbAccessToken());
    }

    @Test
    void publishScheduledPost_withMultiImages_publishesAllImagesToFacebook() {
        UUID postId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID orgId = UUID.randomUUID();

        Organization org = Organization.builder()
            .id(orgId)
            .fbPageId("page_123")
            .fbAccessToken("token_xyz")
            .build();

        User user = User.builder().id(userId).build();

        MediaAsset asset1 = MediaAsset.builder().id(UUID.randomUUID()).fileUrl("https://supabase.co/img1.jpg").build();
        MediaAsset asset2 = MediaAsset.builder().id(UUID.randomUUID()).fileUrl("https://supabase.co/img2.jpg").build();
        List<MediaAsset> assets = new ArrayList<>(List.of(asset1, asset2));

        Post post = Post.builder()
            .id(postId)
            .user(user)
            .organization(org)
            .caption("Multi-image event")
            .hashtags(new String[]{"#event", "#ugnay"})
            .mediaAssets(assets)
            .mediaAsset(asset1)
            .status(Post.PostStatus.SCHEDULED)
            .build();

        when(postRepository.findDetailedById(postId)).thenReturn(Optional.of(post));
        when(postRepository.findById(postId)).thenReturn(Optional.of(post));
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(facebookService.publishPost(eq("token_xyz"), eq("page_123"), any(), any(List.class)))
            .thenReturn("fb_post_999");

        job.publishScheduledPost(postId);

        // Verify FacebookService received both image URLs
        verify(facebookService).publishPost(
            eq("token_xyz"),
            eq("page_123"),
            eq("Multi-image event\n\n#event #ugnay"),
            eq(List.of("https://supabase.co/img1.jpg", "https://supabase.co/img2.jpg"))
        );

        // Post published verification
        assertEquals(Post.PostStatus.PUBLISHED, post.getStatus());
        assertEquals("fb_post_999", post.getFbPostId());
        assertNotNull(post.getPublishedAt());

        // Verify both assets were released from Supabase/DB
        verify(mediaService, times(1)).releasePublishedAsset(asset1.getId());
        verify(mediaService, times(1)).releasePublishedAsset(asset2.getId());
    }
}
