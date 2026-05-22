package com.ugnay.ugnay.post;


import com.ugnay.ugnay.core.User;
import com.ugnay.ugnay.media.MediaAsset;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.*;

@Entity @Table(name = "posts")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class Post {

    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "media_asset_id")
    private MediaAsset mediaAsset;

    @Column(nullable = false, length = 2000)
    private String caption;

    @Column(columnDefinition = "text[]")
    private String[] hashtags;

    private String tone;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private PostStatus status = PostStatus.DRAFT;

    @Column(name = "scheduled_at")
    private Instant scheduledAt;

    @Column(name = "published_at")
    private Instant publishedAt;

    @Column(name = "fb_post_id")
    private String fbPostId;

    @Column(name = "created_at")
    @Builder.Default
    private Instant createdAt = Instant.now();

    public enum PostStatus {
        DRAFT, SCHEDULED, PUBLISHED, FAILED
    }
}