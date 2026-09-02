package com.ugnay.ugnay.post;

import com.ugnay.ugnay.media.MediaAsset;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

/**
 * Junction entity for the many-to-many relationship between Post and MediaAsset.
 * Allows posts to have 1-3 images with preserved display order.
 */
@Entity
@Table(name = "posts_media_assets")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PostMediaAsset {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "post_id", nullable = false)
    private Post post;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "media_asset_id", nullable = false)
    private MediaAsset mediaAsset;

    /** Display order for this image in the post (0, 1, or 2 for up to 3 images) */
    @Column(name = "display_order", nullable = false)
    private Integer displayOrder;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
