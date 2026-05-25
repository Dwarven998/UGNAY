package com.ugnay.ugnay.facebook;

import java.net.URI;
import java.util.Map;

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

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/auth/facebook")
@RequiredArgsConstructor
public class FacebookOAuthController {

    private final FacebookOAuthService facebookOAuthService;

    @Value("${app.frontend.url}")
    private String frontendUrl;

    @GetMapping("/url")
    public ResponseEntity<Map<String, String>> authorizationUrl(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(Map.of("url", facebookOAuthService.buildAuthorizationUrl(user)));
    }

    @GetMapping("/callback")
    public ResponseEntity<Void> callback(@RequestParam(required = false) String code,
                                        @RequestParam(required = false) String state) {
        try {
            facebookOAuthService.completeAuthorization(code, state);
            URI success = UriComponentsBuilder.fromHttpUrl(frontendUrl)
                .path("/posts")
                .queryParam("facebook", "connected")
                .build()
                .encode()
                .toUri();
            return ResponseEntity.status(302).location(success).build();
        } catch (Exception ex) {
            URI failure = UriComponentsBuilder.fromHttpUrl(frontendUrl)
                .path("/posts")
                .queryParam("facebook", "failed")
                .queryParam("message", ex.getMessage() != null ? ex.getMessage() : "Facebook connection failed")
                .build()
                .encode()
                .toUri();
            return ResponseEntity.status(302).location(failure).build();
        }
    }

    @DeleteMapping
    public ResponseEntity<Void> disconnect(@AuthenticationPrincipal User user) {
        facebookOAuthService.disconnect(user);
        return ResponseEntity.noContent().build();
    }
}