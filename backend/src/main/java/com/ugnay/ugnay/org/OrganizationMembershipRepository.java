package com.ugnay.ugnay.org;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface OrganizationMembershipRepository extends JpaRepository<OrganizationMembership, UUID> {
    Optional<OrganizationMembership> findByUserIdAndOrganizationId(UUID userId, UUID organizationId);
    List<OrganizationMembership> findByOrganizationId(UUID organizationId);
    List<OrganizationMembership> findByUserId(UUID userId);
    List<OrganizationMembership> findByUserIdAndStatus(UUID userId, OrganizationMembership.MembershipStatus status);
}
