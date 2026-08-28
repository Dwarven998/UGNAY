package com.ugnay.ugnay.org;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface OrganizationRepository extends JpaRepository<Organization, UUID> {
    Optional<Organization> findByJoinCode(String joinCode);
    boolean existsByJoinCode(String joinCode);
    List<Organization> findByParentOrganizationId(UUID parentOrgId);
}
