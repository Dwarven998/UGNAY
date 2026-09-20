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

    List<Post> findByUserAndOrganizationIsNullOrderByCreatedAtDesc(User user);

    List<Post> findByOrganization_IdOrderByCreatedAtDesc(UUID organizationId);

    /** One round trip for the summary cards — the database is remote, so every extra query is felt. */
    @Query("""
        select count(distinct p.id) as totalPosts,
               count(distinct case when p.status = com.ugnay.ugnay.post.Post.PostStatus.PUBLISHED then p.id end) as publishedPosts,
               coalesce(sum(e.likes + e.comments + e.shares), 0) as totalEngagement
        from Post p left join PostEngagement e on e.post = p
        where p.organization.id = :orgId
    """)
    PostTotals totalsForOrganization(@Param("orgId") UUID orgId);

    @Query("""
        select count(distinct p.id) as totalPosts,
               count(distinct case when p.status = com.ugnay.ugnay.post.Post.PostStatus.PUBLISHED then p.id end) as publishedPosts,
               coalesce(sum(e.likes + e.comments + e.shares), 0) as totalEngagement
        from Post p left join PostEngagement e on e.post = p
        where p.user = :user and p.organization is null
    """)
    PostTotals totalsForPersonal(@Param("user") User user);

    List<Post> findByOrganization_IdAndStatusOrderByCreatedAtDesc(UUID organizationId, Post.PostStatus status);

    /** True while any post (draft/scheduled — published posts release their asset) still points at an asset in the folder. */
    boolean existsByMediaAsset_Folder_Id(UUID folderId);

    boolean existsByUserAndScheduledAtBetween(User user, Instant start, Instant end);

    List<Post> findByStatusAndScheduledAtBefore(Post.PostStatus status, Instant before);

    List<Post> findByStatusAndScheduledAtAfterOrderByScheduledAtAsc(Post.PostStatus status, Instant after);

    @Query("""
        select distinct p
        from Post p
        join fetch p.user u
        left join fetch p.organization
        left join fetch p.mediaAsset
        left join fetch p.mediaAssets
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
