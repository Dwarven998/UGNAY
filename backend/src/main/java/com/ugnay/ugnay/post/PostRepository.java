package com.ugnay.ugnay.post;

import com.ugnay.ugnay.core.User;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Every listing here is partitioned by Facebook Page as well as by organization/owner: a workspace only
 * ever sees the posts of the Page currently connected to it. There is intentionally no query that lists
 * a workspace's posts across Pages.
 */
public interface PostRepository extends JpaRepository<Post, UUID> {

    List<Post> findByOrganization_IdAndFbPageIdOrderByCreatedAtDesc(UUID organizationId, String fbPageId);

    /** Posts made while no Page was connected. */
    List<Post> findByOrganization_IdAndFbPageIdIsNullOrderByCreatedAtDesc(UUID organizationId);

    List<Post> findByUserAndOrganizationIsNullAndFbPageIdOrderByCreatedAtDesc(User user, String fbPageId);

    List<Post> findByUserAndOrganizationIsNullAndFbPageIdIsNullOrderByCreatedAtDesc(User user);

    List<Post> findByOrganization_IdAndFbPageIdAndStatusOrderByCreatedAtDesc(UUID organizationId, String fbPageId, Post.PostStatus status);

    List<Post> findByOrganization_IdAndFbPageIdIsNullAndStatusOrderByCreatedAtDesc(UUID organizationId, Post.PostStatus status);

    /**
     * The posts of one workspace on one Page: the organization's when {@code orgId} is set, otherwise the
     * user's personal (non-organization) posts. A null {@code pageId} means no Page is connected, which
     * yields only the posts that were never assigned to a Page.
     */
    default List<Post> findInScope(UUID orgId, User user, String pageId) {
        if (orgId != null) {
            return pageId != null
                ? findByOrganization_IdAndFbPageIdOrderByCreatedAtDesc(orgId, pageId)
                : findByOrganization_IdAndFbPageIdIsNullOrderByCreatedAtDesc(orgId);
        }
        return pageId != null
            ? findByUserAndOrganizationIsNullAndFbPageIdOrderByCreatedAtDesc(user, pageId)
            : findByUserAndOrganizationIsNullAndFbPageIdIsNullOrderByCreatedAtDesc(user);
    }

    default List<Post> findInScopeByStatus(UUID orgId, String pageId, Post.PostStatus status) {
        return pageId != null
            ? findByOrganization_IdAndFbPageIdAndStatusOrderByCreatedAtDesc(orgId, pageId, status)
            : findByOrganization_IdAndFbPageIdIsNullAndStatusOrderByCreatedAtDesc(orgId, status);
    }

    /** One round trip for the summary cards — the database is remote, so every extra query is felt. */
    @Query("""
        select count(distinct p.id) as totalPosts,
               count(distinct case when p.status = com.ugnay.ugnay.post.Post.PostStatus.PUBLISHED then p.id end) as publishedPosts,
               coalesce(sum(e.likes + e.comments + e.shares), 0) as totalEngagement
        from Post p left join PostEngagement e on e.post = p
        where p.organization.id = :orgId and p.fbPageId = :pageId
    """)
    PostTotals totalsForOrganization(@Param("orgId") UUID orgId, @Param("pageId") String pageId);

    @Query("""
        select count(distinct p.id) as totalPosts,
               count(distinct case when p.status = com.ugnay.ugnay.post.Post.PostStatus.PUBLISHED then p.id end) as publishedPosts,
               coalesce(sum(e.likes + e.comments + e.shares), 0) as totalEngagement
        from Post p left join PostEngagement e on e.post = p
        where p.user = :user and p.organization is null and p.fbPageId = :pageId
    """)
    PostTotals totalsForPersonal(@Param("user") User user, @Param("pageId") String pageId);

    /** Hands the posts made while no Page was connected to the Page that has just been connected. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update Post p set p.fbPageId = :pageId where p.organization.id = :orgId and p.fbPageId is null")
    int claimUnassignedForOrganization(@Param("orgId") UUID orgId, @Param("pageId") String pageId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update Post p set p.fbPageId = :pageId where p.user = :user and p.organization is null and p.fbPageId is null")
    int claimUnassignedForUser(@Param("user") User user, @Param("pageId") String pageId);

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

    /** Scheduling conflicts are only ever looked up within one organization's own posts on one Page. */
    @Query("""
        select p
        from Post p
                left join fetch p.mediaAsset
        where p.organization.id = :orgId
          and p.fbPageId = :pageId
          and p.status = com.ugnay.ugnay.post.Post.PostStatus.SCHEDULED
          and p.scheduledAt between :windowStart and :windowEnd
          and (:excludePostId is null or p.id <> :excludePostId)
        order by p.scheduledAt asc
    """)
    List<Post> findConflictingScheduledPostsForOrganization(
        @Param("orgId") UUID orgId,
        @Param("pageId") String pageId,
        @Param("windowStart") Instant windowStart,
        @Param("windowEnd") Instant windowEnd,
        @Param("excludePostId") UUID excludePostId
    );

    @Query("""
        select p
        from Post p
                left join fetch p.mediaAsset
        where p.user = :user
          and p.organization is null
          and p.fbPageId = :pageId
          and p.status = com.ugnay.ugnay.post.Post.PostStatus.SCHEDULED
          and p.scheduledAt between :windowStart and :windowEnd
          and (:excludePostId is null or p.id <> :excludePostId)
        order by p.scheduledAt asc
    """)
    List<Post> findConflictingScheduledPostsForUser(
        @Param("user") User user,
        @Param("pageId") String pageId,
        @Param("windowStart") Instant windowStart,
        @Param("windowEnd") Instant windowEnd,
        @Param("excludePostId") UUID excludePostId
    );
}
