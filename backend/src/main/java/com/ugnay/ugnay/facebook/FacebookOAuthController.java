package com.ugnay.ugnay.facebook;

import com.ugnay.ugnay.core.User;
import com.ugnay.ugnay.core.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/facebook")
@RequiredArgsConstructor
public class FacebookOAuthController {

    private final UserRepository userRepository;
    private final FacebookService facebookService;

    @Value("${facebook.app.id}")
    private String facebookAppId;

    @Value("${facebook.redirect.uri}")
    private String facebookRedirectUri;

    @GetMapping("/auth-url")
    public ResponseEntity<Map<String, String>> getAuthUrl() {
        try {
            String authUrl = String.format(
                "https://www.facebook.com/v20.0/dialog/oauth?client_id=%s&redirect_uri=%s&scope=pages_manage_posts,pages_read_engagement,pages_manage_metadata&state=security_token",
                facebookAppId,
                facebookRedirectUri
            );
            return ResponseEntity.ok(Map.of("authUrl", authUrl));
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping("/callback")
    public ResponseEntity<Map<String, Object>> handleOAuthCallback(
            @RequestBody FacebookOAuthCallbackRequest request,
            Authentication authentication) { // 💡 Uses AuthenticationPrincipal wrapper safely

        try {
            if (request.code() == null || request.code().isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Authorization code is required"));
            }

            // 1. Exchange temporary authorization code for long-lived user data references
            Map<String, String> tokenResponse = facebookService.exchangeCodeForToken(request.code());
            String userAccessToken = tokenResponse.get("access_token");
            String fbUserId = tokenResponse.get("user_id");
            User user = (User) authentication.getPrincipal();
            // 2. Fetch pages data along with the PERMANENT Page Access Token
            Map<String, Object> pagesData = facebookService.getUserPages(userAccessToken);

            user.setFbUserId(fbUserId);

            if (pagesData.get("pageId") != null) {
                // 💡 SAVES PERMANENT PAGE ACCESS TOKEN TO DATABASE instead of temporary token
                user.setFbAccessToken((String) pagesData.get("pageAccessToken"));
                user.setFbPageId((String) pagesData.get("pageId"));
                user.setFbPageName((String) pagesData.get("pageName"));
                user.setFbPageAvatar((String) pagesData.get("pageAvatar"));
            } else {
                return ResponseEntity.badRequest().body(Map.of("error", "No Facebook pages found managed by this account"));
            }

            userRepository.save(user);

            return ResponseEntity.ok(Map.of(
                "message", "Facebook page connected successfully",
                "pageId", user.getFbPageId(),
                "pageName", user.getFbPageName(),
                "pageAvatar", user.getFbPageAvatar()
            ));

        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Facebook connection failed: " + e.getMessage()));
        }
    }

    @GetMapping("/page-info")
    public ResponseEntity<Map<String, Object>> getPageInfo(Authentication authentication) {
        User user = (User) authentication.getPrincipal();
        if (user.getFbPageId() == null) {
            return ResponseEntity.ok(Map.of("connected", false));
        }

        return ResponseEntity.ok(Map.of(
            "connected", true,
            "pageId", user.getFbPageId(),
            "pageName", user.getFbPageName(),
            "pageAvatar", user.getFbPageAvatar()
        ));
    }

    @PostMapping("/disconnect")
    public ResponseEntity<Map<String, String>> disconnect(Authentication authentication) {
        User user = (User) authentication.getPrincipal();
        user.setFbAccessToken(null);
        user.setFbPageId(null);
        user.setFbPageName(null);
        user.setFbPageAvatar(null);
        user.setFbUserId(null);

        userRepository.save(user);
        return ResponseEntity.ok(Map.of("message", "Facebook page disconnected successfully"));
    }
}

record FacebookOAuthCallbackRequest(String code) {}