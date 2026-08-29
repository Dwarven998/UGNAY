package com.ugnay.ugnay.org;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface DirectoryContributorRepository extends JpaRepository<DirectoryContributor, UUID> {
    Optional<DirectoryContributor> findByDirectoryIdAndUserId(UUID directoryId, UUID userId);
    List<DirectoryContributor> findByDirectoryId(UUID directoryId);
    boolean existsByDirectoryIdAndUserId(UUID directoryId, UUID userId);
}
