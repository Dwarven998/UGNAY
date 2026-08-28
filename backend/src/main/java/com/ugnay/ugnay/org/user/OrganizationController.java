package com.ugnay.ugnay.org.user;

import com.ugnay.ugnay.core.User;
import com.ugnay.ugnay.org.Organization;
import com.ugnay.ugnay.org.OrganizationMembership;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Member-facing organization routes: browse own memberships, join via code.
 * Kept physically separate from {@code org.admin} to keep privileged code
 * paths easy to audit.
 */
@RestController
@RequestMapping("/api/app/organizations")
@RequiredArgsConstructor
public class OrganizationController {

    private final OrganizationUserService service;

    @GetMapping("/mine")
    public ResponseEntity<List<MyMembershipDto>> mine(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(service.listMyMemberships(user));
    }

    @PostMapping("/join")
    public ResponseEntity<MyMembershipDto> join(@AuthenticationPrincipal User user,
                                                @Valid @RequestBody JoinRequest req) {
        return ResponseEntity.ok(service.joinByCode(user, req.joinCode()));
    }

    @GetMapping("/{orgId}")
    public ResponseEntity<OrgSummaryDto> getOrg(@AuthenticationPrincipal User user, @PathVariable UUID orgId) {
        return ResponseEntity.ok(service.getOrgIfMember(user, orgId));
    }

    public record JoinRequest(@NotBlank String joinCode) {}

    public record MyMembershipDto(UUID orgId, String orgName, Organization.OrgType orgType,
                                   OrganizationMembership.OrgRole role,
                                   OrganizationMembership.MembershipStatus status) {}

    public record OrgSummaryDto(UUID id, String name, Organization.OrgType type, UUID parentOrgId) {}
}
