package com.ugnay.ugnay.org;

import com.ugnay.ugnay.core.User;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "organization_memberships",
       uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "organization_id"}))
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class OrganizationMembership {

    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OrgRole role;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private MembershipStatus status = MembershipStatus.PENDING;

    @Column(name = "requested_at")
    @Builder.Default
    private Instant requestedAt = Instant.now();

    @Column(name = "joined_at")
    private Instant joinedAt;

    public enum OrgRole {
        ADMIN, OFFICER, CONTRIBUTOR, MEMBER
    }

    public enum MembershipStatus {
        PENDING, APPROVED, REJECTED
    }
}
