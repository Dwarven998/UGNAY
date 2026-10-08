package com.ugnay.ugnay.caption;

import java.util.NoSuchElementException;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.ugnay.ugnay.core.User;
import com.ugnay.ugnay.org.Organization;
import com.ugnay.ugnay.org.OrganizationPermissionService;
import com.ugnay.ugnay.org.OrganizationRepository;

import lombok.RequiredArgsConstructor;

/**
 * Resolves the AI profile for a workspace.
 * When orgId is non-null, verifies the user is an approved member of that organization
 * and returns the organization's profile.
 * When orgId is null, returns the user's personal workspace profile.
 */
@Service
@RequiredArgsConstructor
public class OrgAiProfileResolver {

    private final OrganizationPermissionService permissionService;
    private final OrganizationRepository organizationRepository;

    public OrgAiProfile resolveProfile(User user, UUID orgId) {
        if (orgId != null) {
            permissionService.requireApprovedMember(user.getId(), orgId);
            Organization org = organizationRepository.findById(orgId)
                .orElseThrow(() -> new NoSuchElementException("Organization not found"));
            return new OrgAiProfile(
                org.getName(),
                org.getFullName(),
                org.getDescription(),
                org.getAudience(),
                org.getFocusAreas(),
                org.getLanguagePref(),
                org.getOfficialHashtags(),
                org.getCaptionAvoid()
            );
        }

        return new OrgAiProfile(
            user.getOrgName(),
            user.getFullName(),
            user.getDescription(),
            user.getAudience(),
            user.getFocusAreas(),
            user.getLanguagePref(),
            user.getOfficialHashtags(),
            user.getCaptionAvoid()
        );
    }
}
