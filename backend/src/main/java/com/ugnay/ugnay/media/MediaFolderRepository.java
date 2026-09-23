package com.ugnay.ugnay.media;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ugnay.ugnay.core.User;

/**
 * Folders are partitioned by Facebook Page as well as by organization/owner, so a workspace only ever
 * lists the folders of the Page currently connected to it. There is no query that lists across Pages.
 */
public interface MediaFolderRepository extends JpaRepository<MediaFolder, UUID> {

    List<MediaFolder> findByOrganization_IdAndFbPageId(UUID organizationId, String fbPageId);

    /** Folders created while no Page was connected. */
    List<MediaFolder> findByOrganization_IdAndFbPageIdIsNull(UUID organizationId);

    List<MediaFolder> findByUserAndOrganizationIsNullAndFbPageId(User user, String fbPageId);

    List<MediaFolder> findByUserAndOrganizationIsNullAndFbPageIdIsNull(User user);

    /** Folders of one workspace on one Page. A null {@code pageId} yields only folders never assigned to a Page. */
    default List<MediaFolder> findInScope(UUID orgId, User user, String pageId) {
        if (orgId != null) {
            return pageId != null
                ? findByOrganization_IdAndFbPageId(orgId, pageId)
                : findByOrganization_IdAndFbPageIdIsNull(orgId);
        }
        return pageId != null
            ? findByUserAndOrganizationIsNullAndFbPageId(user, pageId)
            : findByUserAndOrganizationIsNullAndFbPageIdIsNull(user);
    }

    /** Hands the folders made while no Page was connected to the Page that has just been connected. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update MediaFolder f set f.fbPageId = :pageId where f.organization.id = :orgId and f.fbPageId is null")
    int claimUnassignedForOrganization(@Param("orgId") UUID orgId, @Param("pageId") String pageId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update MediaFolder f set f.fbPageId = :pageId where f.user = :user and f.organization is null and f.fbPageId is null")
    int claimUnassignedForUser(@Param("user") User user, @Param("pageId") String pageId);
}
