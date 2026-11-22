package com.ugnay.ugnay.facebook;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.reactive.function.client.WebClientResponseException;

/**
 * The OAuth callback redirect is visible in the browser's address bar and history, so it must never carry an
 * exception message (which may embed the app secret, the authorization code, a token or the state JWT).
 */
class FacebookOAuthControllerTest {

    private static final String APP_SECRET = "appSecretValue123456";
    private static final String AUTH_CODE = "AQDauthorizationCode999";
    private static final String STATE = "eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiIxIn0.c2lnbmF0dXJlLXZhbHVl";
    private static final String LEAKY_MESSAGE = "400 Bad Request from GET https://graph.facebook.com/v20.0/oauth/access_token"
        + "?client_id=1&client_secret=" + APP_SECRET + "&code=" + AUTH_CODE;

    private FacebookOAuthService service;
    private FacebookOAuthController controller;

    @BeforeEach
    void setUp() {
        service = mock(FacebookOAuthService.class);
        controller = new FacebookOAuthController(service);
        ReflectionTestUtils.setField(controller, "frontendUrl", "https://app.example.com");
    }

    @Test
    void graphFailureRedirectsWithReasonCodeOnly() {
        WebClientResponseException graphError = WebClientResponseException.create(
            400, "Bad Request", HttpHeaders.EMPTY, new byte[0], StandardCharsets.UTF_8);
        when(service.completeAuthorization(AUTH_CODE, STATE)).thenThrow(new FacebookOAuthException(
            FacebookOAuthException.Reason.TOKEN_EXCHANGE_FAILED, new IllegalStateException(LEAKY_MESSAGE, graphError)));

        String location = redirect(controller.callback(AUTH_CODE, STATE, null));

        assertTrue(location.contains("facebook=failed"), location);
        assertTrue(location.contains("reason=token_exchange"), location);
        assertTrue(location.contains(FacebookOAuthException.Reason.TOKEN_EXCHANGE_FAILED.userMessage()), location);
        assertNoSecrets(location);
    }

    @Test
    void unexpectedExceptionNeverReachesTheRedirect() {
        when(service.completeAuthorization(AUTH_CODE, STATE)).thenThrow(new IllegalStateException(LEAKY_MESSAGE));

        String location = redirect(controller.callback(AUTH_CODE, STATE, null));

        assertTrue(location.contains("reason=unknown"), location);
        assertNoSecrets(location);
    }

    @Test
    void declinedDialogIsReportedAsCancelledWithoutCallingFacebook() {
        String location = redirect(controller.callback(null, STATE, "access_denied"));

        assertTrue(location.contains("reason=cancelled"), location);
        assertNoSecrets(location);
        verify(service, never()).completeAuthorization(any(), any());
    }

    @Test
    void successRedirectIsUnchanged() {
        when(service.completeAuthorization(AUTH_CODE, STATE)).thenReturn(new FacebookOAuthService.ConnectionResult(
            new FacebookOAuthService.FacebookConnectionDetails(true, "123", "My Page", null), "Jane"));

        String location = redirect(controller.callback(AUTH_CODE, STATE, null));

        assertTrue(location.startsWith("https://app.example.com/posts?facebook=connected"), location);
        assertTrue(location.contains("page=My Page"), location);
        assertNoSecrets(location);
    }

    private static String redirect(ResponseEntity<Void> response) {
        assertEquals(HttpStatus.FOUND, response.getStatusCode());
        URI location = response.getHeaders().getLocation();
        assertNotNull(location);
        return URLDecoder.decode(location.toString(), StandardCharsets.UTF_8);
    }

    private static void assertNoSecrets(String location) {
        assertFalse(location.contains(APP_SECRET), "app secret leaked: " + location);
        assertFalse(location.contains(AUTH_CODE), "authorization code leaked: " + location);
        assertFalse(location.contains(STATE), "state JWT leaked: " + location);
        assertFalse(location.contains("client_secret"), location);
        assertFalse(location.contains("graph.facebook.com"), location);
    }
}
