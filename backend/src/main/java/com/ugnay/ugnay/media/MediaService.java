package com.ugnay.ugnay.media;


import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ugnay.ugnay.core.User;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class MediaService {

    private final MediaFolderRepository folderRepository;
    private final MediaAssetRepository assetRepository;

    public List<MediaController.FolderDto> getFolders(User user) {
        return folderRepository.findByUser(user).stream()
            .map(f -> new MediaController.FolderDto(f.getId(), f.getName(), f.getAssets().size()))
            .collect(Collectors.toList());
    }

    @Transactional
    public MediaController.FolderDto createFolder(User user, String name) {
        MediaFolder folder = MediaFolder.builder().user(user).name(name).build();
        folderRepository.save(folder);
        return new MediaController.FolderDto(folder.getId(), folder.getName(), 0);
    }

    @Transactional
    public void deleteFolder(User user, UUID folderId) {
        folderRepository.findById(folderId)
            .filter(f -> f.getUser().getId().equals(user.getId()))
            .ifPresent(folderRepository::delete);
    }

    public List<MediaController.AssetDto> getAssets(User user, UUID folderId) {
        return assetRepository.findByFolder_Id(folderId).stream()
            .map(a -> new MediaController.AssetDto(a.getId(), a.getFileName(), a.getFileUrl(), a.getFileType()))
            .collect(Collectors.toList());
    }

    @Transactional
    public MediaController.AssetDto saveAsset(User user, MediaController.AssetMetaRequest req) {
        MediaFolder folder = folderRepository.findById(req.folderId()).orElseThrow();
        MediaAsset asset = MediaAsset.builder()
            .user(user).folder(folder)
            .fileName(req.fileName()).fileUrl(req.fileUrl()).fileType(req.fileType())
            .build();
        assetRepository.save(asset);
        return new MediaController.AssetDto(asset.getId(), asset.getFileName(), asset.getFileUrl(), asset.getFileType());
    }

    @Transactional
    public void deleteAsset(User user, UUID assetId) {
        assetRepository.findById(assetId)
            .filter(a -> a.getUser().getId().equals(user.getId()))
            .ifPresent(assetRepository::delete);
    }
}