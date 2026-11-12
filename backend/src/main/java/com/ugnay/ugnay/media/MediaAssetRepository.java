package com.ugnay.ugnay.media;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface MediaAssetRepository extends JpaRepository<MediaAsset, UUID> {
    List<MediaAsset> findByFolder_Id(UUID folderId);

    Optional<MediaAsset> findFirstByFolder_IdAndFileUrl(UUID folderId, String fileUrl);
}
