package com.ugnay.ugnay.facebook;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;

import com.ugnay.ugnay.core.JwtUtil;
import com.ugnay.ugnay.core.UserRepository;
import com.ugnay.ugnay.media.MediaFolderRepository;
import com.ugnay.ugnay.org.OrganizationPermissionService;
import com.ugnay.ugnay.org.OrganizationRepository;
import com.ugnay.ugnay.post.PostRepository;

/** Callback input problems become fixed, safe reasons instead of raw exceptions. */
class FacebookOAuthServiceTest {

    private JwtUtil jwtUtil;
    private UserRepository userRepository;
    private FacebookOAuthService service;

    @BeforeEach
    void setUp() {
        jwtUtil = mock(JwtUtil.class);
        userRepository = mock(UserRepository.class);
        service = new FacebookOAuthService(jwtUtil, userRepository, mock(OrganizationRepository.class),
            mock(OrganizationPermissionService.class), mock(PostRepository.class), mock(MediaFolderRepository.class),
            mock(ApplicationEventPublisher.class));
    }

    @Test
    void missingCodeIsMissingCode() {
        assertReason(FacebookOAuthException.Reason.MISSING_CODE, () -> service.completeAuthorization(" ", "state"));
    }

    @Test
    void invalidStateIsInvalidState() {
        when(jwtUtil.isValid(anyString())).thenReturn(false);
        assertReason(FacebookOAuthException.Reason.INVALID_STATE, () -> service.completeAuthorization("code", "bad"));
    }

    @Test
    void malformedUserIdInStateIsInvalidState() {
        when(jwtUtil.isValid(anyString())).thenReturn(true);
        when(jwtUtil.extractUserId(anyString())).thenReturn("not-a-uuid");
        assertReason(FacebookOAuthException.Reason.INVALID_STATE, () -> service.completeAuthorization("code", "state"));
    }

    @Test
    void unknownUserInStateIsInvalidState() {
        UUID userId = UUID.randomUUID();
        when(jwtUtil.isValid(anyString())).thenReturn(true);
        when(jwtUtil.extractUserId(anyString())).thenReturn(userId.toString());
        when(userRepository.findById(userId)).thenReturn(Optional.empty());
        assertReason(FacebookOAuthException.Reason.INVALID_STATE, () -> service.completeAuthorization("code", "state"));
    }

    @Test
    void wrappedCauseIsScrubbed() {
        FacebookOAuthException ex = new FacebookOAuthException(FacebookOAuthException.Reason.UNKNOWN,
            new IllegalStateException("GET https://graph.facebook.com/oauth/access_token?client_secret=topSecret42"));

        assertFalse(ex.getCause().getMessage().contains("topSecret42"), ex.getCause().getMessage());
        assertEquals(FacebookOAuthException.Reason.UNKNOWN.userMessage(), ex.getMessage());
    }

    private static void assertReason(FacebookOAuthException.Reason expected, Runnable call) {
        FacebookOAuthException ex = assertThrows(FacebookOAuthException.class, call::run);
        assertEquals(expected, ex.getReason());
    }
}
