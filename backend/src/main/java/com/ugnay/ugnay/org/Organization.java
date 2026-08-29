package com.ugnay.ugnay.org;

import com.ugnay.ugnay.core.User;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "organizations")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class Organization {

    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OrgType type;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_org_id")
    private Organization parentOrganization;

    @Column(name = "join_code", nullable = false, unique = true)
    private String joinCode;

    @Column(name = "open_join", nullable = false)
    @Builder.Default
    private boolean openJoin = false;

    @Column(name = "fb_page_id")
    private String fbPageId;

    @Column(name = "fb_access_token")
    private String fbAccessToken;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    @Column(name = "created_at")
    @Builder.Default
    private Instant createdAt = Instant.now();

    /**
     * Fixed 2-3 tier hierarchy: UNIVERSITY -> DEPARTMENT -> PROGRAM.
     * A DEPARTMENT's parent must be a UNIVERSITY; a PROGRAM's parent must be a DEPARTMENT.
     */
    public enum OrgType {
        UNIVERSITY, DEPARTMENT, PROGRAM
    }
}
