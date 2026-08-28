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
