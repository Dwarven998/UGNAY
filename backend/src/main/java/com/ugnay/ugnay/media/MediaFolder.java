package com.ugnay.ugnay.media;


import com.ugnay.ugnay.core.User;
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

    @Column(nullable = false)
    private String name;

    @OneToMany(mappedBy = "folder", cascade = CascadeType.ALL)
    @Builder.Default
    private List<MediaAsset> assets = new ArrayList<>();

    @Column(name = "created_at")
    @Builder.Default
    private Instant createdAt = Instant.now();
}
