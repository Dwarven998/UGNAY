package com.ugnay.ugnay.org.admin;

import com.ugnay.ugnay.core.User;
import com.ugnay.ugnay.core.UserRepository;
import com.ugnay.ugnay.media.MediaFolder;
import com.ugnay.ugnay.media.MediaFolderRepository;
import com.ugnay.ugnay.org.*;
import com.ugnay.ugnay.org.Organization.OrgType;
import com.ugnay.ugnay.org.OrganizationMembership.MembershipStatus;
import com.ugnay.ugnay.org.OrganizationMembership.OrgRole;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class OrganizationAdminService {

    // Excludes visually ambiguous characters (0/O, 1/I) from generated join codes.
    private static final String CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int CODE_LENGTH = 8;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final OrganizationRepository organizationRepository;
    private final OrganizationMembershipRepository membershipRepository;
    private final PostDirectoryRepository directoryRepository;
    private final DirectoryContributorRepository contributorRepository;
    private final MediaFolderRepository mediaFolderRepository;
    private final UserRepository userRepository;
    private final OrganizationPermissionService permissionService;

    @Transactional
    public OrganizationAdminController.OrgDto createOrganization(User creator, OrganizationAdminController.CreateOrgRequest req) {
        Organization parent = null;
        if (req.parentOrgId() != null) {
            parent = getOrgOrThrow(req.parentOrgId());
            // Creating a child org requires admin rights on the parent org.
            permissionService.requireOrgAdmin(creator.getId(), parent.getId());
        }
        validateHierarchy(req.type(), parent);

        Organization org = Organization.builder()
            .name(req.name())
            .type(req.type())
            .parentOrganization(parent)
            .joinCode(generateUniqueJoinCode())
            .openJoin(req.openJoin())
            .createdBy(creator)
            .build();
        organizationRepository.save(org);

        membershipRepository.save(OrganizationMembership.builder()
            .user(creator)
            .organization(org)
            .role(OrgRole.ADMIN)
            .status(MembershipStatus.APPROVED)
            .joinedAt(Instant.now())
            .build());

        // Every organization starts with a default Media Repository directory,
        // visible to any approved member as soon as they join.
        mediaFolderRepository.save(MediaFolder.builder()
            .organization(org)
            .user(creator)
            .name("General")
            .build());

        return toDto(org);
    }

    @Transactional
    public OrganizationAdminController.JoinCodeDto regenerateJoinCode(User requester, UUID orgId) {
        permissionService.requireOrgAdmin(requester.getId(), orgId);
        Organization org = getOrgOrThrow(orgId);
        org.setJoinCode(generateUniqueJoinCode());
        organizationRepository.save(org);
        return new OrganizationAdminController.JoinCodeDto(org.getJoinCode());
    }

    public List<OrganizationAdminController.MembershipDto> listMembers(User requester, UUID orgId) {
        permissionService.requireOfficerOrAdmin(requester.getId(), orgId);
        return membershipRepository.findByOrganizationId(orgId).stream()
            .map(this::toMembershipDto)
            .toList();
    }

    @Transactional
    public OrganizationAdminController.MembershipDto approveMembership(User requester, UUID orgId, UUID membershipId) {
        permissionService.requireOfficerOrAdmin(requester.getId(), orgId);
        OrganizationMembership membership = getMembershipInOrg(orgId, membershipId);
        membership.setStatus(MembershipStatus.APPROVED);
        membership.setJoinedAt(Instant.now());
        membershipRepository.save(membership);
        return toMembershipDto(membership);
    }

    @Transactional
    public OrganizationAdminController.MembershipDto rejectMembership(User requester, UUID orgId, UUID membershipId) {
        permissionService.requireOfficerOrAdmin(requester.getId(), orgId);
        OrganizationMembership membership = getMembershipInOrg(orgId, membershipId);
        membership.setStatus(MembershipStatus.REJECTED);
        membershipRepository.save(membership);
        return toMembershipDto(membership);
    }

    @Transactional
    public OrganizationAdminController.MembershipDto changeRole(User requester, UUID orgId, UUID membershipId, OrgRole newRole) {
        // Role assignment is admin-only, distinct from approve/reject which officers may also do.
        permissionService.requireOrgAdmin(requester.getId(), orgId);
        OrganizationMembership membership = getMembershipInOrg(orgId, membershipId);
        membership.setRole(newRole);
        membershipRepository.save(membership);
        return toMembershipDto(membership);
    }

    @Transactional
    public OrganizationAdminController.DirectoryDto createDirectory(User requester, UUID orgId, OrganizationAdminController.CreateDirectoryRequest req) {
        permissionService.requireOfficerOrAdmin(requester.getId(), orgId);
        Organization org = getOrgOrThrow(orgId);
        PostDirectory directory = PostDirectory.builder()
            .organization(org)
            .title(req.title())
            .uploadDeadline(req.uploadDeadline())
            .allowedFileTypes(req.allowedFileTypes())
            .requiresApproval(req.requiresApproval())
            .createdBy(requester)
            .build();
        directoryRepository.save(directory);
        return toDirectoryDto(directory);
    }

    public List<OrganizationAdminController.DirectoryDto> listDirectories(User requester, UUID orgId) {
        permissionService.requireOfficerOrAdmin(requester.getId(), orgId);
        return directoryRepository.findByOrganizationId(orgId).stream()
            .map(this::toDirectoryDto)
            .toList();
    }

    public List<OrganizationAdminController.ContributorDto> listContributors(User requester, UUID orgId, UUID directoryId) {
        permissionService.requireOfficerOrAdmin(requester.getId(), orgId);
        getDirectoryInOrg(orgId, directoryId);
        return contributorRepository.findByDirectoryId(directoryId).stream()
            .map(c -> new OrganizationAdminController.ContributorDto(c.getUser().getId(), c.getUser().getEmail()))
            .toList();
    }

    @Transactional
    public OrganizationAdminController.ContributorDto grantContributor(User requester, UUID orgId, UUID directoryId, String email) {
        permissionService.requireOfficerOrAdmin(requester.getId(), orgId);
        PostDirectory directory = getDirectoryInOrg(orgId, directoryId);
        User target = userRepository.findByEmail(email)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        if (!permissionService.isApprovedMember(target.getId(), orgId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "User must be an approved member of the organization before being granted contributor access");
        }
        contributorRepository.findByDirectoryIdAndUserId(directoryId, target.getId())
            .ifPresent(c -> { throw new ResponseStatusException(HttpStatus.CONFLICT, "User already has contributor access"); });

        DirectoryContributor contributor = DirectoryContributor.builder()
            .directory(directory)
            .user(target)
            .grantedBy(requester)
            .build();
        contributorRepository.save(contributor);
        return new OrganizationAdminController.ContributorDto(target.getId(), target.getEmail());
    }

    @Transactional
    public void revokeContributor(User requester, UUID orgId, UUID directoryId, UUID targetUserId) {
        permissionService.requireOfficerOrAdmin(requester.getId(), orgId);
        getDirectoryInOrg(orgId, directoryId);
        DirectoryContributor contributor = contributorRepository.findByDirectoryIdAndUserId(directoryId, targetUserId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Contributor grant not found"));
        contributorRepository.delete(contributor);
    }

    // --- helpers ---

    private void validateHierarchy(OrgType type, Organization parent) {
        switch (type) {
            case UNIVERSITY -> {
                if (parent != null) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A university-level organization cannot have a parent");
                }
            }
            case DEPARTMENT -> {
                if (parent == null || parent.getType() != OrgType.UNIVERSITY) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A department must have a university-level parent");
                }
            }
            case PROGRAM -> {
                if (parent == null || parent.getType() != OrgType.DEPARTMENT) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A program must have a department-level parent");
                }
            }
        }
    }

    private String generateUniqueJoinCode() {
        String code;
        do {
            StringBuilder sb = new StringBuilder(CODE_LENGTH);
            for (int i = 0; i < CODE_LENGTH; i++) {
                sb.append(CODE_ALPHABET.charAt(RANDOM.nextInt(CODE_ALPHABET.length())));
            }
            code = sb.toString();
        } while (organizationRepository.existsByJoinCode(code));
        return code;
    }

    private Organization getOrgOrThrow(UUID orgId) {
        return organizationRepository.findById(orgId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organization not found"));
    }

    private OrganizationMembership getMembershipInOrg(UUID orgId, UUID membershipId) {
        OrganizationMembership membership = membershipRepository.findById(membershipId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Membership not found"));
        if (!membership.getOrganization().getId().equals(orgId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Membership not found");
        }
        return membership;
    }

    private PostDirectory getDirectoryInOrg(UUID orgId, UUID directoryId) {
        PostDirectory directory = directoryRepository.findById(directoryId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Directory not found"));
        if (!directory.getOrganization().getId().equals(orgId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Directory not found");
        }
        return directory;
    }

    private OrganizationAdminController.OrgDto toDto(Organization org) {
        UUID parentId = org.getParentOrganization() != null ? org.getParentOrganization().getId() : null;
        return new OrganizationAdminController.OrgDto(org.getId(), org.getName(), org.getType(), parentId, org.getJoinCode(), org.isOpenJoin());
    }

    private OrganizationAdminController.MembershipDto toMembershipDto(OrganizationMembership m) {
        return new OrganizationAdminController.MembershipDto(m.getId(), m.getUser().getId(), m.getUser().getEmail(), m.getRole(), m.getStatus());
    }

    private OrganizationAdminController.DirectoryDto toDirectoryDto(PostDirectory d) {
        return new OrganizationAdminController.DirectoryDto(d.getId(), d.getTitle(), d.getUploadDeadline(), d.getAllowedFileTypes(), d.isRequiresApproval());
    }
}
