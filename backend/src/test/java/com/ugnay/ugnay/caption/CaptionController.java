package com.ugnay.ugnay.caption;


import com.ugnay.ugnay.core.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/captions")
@RequiredArgsConstructor
public class CaptionController {

    private final GeminiClient geminiClient;

    @PostMapping("/generate")
    public ResponseEntity<CaptionResponse> generateCaptions(
            @AuthenticationPrincipal User user,
            @RequestBody GenerateRequest req) {

        String tone = req.tone() != null ? req.tone() : user.getTonePreference().name();
        List<String> captions = geminiClient.generateCaptions(req.imageUrl(), tone, user.getOrgName());
        return ResponseEntity.ok(new CaptionResponse(captions));
    }

    @PostMapping("/rewrite")
    public ResponseEntity<RewriteResponse> rewriteCaption(
            @AuthenticationPrincipal User user,
            @RequestBody RewriteRequest req) {

        String rewritten = geminiClient.rewriteWithTone(req.caption(), req.tone(), user.getOrgName());
        return ResponseEntity.ok(new RewriteResponse(rewritten));
    }

    @PostMapping("/hashtags")
    public ResponseEntity<HashtagResponse> generateHashtags(
            @AuthenticationPrincipal User user,
            @RequestBody HashtagRequest req) {

        List<String> hashtags = geminiClient.generateHashtags(req.caption(), user.getOrgName());
        return ResponseEntity.ok(new HashtagResponse(hashtags));
    }

    // DTOs
    public record GenerateRequest(String imageUrl, String tone) {}
    public record RewriteRequest(String caption, String tone) {}
    public record HashtagRequest(String caption) {}

    public record CaptionResponse(List<String> captions) {}
    public record RewriteResponse(String caption) {}
    public record HashtagResponse(List<String> hashtags) {}
}