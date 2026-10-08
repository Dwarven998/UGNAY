package com.ugnay.ugnay.org.admin;

import com.ugnay.ugnay.core.User;
import com.ugnay.ugnay.org.Organization;
import com.ugnay.ugnay.org.OrganizationMembership;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Officer/Admin-only organization management routes. Kept physically separate
 * from the member-facing routes in {@code org.user} so privileged code paths
 * are easy to audit.
 */
@RestController
@RequestMapping("/api/admin/organizations")
@RequiredArgsConstructor
public class OrganizationAdminController {

    private final OrganizationAdminService service;

    @PostMapping
    public ResponseEntity<OrgDto> create(@AuthenticationPrincipal User user,
                                          @Valid @RequestBody CreateOrgRequest req) {
        return ResponseEntity.ok(service.createOrganization(user, req));
    }

    /** Everything the Manage screen needs: codes, parent university, and what the viewer may change. */
    @GetMapping("/{orgId}")
    public ResponseEntity<OrgManageDto> get(@AuthenticationPrincipal User user, @PathVariable UUID orgId) {
        return ResponseEntity.ok(service.getManageDetails(user, orgId));
    }

    @PostMapping("/{orgId}/join-code/regenerate")
    public ResponseEntity<JoinCodeDto> regenerateJoinCode(@AuthenticationPrincipal User user,
                                                           @PathVariable UUID orgId) {
        return ResponseEntity.ok(service.regenerateJoinCode(user, orgId));
    }

    @PostMapping("/{orgId}/join-id/regenerate")
    public ResponseEntity<JoinIdDto> regenerateJoinId(@AuthenticationPrincipal User user,
                                                       @PathVariable UUID orgId) {
        return ResponseEntity.ok(service.regenerateJoinId(user, orgId));
    }

    /** Departments and programs linked under a university. */
    @GetMapping("/{orgId}/sub-orgs")
    public ResponseEntity<List<SubOrgDto>> listSubOrgs(@AuthenticationPrincipal User user,
                                                        @PathVariable UUID orgId) {
        return ResponseEntity.ok(service.listSubOrgs(user, orgId));
    }

    /** Unlinks a sub-organization from the university; the sub-org itself and its members are kept. */
    @DeleteMapping("/{orgId}/sub-orgs/{subOrgId}")
    public ResponseEntity<Void> unlinkSubOrg(@AuthenticationPrincipal User user,
                                             @PathVariable UUID orgId,
                                             @PathVariable UUID subOrgId) {
        service.unlinkSubOrg(user, orgId, subOrgId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{orgId}/members")
    public ResponseEntity<List<MembershipDto>> listMembers(@AuthenticationPrincipal User user,
                                                            @PathVariable UUID orgId) {
        return ResponseEntity.ok(service.listMembers(user, orgId));
    }

    @PostMapping("/{orgId}/members/{membershipId}/approve")
    public ResponseEntity<MembershipDto> approve(@AuthenticationPrincipal User user,
                                                  @PathVariable UUID orgId,
                                                  @PathVariable UUID membershipId) {
        return ResponseEntity.ok(service.approveMembership(user, orgId, membershipId));
    }

    @PostMapping("/{orgId}/members/{membershipId}/reject")
    public ResponseEntity<MembershipDto> reject(@AuthenticationPrincipal User user,
                                                 @PathVariable UUID orgId,
                                                 @PathVariable UUID membershipId) {
        return ResponseEntity.ok(service.rejectMembership(user, orgId, membershipId));
    }

    @PatchMapping("/{orgId}/members/{membershipId}/role")
    public ResponseEntity<MembershipDto> changeRole(@AuthenticationPrincipal User user,
                                                     @PathVariable UUID orgId,
                                                     @PathVariable UUID membershipId,
                                                     @Valid @RequestBody RoleChangeRequest req) {
        return ResponseEntity.ok(service.changeRole(user, orgId, membershipId, req.role()));
    }

    @PostMapping("/{orgId}/directories")
    public ResponseEntity<DirectoryDto> createDirectory(@AuthenticationPrincipal User user,
                                                         @PathVariable UUID orgId,
                                                         @Valid @RequestBody CreateDirectoryRequest req) {
        return ResponseEntity.ok(service.createDirectory(user, orgId, req));
    }

    @GetMapping("/{orgId}/directories")
    public ResponseEntity<List<DirectoryDto>> listDirectories(@AuthenticationPrincipal User user,
                                                               @PathVariable UUID orgId) {
        return ResponseEntity.ok(service.listDirectories(user, orgId));
    }

    @GetMapping("/{orgId}/directories/{directoryId}/contributors")
    public ResponseEntity<List<ContributorDto>> listContributors(@AuthenticationPrincipal User user,
                                                                  @PathVariable UUID orgId,
                                                                  @PathVariable UUID directoryId) {
        return ResponseEntity.ok(service.listContributors(user, orgId, directoryId));
    }

    @PostMapping("/{orgId}/directories/{directoryId}/contributors")
    public ResponseEntity<ContributorDto> grantContributor(@AuthenticationPrincipal User user,
                                                            @PathVariable UUID orgId,
                                                            @PathVariable UUID directoryId,
                                                            @Valid @RequestBody GrantContributorRequest req) {
        return ResponseEntity.ok(service.grantContributor(user, orgId, directoryId, req.email()));
    }

    @DeleteMapping("/{orgId}/directories/{directoryId}/contributors/{contributorUserId}")
    public ResponseEntity<Void> revokeContributor(@AuthenticationPrincipal User user,
                                                  @PathVariable UUID orgId,
                                                  @PathVariable UUID directoryId,
                                                  @PathVariable UUID contributorUserId) {
        service.revokeContributor(user, orgId, directoryId, contributorUserId);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{orgId}/profile")
    public ResponseEntity<OrgManageDto> updateProfile(@AuthenticationPrincipal User user,
                                                       @PathVariable UUID orgId,
                                                       @Valid @RequestBody UpdateOrgProfileRequest req) {
        return ResponseEntity.ok(service.updateProfile(user, orgId, req));
    }

    // --- DTOs ---

    /**
     * {@code parentJoinId} is optional and only read for a DEPARTMENT or PROGRAM: a university's Join ID
     * that lists the new org as a sub-organization of that university.
     */
    public record CreateOrgRequest(
        @NotBlank @Size(max = 255) String name,
        @NotNull Organization.OrgType type,
        @Size(max = 32) String parentJoinId,
        boolean openJoin,
        String description,
        String fullName,
        String audience,
        String focusAreas,
        String languagePref,
        String officialHashtags,
        String captionAvoid
    ) {}

    public record OrgDto(UUID id, String name, Organization.OrgType type, UUID parentOrgId, String parentOrgName,
                          String joinCode, String joinId, boolean openJoin,
                          String description, String fullName, String audience, String focusAreas,
                          String languagePref, String officialHashtags, String captionAvoid) {}

    public record OrgManageDto(UUID id, String name, Organization.OrgType type,
                                UUID parentOrgId, String parentOrgName,
                                String joinCode, String joinId, boolean openJoin,
                                boolean canAdminister, boolean canManageParent,
                                String description, String fullName, String audience, String focusAreas,
                                String languagePref, String officialHashtags, String captionAvoid) {}

    public record UpdateOrgProfileRequest(
        @Size(max = 255) String name,
        String description,
        @Size(max = 255) String fullName,
        @Size(max = 255) String audience,
        String focusAreas,
        @Size(max = 100) String languagePref,
        @Size(max = 255) String officialHashtags,
        String captionAvoid
    ) {}

    public record JoinCodeDto(String joinCode) {}

    public record JoinIdDto(String joinId) {}

    public record SubOrgDto(UUID id, String name, Organization.OrgType type,
                             long memberCount, long pendingCount, Instant createdAt) {}

    public record MembershipDto(UUID membershipId, UUID userId, String email,
                                 OrganizationMembership.OrgRole role,
                                 OrganizationMembership.MembershipStatus status) {}

    public record RoleChangeRequest(@NotNull OrganizationMembership.OrgRole role) {}

    public record CreateDirectoryRequest(@NotBlank String title, Instant uploadDeadline,
                                          String[] allowedFileTypes, boolean requiresApproval) {}

    public record DirectoryDto(UUID id, String title, Instant uploadDeadline,
                                String[] allowedFileTypes, boolean requiresApproval) {}

    public record GrantContributorRequest(@Email @NotBlank String email) {}

    public record ContributorDto(UUID userId, String email) {}
}
