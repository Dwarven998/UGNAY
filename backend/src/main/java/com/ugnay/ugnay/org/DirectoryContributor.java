package com.ugnay.ugnay.org;

import com.ugnay.ugnay.core.User;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "directory_contributors",
       uniqueConstraints = @UniqueConstraint(columnNames = {"directory_id", "user_id"}))
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class DirectoryContributor {

    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "directory_id", nullable = false)
    private PostDirectory directory;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "granted_by")
    private User grantedBy;

    @Column(name = "granted_at")
    @Builder.Default
    private Instant grantedAt = Instant.now();
}
