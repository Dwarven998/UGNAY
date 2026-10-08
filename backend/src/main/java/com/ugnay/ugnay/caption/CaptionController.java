package com.ugnay.ugnay.caption;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ugnay.ugnay.core.User;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/caption")
@RequiredArgsConstructor
public class CaptionController {

    private final GeminiClient geminiClient;
    private final OrgAiProfileResolver profileResolver;

    @PostMapping("/generate")
    public ResponseEntity<List<String>> generate(@AuthenticationPrincipal User user,
                                                  @RequestBody GenerateRequest req) {
        OrgAiProfile profile = profileResolver.resolveProfile(user, req.orgId());
        List<String> captions = geminiClient.generateCaptions(req.imageUrl(), req.tone(), profile, req.notes());
        return ResponseEntity.ok(captions);
    }

    @PostMapping("/rewrite")
    public ResponseEntity<Map<String, String>> rewrite(@AuthenticationPrincipal User user,
                                                        @RequestBody RewriteRequest req) {
        OrgAiProfile profile = profileResolver.resolveProfile(user, req.orgId());
        String rewritten = geminiClient.rewriteWithTone(req.caption(), req.tone(), profile, req.notes(), req.imageUrl());
        return ResponseEntity.ok(Map.of("rewritten", rewritten));
    }

    @PostMapping("/hashtags")
    public ResponseEntity<List<String>> hashtags(@AuthenticationPrincipal User user,
                                                  @RequestBody HashtagRequest req) {
        OrgAiProfile profile = profileResolver.resolveProfile(user, req.orgId());
        List<String> tags = geminiClient.generateHashtags(req.caption(), profile, req.imageUrl());
        return ResponseEntity.ok(tags);
    }

    // Request DTOs
    public record GenerateRequest(String imageUrl, String tone, UUID orgId, String notes) {}
    public record RewriteRequest(String caption, String tone, UUID orgId, String notes, String imageUrl) {}
    public record HashtagRequest(String caption, UUID orgId, String imageUrl) {}
}
