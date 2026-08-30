package com.ugnay.ugnay.post;


import com.ugnay.ugnay.core.User;
import com.ugnay.ugnay.media.MediaAsset;
import com.ugnay.ugnay.org.Organization;
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

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "post_media_assets",
        joinColumns = @JoinColumn(name = "post_id"),
        inverseJoinColumns = @JoinColumn(name = "media_asset_id")
    )
    @OrderColumn(name = "position")
    @Builder.Default
    private List<MediaAsset> mediaAssets = new ArrayList<>();

    /** Which organization this post belongs to, if the author had one active when it was created. Nullable for backward compatibility with posts made before organizations existed. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id")
    private Organization organization;

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
        DRAFT, SCHEDULED, PUBLISHED, FAILED,
        /** Created by a non-officer/admin org member; awaiting officer/admin approval before it can be scheduled. */
        PENDING_REVIEW,
        /** An officer/admin declined a PENDING_REVIEW post. */
        REJECTED
    }
}