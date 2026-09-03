package com.ugnay.ugnay.post;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PostEngagementRepository extends JpaRepository<PostEngagement, UUID> {

    Optional<PostEngagement> findFirstByPost_Id(UUID postId);

    default Optional<PostEngagement> findByPost_Id(UUID postId) {
        return findFirstByPost_Id(postId);
    }

    /**
     * Scoped strictly to the given post ids — callers must pre-resolve those ids from a
     * permission-checked post list (personal or a specific organization) so engagement data
     * for one organization/user is never mixed with another's.
     */
    @Query("SELECT e FROM PostEngagement e WHERE e.post.id IN :postIds")
    List<PostEngagement> findByPost_IdIn(@Param("postIds") List<UUID> postIds);

    @Query("SELECT e FROM PostEngagement e WHERE e.post.id IN :postIds ORDER BY (e.likes + e.comments + e.shares) DESC")
    List<PostEngagement> findByPost_IdInOrderByTotalEngagementDesc(@Param("postIds") List<UUID> postIds);
}