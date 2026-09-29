package com.ugnay.ugnay.org;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrganizationRepository extends JpaRepository<Organization, UUID> {
    Optional<Organization> findByJoinCode(String joinCode);
    boolean existsByJoinCode(String joinCode);
    Optional<Organization> findByJoinId(String joinId);
    boolean existsByJoinId(String joinId);
    List<Organization> findByParentOrganizationId(UUID parentOrgId);

    @Query("select p.id from Organization o join o.parentOrganization p "
         + "where o.id = :orgId and p.type = com.ugnay.ugnay.org.Organization.OrgType.UNIVERSITY")
    Optional<UUID> findParentUniversityId(@Param("orgId") UUID orgId);
}
