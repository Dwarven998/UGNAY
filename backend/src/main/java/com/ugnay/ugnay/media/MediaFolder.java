package com.ugnay.ugnay.media;


import com.ugnay.ugnay.core.User;
import com.ugnay.ugnay.org.Organization;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.*;

@Entity @Table(name = "media_folders")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class MediaFolder {

    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    /** When set, this folder belongs to an organization's Media Repository and is visible to its approved members, not just `user`. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id")
    private Organization organization;

    @Column(nullable = false)
    private String name;

    @OneToMany(mappedBy = "folder", cascade = CascadeType.ALL)
    @Builder.Default
    private List<MediaAsset> assets = new ArrayList<>();

    @Column(name = "created_at")
    @Builder.Default
    private Instant createdAt = Instant.now();
}
