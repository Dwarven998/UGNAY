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
import org.springframework.web.bind.annotation.RestController;

import com.ugnay.ugnay.core.User;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/posts")
@RequiredArgsConstructor
public class PostController {

    private final PostService postService;

    @GetMapping
    public ResponseEntity<List<PostDto>> getPosts(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(postService.getPostsByUser(user));
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

    // DTOs
    public record CreatePostRequest(
        String caption, String[] hashtags, String tone,
        UUID mediaAssetId, String scheduledAt   // ISO-8601
    ) {}

    public record PostDto(
        UUID id, String caption, String[] hashtags, String tone,
        String status, String scheduledAt, String mediaUrl, String fbPostId
    ) {}
}