package com.ugnay.ugnay.caption;

import java.util.List;
import java.util.Map;

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

    @PostMapping("/generate")
    public ResponseEntity<List<String>> generate(@AuthenticationPrincipal User user,
                                                  @RequestBody GenerateRequest req) {
        List<String> captions = geminiClient.generateCaptions(req.imageUrl(), req.tone(), user.getOrgName());
        return ResponseEntity.ok(captions);
    }

    @PostMapping("/rewrite")
    public ResponseEntity<String> rewrite(@AuthenticationPrincipal User user,
                                           @RequestBody RewriteRequest req) {
        String rewritten = geminiClient.rewriteWithTone(req.caption(), req.tone(), user.getOrgName());
        return ResponseEntity.ok(rewritten);
    }

    @PostMapping("/hashtags")
    public ResponseEntity<List<String>> hashtags(@AuthenticationPrincipal User user,
                                                  @RequestBody HashtagRequest req) {
        List<String> tags = geminiClient.generateHashtags(req.caption(), user.getOrgName());
        return ResponseEntity.ok(tags);
    }

    // Request DTOs
    public record GenerateRequest(String imageUrl, String tone) {}
    public record RewriteRequest(String caption, String tone) {}
    public record HashtagRequest(String caption) {}
}
