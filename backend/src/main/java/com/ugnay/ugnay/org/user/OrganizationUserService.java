package com.ugnay.ugnay.org.user;

import com.ugnay.ugnay.core.User;
import com.ugnay.ugnay.org.Organization;
import com.ugnay.ugnay.org.OrganizationMembership;
import com.ugnay.ugnay.org.OrganizationMembershipRepository;
import com.ugnay.ugnay.org.OrganizationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class OrganizationUserService {

    private final OrganizationRepository organizationRepository;
    private final OrganizationMembershipRepository membershipRepository;

    public List<OrganizationController.MyMembershipDto> listMyMemberships(User user) {
        return membershipRepository.findByUserId(user.getId()).stream()
            .map(m -> new OrganizationController.MyMembershipDto(
                m.getOrganization().getId(), m.getOrganization().getName(),
                m.getOrganization().getType(), m.getRole(), m.getStatus()))
            .toList();
    }

    @Transactional
    public OrganizationController.MyMembershipDto joinByCode(User user, String joinCode) {
        Organization org = organizationRepository.findByJoinCode(joinCode)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invalid join code"));

        membershipRepository.findByUserIdAndOrganizationId(user.getId(), org.getId())
            .ifPresent(m -> {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "You already requested or joined this organization");
            });

        // Join codes alone are not sufficient for auto-approval unless the org
        // explicitly configures open-join; default to officer approval.
        OrganizationMembership.MembershipStatus status = org.isOpenJoin()
            ? OrganizationMembership.MembershipStatus.APPROVED
            : OrganizationMembership.MembershipStatus.PENDING;

        OrganizationMembership membership = OrganizationMembership.builder()
            .user(user)
            .organization(org)
            .role(OrganizationMembership.OrgRole.MEMBER)
            .status(status)
            .joinedAt(status == OrganizationMembership.MembershipStatus.APPROVED ? Instant.now() : null)
            .build();
        membershipRepository.save(membership);

        return new OrganizationController.MyMembershipDto(org.getId(), org.getName(), org.getType(), membership.getRole(), membership.getStatus());
    }

    public OrganizationController.OrgSummaryDto getOrgIfMember(User user, UUID orgId) {
        membershipRepository.findByUserIdAndOrganizationId(user.getId(), orgId)
            .filter(m -> m.getStatus() == OrganizationMembership.MembershipStatus.APPROVED)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Not a member of this organization"));

        Organization org = organizationRepository.findById(orgId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organization not found"));
        UUID parentId = org.getParentOrganization() != null ? org.getParentOrganization().getId() : null;
        return new OrganizationController.OrgSummaryDto(org.getId(), org.getName(), org.getType(), parentId);
    }
}
