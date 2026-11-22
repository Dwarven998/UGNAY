package com.ugnay.ugnay.facebook;

import java.net.URI;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.UriComponentsBuilder;
import org.springframework.beans.factory.annotation.Value;

import com.ugnay.ugnay.core.User;
import com.ugnay.ugnay.core.error.AuthenticationRequiredException;
import com.ugnay.ugnay.core.error.LogSanitizer;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/api/auth/facebook")
@RequiredArgsConstructor
public class FacebookOAuthController {

    private final FacebookOAuthService facebookOAuthService;

    @Value("${app.frontend.url}")
    private String frontendUrl;

    @GetMapping("/url")
    public ResponseEntity<Map<String, String>> authorizationUrl(@AuthenticationPrincipal User user,
                                                                 @RequestParam(required = false) UUID orgId) {
        // These routes sit under the public /api/auth/** prefix, so an anonymous caller arrives with no user.
        AuthenticationRequiredException.requireAuthenticated(user);
        return ResponseEntity.ok(Map.of("url", facebookOAuthService.buildAuthorizationUrl(user, orgId)));
    }

    @GetMapping("/status")
    public ResponseEntity<FacebookOAuthService.FacebookConnectionDetails> status(@AuthenticationPrincipal User user,
                                                                                  @RequestParam UUID orgId) {
        AuthenticationRequiredException.requireAuthenticated(user);
        return ResponseEntity.ok(facebookOAuthService.buildConnectionDetailsForOrg(user, orgId));
    }

    @GetMapping("/callback")
    public ResponseEntity<Void> callback(@RequestParam(required = false) String code,
                                        @RequestParam(required = false) String state,
                                        @RequestParam(name = "error", required = false) String facebookError) {
        if (facebookError != null && !facebookError.isBlank()) {
            // The user closed or declined Facebook's dialog; Facebook sends error=access_denied instead of a code.
            return failureRedirect("access_denied".equals(facebookError)
                ? FacebookOAuthException.Reason.CANCELLED
                : FacebookOAuthException.Reason.UNKNOWN);
        }
        try {
            FacebookOAuthService.ConnectionResult result = facebookOAuthService.completeAuthorization(code, state);
            UriComponentsBuilder successBuilder = UriComponentsBuilder.fromHttpUrl(frontendUrl)
                .path("/posts")
                .queryParam("facebook", "connected");
            // Names only (no IDs or tokens), so the app can say "<user> has been connected to <Page>".
            if (result.details().facebookPageName() != null) {
                successBuilder.queryParam("page", result.details().facebookPageName());
            }
            if (result.facebookUserName() != null) {
                successBuilder.queryParam("fbUser", result.facebookUserName());
            }
            URI success = successBuilder
                .build()
                .encode()
                .toUri();
            return ResponseEntity.status(302).location(success).build();
        } catch (FacebookOAuthException ex) {
            return failureRedirect(ex.getReason());
        } catch (RuntimeException ex) {
            log.error("Facebook OAuth callback failed unexpectedly: {}", LogSanitizer.describe(ex));
            return failureRedirect(FacebookOAuthException.Reason.UNKNOWN);
        }
    }

    /**
     * Redirect for a failed connection. It carries only a fixed reason code and its fixed message — never an
     * exception message, which could contain the app secret, the authorization code or an access token.
     */
    private ResponseEntity<Void> failureRedirect(FacebookOAuthException.Reason reason) {
        URI failure = UriComponentsBuilder.fromHttpUrl(frontendUrl)
            .path("/posts")
            .queryParam("facebook", "failed")
            .queryParam("reason", reason.code())
            .queryParam("message", reason.userMessage())
            .build()
            .encode()
            .toUri();
        return ResponseEntity.status(302).location(failure).build();
    }

    @DeleteMapping
    public ResponseEntity<Void> disconnect(@AuthenticationPrincipal User user,
                                           @RequestParam(required = false) UUID orgId) {
        AuthenticationRequiredException.requireAuthenticated(user);
        facebookOAuthService.disconnect(user, orgId);
        return ResponseEntity.noContent().build();
    }
}