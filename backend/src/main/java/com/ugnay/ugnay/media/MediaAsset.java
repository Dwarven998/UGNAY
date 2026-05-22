package com.ugnay.ugnay.media;


import com.ugnay.ugnay.core.User;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name = "media_assets")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class MediaAsset {

    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "folder_id")
    private MediaFolder folder;

    @Column(name = "file_name") private String fileName;
    @Column(name = "file_url") private String fileUrl;
    @Column(name = "file_type") private String fileType;

    @Column(name = "created_at")
    @Builder.Default
    private Instant createdAt = Instant.now();
}