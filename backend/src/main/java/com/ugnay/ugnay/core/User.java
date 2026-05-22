package com.ugnay.ugnay.core;


import jakarta.persistence.*;
import lombok.*;
import java.util.UUID;

@Entity
@Table(name = "users")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(unique = true, nullable = false)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(name = "org_name", nullable = false)
    private String orgName;

    @Enumerated(EnumType.STRING)
    @Column(name = "tone_preference")
    @Builder.Default
    private TonePreference tonePreference = TonePreference.FORMAL;

    @Column(name = "fb_page_id")
    private String fbPageId;

    @Column(name = "fb_access_token")
    private String fbAccessToken;

    public enum TonePreference {
        FORMAL, ENERGETIC, CELEBRATORY, URGENT
    }
}