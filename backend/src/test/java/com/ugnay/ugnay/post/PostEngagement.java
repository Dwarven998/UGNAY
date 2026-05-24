package com.ugnay.ugnay.post;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

// PostEngagement.java entity
@Entity @Table(name = "post_engagements")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class PostEngagement {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @ManyToOne @JoinColumn(name = "post_id")
    private Post post;
    private int likes;
    private int comments;
    private int shares;
    private int reach;
    @Column(name = "fetched_at")
    private Instant fetchedAt = Instant.now();
    
    // Computed column helper
    @Transient
    public int getTotalEngagement() { return likes + comments + shares; }
}