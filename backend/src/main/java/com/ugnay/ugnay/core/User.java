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

    @Column(name = "fb_page_name")
    private String fbPageName;

    @Column(name = "fb_page_avatar")
    private String fbPageAvatar;

    @Column(name = "fb_user_id")
    private String fbUserId;

    // Add getters and setters
    public String getFbPageName() {
        return fbPageName;
    }

    public void setFbPageName(String fbPageName) {
        this.fbPageName = fbPageName;
    }

    public String getFbPageAvatar() {
        return fbPageAvatar;
    }

    public void setFbPageAvatar(String fbPageAvatar) {
        this.fbPageAvatar = fbPageAvatar;
    }

    public String getFbUserId() {
        return fbUserId;
    }

    public void setFbUserId(String fbUserId) {
        this.fbUserId = fbUserId;
    }
}