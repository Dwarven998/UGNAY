package com.ugnay.ugnay.org;

import com.ugnay.ugnay.org.OrganizationMembership.MembershipStatus;
import com.ugnay.ugnay.org.OrganizationMembership.OrgRole;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;
import java.util.UUID;

/**
 * Central (user, organization, directory) permission-check layer. Callers should
 * go through these explicit checks rather than inlining role comparisons, per the
 * project convention: check role at the (user, organization, directory) tuple,
 * never assume a role in one org applies elsewhere.
 */
@Service
@RequiredArgsConstructor
public class OrganizationPermissionService {

    private final OrganizationRepository organizationRepository;
    private final OrganizationMembershipRepository membershipRepository;
    private final PostDirectoryRepository directoryRepository;
    private final DirectoryContributorRepository contributorRepository;

    public Optional<OrgRole> getApprovedRole(UUID userId, UUID orgId) {
        return membershipRepository.findByUserIdAndOrganizationId(userId, orgId)
            .filter(m -> m.getStatus() == MembershipStatus.APPROVED)
            .map(OrganizationMembership::getRole);
    }

    public boolean isApprovedMember(UUID userId, UUID orgId) {
        return getApprovedRole(userId, orgId).isPresent();
    }

    public boolean hasAnyRole(UUID userId, UUID orgId, OrgRole... roles) {
        Optional<OrgRole> role = getApprovedRole(userId, orgId);
        if (role.isEmpty()) return false;
        for (OrgRole candidate : roles) {
            if (candidate == role.get()) return true;
        }
        return false;
    }

    public boolean isOrgAdmin(UUID userId, UUID orgId) {
        return hasAnyRole(userId, orgId, OrgRole.ADMIN);
    }

    public boolean isOfficerOrAdmin(UUID userId, UUID orgId) {
        return hasAnyRole(userId, orgId, OrgRole.ADMIN, OrgRole.OFFICER);
    }

    /** The university a Department or Program is linked under, or empty for a standalone or top-level org. */
    public Optional<UUID> getParentUniversityId(UUID orgId) {
        return organizationRepository.findParentUniversityId(orgId);
    }

    /**
     * Management access (members, join code) for an org: its own officers/admins, plus the officers/admins
     * of the university it is linked under. Used only by the organization-management screens, so a
     * university role never carries over into a sub-org's posts or media.
     */
    public boolean canManageOrg(UUID userId, UUID orgId) {
        if (isOfficerOrAdmin(userId, orgId)) return true;
        return getParentUniversityId(orgId).map(parentId -> isOfficerOrAdmin(userId, parentId)).orElse(false);
    }

    /** Admin-level management (roles, regenerating codes): the org's admins or its parent university's admins. */
    public boolean canAdministerOrg(UUID userId, UUID orgId) {
        if (isOrgAdmin(userId, orgId)) return true;
        return getParentUniversityId(orgId).map(parentId -> isOrgAdmin(userId, parentId)).orElse(false);
    }

    public void requireManageOrg(UUID userId, UUID orgId) {
        if (!canManageOrg(userId, orgId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Requires officer or admin role");
        }
    }

    public void requireAdministerOrg(UUID userId, UUID orgId) {
        if (!canAdministerOrg(userId, orgId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Requires organization admin role");
        }
    }

    /**
     * True if the user may upload into this directory: officers/admins of the
     * owning org always can, everyone else needs an explicit contributor grant.
     */
    public boolean canUserUploadToDirectory(UUID userId, UUID directoryId) {
        PostDirectory directory = requireDirectory(directoryId);
        UUID orgId = directory.getOrganization().getId();
        if (isOfficerOrAdmin(userId, orgId)) return true;
        if (!isApprovedMember(userId, orgId)) return false;
        return contributorRepository.existsByDirectoryIdAndUserId(directoryId, userId);
    }

    public boolean canUserModerateDirectory(UUID userId, UUID directoryId) {
        PostDirectory directory = requireDirectory(directoryId);
        return isOfficerOrAdmin(userId, directory.getOrganization().getId());
    }

    public void requireApprovedMember(UUID userId, UUID orgId) {
        if (!isApprovedMember(userId, orgId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Requires approved membership in this organization");
        }
    }

    public void requireOrgAdmin(UUID userId, UUID orgId) {
        if (!isOrgAdmin(userId, orgId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Requires organization admin role");
        }
    }

    public void requireOfficerOrAdmin(UUID userId, UUID orgId) {
        if (!isOfficerOrAdmin(userId, orgId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Requires officer or admin role");
        }
    }

    public void requireUploadAccess(UUID userId, UUID directoryId) {
        if (!canUserUploadToDirectory(userId, directoryId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not have upload access to this directory");
        }
    }

    public void requireModerationAccess(UUID userId, UUID directoryId) {
        if (!canUserModerateDirectory(userId, directoryId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Requires officer or admin role to moderate this directory");
        }
    }

    private PostDirectory requireDirectory(UUID directoryId) {
        return directoryRepository.findById(directoryId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Directory not found"));
    }
}
