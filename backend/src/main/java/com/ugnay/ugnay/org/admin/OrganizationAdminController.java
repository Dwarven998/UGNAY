package com.ugnay.ugnay.org.admin;

import com.ugnay.ugnay.core.User;
import com.ugnay.ugnay.org.Organization;
import com.ugnay.ugnay.org.OrganizationMembership;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
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

    @PostMapping("/{orgId}/join-code/regenerate")
    public ResponseEntity<JoinCodeDto> regenerateJoinCode(@AuthenticationPrincipal User user,
                                                           @PathVariable UUID orgId) {
        return ResponseEntity.ok(service.regenerateJoinCode(user, orgId));
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

    // --- DTOs ---

    public record CreateOrgRequest(
        @NotBlank String name,
        @NotNull Organization.OrgType type,
        UUID parentOrgId,
        boolean openJoin
    ) {}

    public record OrgDto(UUID id, String name, Organization.OrgType type, UUID parentOrgId,
                          String joinCode, boolean openJoin) {}

    public record JoinCodeDto(String joinCode) {}

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
