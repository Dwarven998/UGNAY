package com.ugnay.ugnay.post;

import com.ugnay.ugnay.core.User;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface PostRepository extends JpaRepository<Post, UUID> {

    List<Post> findByUserOrderByCreatedAtDesc(User user);

    boolean existsByUserAndScheduledAtBetween(User user, Instant start, Instant end);

    List<Post> findByStatusAndScheduledAtBefore(Post.PostStatus status, Instant before);

    List<Post> findByStatusAndScheduledAtAfterOrderByScheduledAtAsc(Post.PostStatus status, Instant after);

    @Query("""
        select p
        from Post p
        join fetch p.user u
        left join fetch p.mediaAsset
        where p.id = :postId
    """)
    Optional<Post> findDetailedById(@Param("postId") UUID postId);

    @Query("""
        select p
        from Post p
                left join fetch p.mediaAsset
        where p.user.orgName = :orgName
          and p.status = com.ugnay.ugnay.post.Post.PostStatus.SCHEDULED
          and p.scheduledAt between :windowStart and :windowEnd
          and (:excludePostId is null or p.id <> :excludePostId)
        order by p.scheduledAt asc
    """)
    List<Post> findConflictingScheduledPosts(
        @Param("orgName") String orgName,
        @Param("windowStart") Instant windowStart,
        @Param("windowEnd") Instant windowEnd,
        @Param("excludePostId") UUID excludePostId
    );
}
