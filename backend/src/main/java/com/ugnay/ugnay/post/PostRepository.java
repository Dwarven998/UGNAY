package com.ugnay.ugnay.post;

import com.ugnay.ugnay.core.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface PostRepository extends JpaRepository<Post, UUID> {

    List<Post> findByUserOrderByCreatedAtDesc(User user);

    boolean existsByUserAndScheduledAtBetween(User user, Instant start, Instant end);

    List<Post> findByStatusAndScheduledAtBefore(Post.PostStatus status, Instant before);
}
