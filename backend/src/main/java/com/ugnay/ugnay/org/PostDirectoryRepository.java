package com.ugnay.ugnay.org;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface PostDirectoryRepository extends JpaRepository<PostDirectory, UUID> {
    List<PostDirectory> findByOrganizationId(UUID organizationId);
}
