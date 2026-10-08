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
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class OrganizationAdminService {

    // Excludes visually ambiguous characters (0/O, 1/I) from generated join codes.
    private static final String CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int CODE_LENGTH = 8;
    private static final String JOIN_ID_PREFIX = "UNI-";
    private static final int JOIN_ID_LENGTH = 6;
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
        // A Department or Program may optionally be linked under a university by entering that university's
        // Join ID. The Join ID itself is the credential (like a join code), so no role on the university is needed.
        Organization parent = null;
        String parentJoinId = normalizeJoinId(req.parentJoinId());
        if (req.type() != OrgType.UNIVERSITY && parentJoinId != null) {
            parent = organizationRepository.findByJoinId(parentJoinId)
                .filter(o -> o.getType() == OrgType.UNIVERSITY)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "No university matches that Join ID. Check it with the university's admin, or leave it blank."));
        }

        Organization org = Organization.builder()
            .name(req.name().trim())
            .type(req.type())
            .parentOrganization(parent)
            .joinCode(generateUniqueJoinCode())
            .joinId(req.type() == OrgType.UNIVERSITY ? generateUniqueJoinId() : null)
            .openJoin(req.openJoin())
            .createdBy(creator)
            .description(req.description() != null ? req.description().trim() : null)
            .fullName(req.fullName() != null ? req.fullName().trim() : null)
            .audience(req.audience() != null ? req.audience().trim() : null)
            .focusAreas(req.focusAreas() != null ? req.focusAreas().trim() : null)
            .languagePref(req.languagePref() != null ? req.languagePref().trim() : null)
            .officialHashtags(req.officialHashtags() != null ? req.officialHashtags().trim() : null)
            .captionAvoid(req.captionAvoid() != null ? req.captionAvoid().trim() : null)
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
    public OrganizationAdminController.OrgManageDto getManageDetails(User requester, UUID orgId) {
        permissionService.requireManageOrg(requester.getId(), orgId);
        Organization org = getOrgOrThrow(orgId);
        // Universities created before Join IDs existed get one the first time their Manage screen opens.
        if (org.getType() == OrgType.UNIVERSITY && org.getJoinId() == null) {
            org.setJoinId(generateUniqueJoinId());
            organizationRepository.save(org);
        }
        Organization parent = org.getParentOrganization();
        return new OrganizationAdminController.OrgManageDto(
            org.getId(), org.getName(), org.getType(),
            parent != null ? parent.getId() : null,
            parent != null ? parent.getName() : null,
            org.getJoinCode(), org.getJoinId(), org.isOpenJoin(),
            permissionService.canAdministerOrg(requester.getId(), orgId),
            parent != null && permissionService.isOfficerOrAdmin(requester.getId(), parent.getId()),
            org.getDescription(), org.getFullName(), org.getAudience(), org.getFocusAreas(),
            org.getLanguagePref(), org.getOfficialHashtags(), org.getCaptionAvoid());
    }

    @Transactional
    public OrganizationAdminController.OrgManageDto updateProfile(User requester, UUID orgId, OrganizationAdminController.UpdateOrgProfileRequest req) {
        permissionService.requireManageOrg(requester.getId(), orgId);
        Organization org = getOrgOrThrow(orgId);
        if (req.name() != null && !req.name().isBlank()) {
            org.setName(req.name().trim());
        }
        if (req.description() != null) {
            org.setDescription(req.description().trim());
        }
        if (req.fullName() != null) {
            org.setFullName(req.fullName().trim());
        }
        if (req.audience() != null) {
            org.setAudience(req.audience().trim());
        }
        if (req.focusAreas() != null) {
            org.setFocusAreas(req.focusAreas().trim());
        }
        if (req.languagePref() != null) {
            org.setLanguagePref(req.languagePref().trim());
        }
        if (req.officialHashtags() != null) {
            org.setOfficialHashtags(req.officialHashtags().trim());
        }
        if (req.captionAvoid() != null) {
            org.setCaptionAvoid(req.captionAvoid().trim());
        }
        organizationRepository.save(org);
        return getManageDetails(requester, orgId);
    }

    @Transactional
    public OrganizationAdminController.JoinCodeDto regenerateJoinCode(User requester, UUID orgId) {
        permissionService.requireAdministerOrg(requester.getId(), orgId);
        Organization org = getOrgOrThrow(orgId);
        org.setJoinCode(generateUniqueJoinCode());
        organizationRepository.save(org);
        return new OrganizationAdminController.JoinCodeDto(org.getJoinCode());
    }

    @Transactional
    public OrganizationAdminController.JoinIdDto regenerateJoinId(User requester, UUID orgId) {
        permissionService.requireOrgAdmin(requester.getId(), orgId);
        Organization org = requireUniversity(orgId);
        org.setJoinId(generateUniqueJoinId());
        organizationRepository.save(org);
        return new OrganizationAdminController.JoinIdDto(org.getJoinId());
    }

    @Transactional(readOnly = true)
    public List<OrganizationAdminController.SubOrgDto> listSubOrgs(User requester, UUID orgId) {
        permissionService.requireOfficerOrAdmin(requester.getId(), orgId);
        requireUniversity(orgId);
        List<Organization> subOrgs = organizationRepository.findByParentOrganizationId(orgId);
        if (subOrgs.isEmpty()) return List.of();

        Map<UUID, Map<MembershipStatus, Long>> counts = membershipRepository
            .findByOrganizationIdIn(subOrgs.stream().map(Organization::getId).toList()).stream()
            .collect(Collectors.groupingBy(m -> m.getOrganization().getId(),
                Collectors.groupingBy(OrganizationMembership::getStatus, Collectors.counting())));

        return subOrgs.stream()
            .sorted(Comparator.comparing(Organization::getType).thenComparing(o -> o.getName().toLowerCase()))
            .map(o -> {
                Map<MembershipStatus, Long> c = counts.getOrDefault(o.getId(), Map.of());
                return new OrganizationAdminController.SubOrgDto(o.getId(), o.getName(), o.getType(),
                    c.getOrDefault(MembershipStatus.APPROVED, 0L),
                    c.getOrDefault(MembershipStatus.PENDING, 0L),
                    o.getCreatedAt());
            })
            .toList();
    }

    @Transactional
    public void unlinkSubOrg(User requester, UUID orgId, UUID subOrgId) {
        permissionService.requireOrgAdmin(requester.getId(), orgId);
        Organization subOrg = getOrgOrThrow(subOrgId);
        if (subOrg.getParentOrganization() == null || !subOrg.getParentOrganization().getId().equals(orgId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Sub-organization not found");
        }
        subOrg.setParentOrganization(null);
        organizationRepository.save(subOrg);
    }

    public List<OrganizationAdminController.MembershipDto> listMembers(User requester, UUID orgId) {
        permissionService.requireManageOrg(requester.getId(), orgId);
        return membershipRepository.findByOrganizationId(orgId).stream()
            .map(this::toMembershipDto)
            .toList();
    }

    @Transactional
    public OrganizationAdminController.MembershipDto approveMembership(User requester, UUID orgId, UUID membershipId) {
        permissionService.requireManageOrg(requester.getId(), orgId);
        OrganizationMembership membership = getMembershipInOrg(orgId, membershipId);
        membership.setStatus(MembershipStatus.APPROVED);
        membership.setJoinedAt(Instant.now());
        membershipRepository.save(membership);
        return toMembershipDto(membership);
    }

    @Transactional
    public OrganizationAdminController.MembershipDto rejectMembership(User requester, UUID orgId, UUID membershipId) {
        permissionService.requireManageOrg(requester.getId(), orgId);
        OrganizationMembership membership = getMembershipInOrg(orgId, membershipId);
        membership.setStatus(MembershipStatus.REJECTED);
        membershipRepository.save(membership);
        return toMembershipDto(membership);
    }

    @Transactional
    public OrganizationAdminController.MembershipDto changeRole(User requester, UUID orgId, UUID membershipId, OrgRole newRole) {
        // Role assignment is admin-only, distinct from approve/reject which officers may also do.
        permissionService.requireAdministerOrg(requester.getId(), orgId);
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

    private String generateUniqueJoinCode() {
        String code;
        do {
            code = randomCode(CODE_LENGTH);
        } while (organizationRepository.existsByJoinCode(code));
        return code;
    }

    /** University Join IDs carry a fixed prefix so they are never mistaken for a member join code. */
    private String generateUniqueJoinId() {
        String joinId;
        do {
            joinId = JOIN_ID_PREFIX + randomCode(JOIN_ID_LENGTH);
        } while (organizationRepository.existsByJoinId(joinId));
        return joinId;
    }

    private static String randomCode(int length) {
        StringBuilder sb = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            sb.append(CODE_ALPHABET.charAt(RANDOM.nextInt(CODE_ALPHABET.length())));
        }
        return sb.toString();
    }

    /** Accepts "uni-abc123", " UNI-ABC123 " or just "ABC123"; returns null for a blank value. */
    private static String normalizeJoinId(String raw) {
        if (raw == null) return null;
        String value = raw.replaceAll("\\s+", "").toUpperCase(Locale.ROOT);
        if (value.isEmpty()) return null;
        return value.startsWith(JOIN_ID_PREFIX) ? value : JOIN_ID_PREFIX + value;
    }

    private Organization requireUniversity(UUID orgId) {
        Organization org = getOrgOrThrow(orgId);
        if (org.getType() != OrgType.UNIVERSITY) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only a university can have sub-organizations");
        }
        return org;
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
        Organization parent = org.getParentOrganization();
        return new OrganizationAdminController.OrgDto(org.getId(), org.getName(), org.getType(),
            parent != null ? parent.getId() : null, parent != null ? parent.getName() : null,
            org.getJoinCode(), org.getJoinId(), org.isOpenJoin(),
            org.getDescription(), org.getFullName(), org.getAudience(), org.getFocusAreas(),
            org.getLanguagePref(), org.getOfficialHashtags(), org.getCaptionAvoid());
    }

    private OrganizationAdminController.MembershipDto toMembershipDto(OrganizationMembership m) {
        return new OrganizationAdminController.MembershipDto(m.getId(), m.getUser().getId(), m.getUser().getEmail(), m.getRole(), m.getStatus());
    }

    private OrganizationAdminController.DirectoryDto toDirectoryDto(PostDirectory d) {
        return new OrganizationAdminController.DirectoryDto(d.getId(), d.getTitle(), d.getUploadDeadline(), d.getAllowedFileTypes(), d.isRequiresApproval());
    }
}
