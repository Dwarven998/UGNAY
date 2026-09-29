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

    /**
     * University-only code that a Department or Program enters at creation time to be listed as a
     * sub-organization of this university. Null for departments and programs.
     */
    @Column(name = "join_id", unique = true)
    private String joinId;

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
     * A UNIVERSITY is always top-level. A DEPARTMENT or PROGRAM may stand alone, or be linked under a
     * UNIVERSITY by entering that university's Join ID when it is created.
     */
    public enum OrgType {
        UNIVERSITY, DEPARTMENT, PROGRAM
    }
}
