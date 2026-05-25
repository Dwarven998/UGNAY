package com.ugnay.ugnay.facebook;

import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ugnay.ugnay.core.User;
import com.ugnay.ugnay.core.UserRepository;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/internal/facebook")
@RequiredArgsConstructor
public class InternalFacebookController {

    private final FacebookService facebookService;
    private final UserRepository userRepository;

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        try {
            Map<String, Object> resp = facebookService.getPostInsights("", "0");
            return ResponseEntity.ok(Map.of("ok", true, "graph_response", resp == null ? Map.of() : resp));
        } catch (Exception ex) {
            return ResponseEntity.status(502).body(Map.of("ok", false, "error", ex.getMessage()));
        }
    }

    @PostMapping("/publish-test")
    public ResponseEntity<Map<String, Object>> publishTest(@RequestBody(required = false) Map<String, String> body) {
        String message = body != null && body.get("message") != null ? body.get("message") : "UGNAY test post";

        List<User> users = userRepository.findAll();
        for (User u : users) {
            if (u.getFbAccessToken() != null && !u.getFbAccessToken().isBlank() && u.getFbPageId() != null && !u.getFbPageId().isBlank()) {
                try {
                    String fbPostId = facebookService.publishPost(u.getFbAccessToken(), u.getFbPageId(), message, null);
                    return ResponseEntity.ok(Map.of("ok", true, "fbPostId", fbPostId));
                } catch (Exception ex) {
                    return ResponseEntity.status(502).body(Map.of("ok", false, "error", ex.getMessage()));
                }
            }
        }

        return ResponseEntity.status(404).body(Map.of("ok", false, "error", "No user with Page token found"));
    }

    @GetMapping("/users")
    public ResponseEntity<Map<String, Object>> usersWithTokens() {
        List<User> users = userRepository.findAll();
        var filtered = users.stream()
            .filter(u -> u.getFbAccessToken() != null && !u.getFbAccessToken().isBlank())
            .map(u -> Map.of("id", u.getId(), "email", u.getEmail(), "pageId", u.getFbPageId()))
            .toList();
        return ResponseEntity.ok(Map.of("count", filtered.size(), "users", filtered));
    }
}
