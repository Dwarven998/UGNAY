package com.ugnay.ugnay.post;


import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.ugnay.ugnay.core.User;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/posts")
@RequiredArgsConstructor
public class PostController {

    private final PostService postService;

    @GetMapping
    public ResponseEntity<List<PostDto>> getPosts(@AuthenticationPrincipal User user,
                                                  @RequestParam(required = false) UUID orgId) {
        return ResponseEntity.ok(postService.getPostsByUser(user, orgId));
    }

    @PostMapping
    public ResponseEntity<PostDto> createPost(@AuthenticationPrincipal User user,
                                              @RequestBody CreatePostRequest req) {
        return ResponseEntity.ok(postService.createPost(user, req));
    }

    @PutMapping("/{postId}")
    public ResponseEntity<PostDto> updatePost(@AuthenticationPrincipal User user,
                                              @PathVariable UUID postId,
                                              @RequestBody CreatePostRequest req) {
        return ResponseEntity.ok(postService.updatePost(user, postId, req));
    }

    @DeleteMapping("/{postId}")
    public ResponseEntity<Void> deletePost(@AuthenticationPrincipal User user,
                                           @PathVariable UUID postId) {
        postService.deletePost(user, postId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{postId}/publish")
    public ResponseEntity<PostDto> publishNow(@AuthenticationPrincipal User user,
                                              @PathVariable UUID postId) {
        return ResponseEntity.ok(postService.publishPost(user, postId));
    }

    // --- Moderation (officer/admin only) ---

    @GetMapping("/moderation")
    public ResponseEntity<List<PostDto>> getModerationQueue(@AuthenticationPrincipal User user,
                                                             @RequestParam UUID orgId) {
        return ResponseEntity.ok(postService.getPendingForModeration(user, orgId));
    }

    @PostMapping("/{postId}/approve")
    public ResponseEntity<PostDto> approve(@AuthenticationPrincipal User user,
                                           @PathVariable UUID postId) {
        return ResponseEntity.ok(postService.approvePost(user, postId));
    }

    @PostMapping("/{postId}/reject")
    public ResponseEntity<PostDto> reject(@AuthenticationPrincipal User user,
                                          @PathVariable UUID postId) {
        return ResponseEntity.ok(postService.rejectPost(user, postId));
    }

    // --- Appeals: a member requests edit/cancel on a SCHEDULED org post; officer/admin resolves it ---

    @PostMapping("/{postId}/appeal")
    public ResponseEntity<PostDto> requestAppeal(@AuthenticationPrincipal User user,
                                                 @PathVariable UUID postId,
                                                 @RequestBody AppealRequest req) {
        return ResponseEntity.ok(postService.requestAppeal(user, postId, req.type()));
    }

    @PostMapping("/{postId}/appeal/approve")
    public ResponseEntity<Void> approveAppeal(@AuthenticationPrincipal User user,
                                              @PathVariable UUID postId) {
        postService.resolveAppeal(user, postId, true);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{postId}/appeal/reject")
    public ResponseEntity<Void> rejectAppeal(@AuthenticationPrincipal User user,
                                             @PathVariable UUID postId) {
        postService.resolveAppeal(user, postId, false);
        return ResponseEntity.noContent().build();
    }

    // DTOs
    public record CreatePostRequest(
        String caption, String[] hashtags, String tone,
        UUID mediaAssetId, String scheduledAt,   // ISO-8601
        UUID orgId
    ) {}

    public record AppealRequest(String type) {} // "EDIT" | "CANCEL"

    public record PostDto(
        UUID id, String caption, String[] hashtags, String tone,
        String status, String scheduledAt, String mediaUrl, String fbPostId, UUID orgId,
        UUID ownerId, String appealType, boolean editUnlocked
    ) {}
}