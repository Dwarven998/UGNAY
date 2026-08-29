package com.ugnay.ugnay.org;

import com.ugnay.ugnay.core.User;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

/**
 * Minimal directory/event stub: enough to attach directory-level contributor
 * grants and upload-policy guards to. The full event manager UI (deadlines,
 * moderation queue, etc.) is built out in a later phase.
 */
@Entity
@Table(name = "post_directories")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class PostDirectory {

    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    @Column(nullable = false)
    private String title;

    @Column(name = "upload_deadline")
    private Instant uploadDeadline;

    @Column(name = "allowed_file_types", columnDefinition = "text[]")
    private String[] allowedFileTypes;

    @Column(name = "requires_approval", nullable = false)
    @Builder.Default
    private boolean requiresApproval = true;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    @Column(name = "created_at")
    @Builder.Default
    private Instant createdAt = Instant.now();
}
