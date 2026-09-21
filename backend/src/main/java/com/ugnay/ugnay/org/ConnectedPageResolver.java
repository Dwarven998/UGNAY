package com.ugnay.ugnay.org;

import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.ugnay.ugnay.core.User;

import lombok.RequiredArgsConstructor;

/**
 * Single source of truth for "which Facebook Page is this workspace connected to right now".
 *
 * Posts, Media Repository folders and Analytics are all partitioned by that Page. The Page is always
 * resolved on the server from the organization (or the caller's own personal connection) — never taken
 * from the client — so a caller can only ever read the partition of the Page that is actually connected
 * and that they are a member of.
 */
@Service
@RequiredArgsConstructor
public class ConnectedPageResolver {

    private final OrganizationRepository organizationRepository;
    private final OrganizationPermissionService permissionService;

    /** Membership-checked. Returns the connected Page id for the organization (or the caller's personal workspace), or null when none is connected. */
    public String currentPageId(User user, UUID orgId) {
        if (orgId == null) {
            return normalize(user.getFbPageId());
        }
        permissionService.requireApprovedMember(user.getId(), orgId);
        Organization org = organizationRepository.findById(orgId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organization not found"));
        return normalize(org.getFbPageId());
    }

    /** The Page currently connected to a workspace: the organization's when there is one, otherwise the owner's personal Page. */
    public static String pageIdOf(Organization organization, User owner) {
        if (organization != null) {
            return normalize(organization.getFbPageId());
        }
        return owner != null ? normalize(owner.getFbPageId()) : null;
    }

    public static String normalize(String pageId) {
        return pageId == null || pageId.isBlank() ? null : pageId.trim();
    }
}
