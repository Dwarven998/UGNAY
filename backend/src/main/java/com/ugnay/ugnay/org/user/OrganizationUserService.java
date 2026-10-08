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
                m.getOrganization().getType(), m.getRole(), m.getStatus(),
                m.getOrganization().getDescription(),
                m.getOrganization().getFullName(),
                m.getOrganization().getAudience(),
                m.getOrganization().getFocusAreas(),
                m.getOrganization().getLanguagePref(),
                m.getOrganization().getOfficialHashtags(),
                m.getOrganization().getCaptionAvoid()))
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

        return new OrganizationController.MyMembershipDto(
            org.getId(), org.getName(), org.getType(), membership.getRole(), membership.getStatus(),
            org.getDescription(), org.getFullName(), org.getAudience(),
            org.getFocusAreas(), org.getLanguagePref(), org.getOfficialHashtags(),
            org.getCaptionAvoid());
    }

    public OrganizationController.OrgSummaryDto getOrgIfMember(User user, UUID orgId) {
        membershipRepository.findByUserIdAndOrganizationId(user.getId(), orgId)
            .filter(m -> m.getStatus() == OrganizationMembership.MembershipStatus.APPROVED)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Not a member of this organization"));

        Organization org = organizationRepository.findById(orgId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organization not found"));
        UUID parentId = org.getParentOrganization() != null ? org.getParentOrganization().getId() : null;
        return new OrganizationController.OrgSummaryDto(
            org.getId(), org.getName(), org.getType(), parentId,
            org.getDescription(), org.getFullName(), org.getAudience(), org.getFocusAreas(),
            org.getLanguagePref(), org.getOfficialHashtags(), org.getCaptionAvoid());
    }

    @Transactional(readOnly = true)
    public List<OrganizationController.OrgMemberDto> listMembersIfMember(User user, UUID orgId) {
        membershipRepository.findByUserIdAndOrganizationId(user.getId(), orgId)
            .filter(m -> m.getStatus() == OrganizationMembership.MembershipStatus.APPROVED)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Not a member of this organization"));

        return membershipRepository.findByOrganizationId(orgId).stream()
            .filter(m -> m.getStatus() == OrganizationMembership.MembershipStatus.APPROVED)
            .map(m -> new OrganizationController.OrgMemberDto(m.getUser().getId(), m.getUser().getEmail(), m.getRole()))
            .toList();
    }

    @Transactional
    public void leave(User user, UUID orgId) {
        OrganizationMembership membership = membershipRepository.findByUserIdAndOrganizationId(user.getId(), orgId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "You are not a member of this organization"));

        // Privileged roles (admin/officer/contributor) keep their existing admin-managed flow.
        if (membership.getRole() != OrganizationMembership.OrgRole.MEMBER) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                "Only members can leave directly. Ask an admin to change your role first.");
        }
        membershipRepository.delete(membership);
    }
}
