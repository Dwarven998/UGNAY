package com.ugnay.ugnay.media;


import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.ugnay.ugnay.caption.GeminiClient;
import com.ugnay.ugnay.core.User;
import com.ugnay.ugnay.org.Organization;
import com.ugnay.ugnay.org.OrganizationPermissionService;
import com.ugnay.ugnay.org.OrganizationRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class MediaService {

    // Bounds how many images from a folder are sent to Gemini in one ranking call.
    private static final int MAX_RANK_CANDIDATES = 12;

    private final MediaFolderRepository folderRepository;
    private final MediaAssetRepository assetRepository;
    private final OrganizationRepository organizationRepository;
    private final OrganizationPermissionService organizationPermissionService;
    private final GeminiClient geminiClient;

    /** Personal folders (orgId == null) list the caller's own; org folders list that org's, visible to approved members only. */
    public List<MediaController.FolderDto> getFolders(User user, UUID orgId) {
        List<MediaFolder> folders;
        if (orgId != null) {
            organizationPermissionService.requireApprovedMember(user.getId(), orgId);
            folders = folderRepository.findByOrganization_Id(orgId);
        } else {
            folders = folderRepository.findByUser(user);
        }
        return folders.stream()
            .map(f -> new MediaController.FolderDto(f.getId(), f.getName(), f.getAssets().size()))
            .collect(Collectors.toList());
    }

    /** Personal folders can be created by anyone; org folders (org-wide directories) are officer/admin only. */
    @Transactional
    public MediaController.FolderDto createFolder(User user, String name, UUID orgId) {
        MediaFolder.MediaFolderBuilder builder = MediaFolder.builder().name(name).user(user);
        if (orgId != null) {
            organizationPermissionService.requireOfficerOrAdmin(user.getId(), orgId);
            Organization org = organizationRepository.findById(orgId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organization not found"));
            builder.organization(org);
        }
        MediaFolder folder = builder.build();
        folderRepository.save(folder);
        return new MediaController.FolderDto(folder.getId(), folder.getName(), 0);
    }

    @Transactional
    public void deleteFolder(User user, UUID folderId) {
        MediaFolder folder = folderRepository.findById(folderId).orElse(null);
        if (folder == null) return;
        requireManageAccess(user, folder);
        folderRepository.delete(folder);
    }

    public List<MediaController.AssetDto> getAssets(User user, UUID folderId) {
        requireViewAccess(user, folderId);
        return assetRepository.findByFolder_Id(folderId).stream()
            .map(a -> new MediaController.AssetDto(a.getId(), a.getFileName(), a.getFileUrl(), a.getFileType()))
            .collect(Collectors.toList());
    }

    @Transactional
    public MediaController.AssetDto saveAsset(User user, MediaController.AssetMetaRequest req) {
        // Any approved org member can upload into an org folder; a personal folder only accepts its owner.
        MediaFolder folder = requireViewAccess(user, req.folderId());
        MediaAsset asset = MediaAsset.builder()
            .user(user).folder(folder)
            .fileName(req.fileName()).fileUrl(req.fileUrl()).fileType(req.fileType())
            .build();
        assetRepository.save(asset);
        return new MediaController.AssetDto(asset.getId(), asset.getFileName(), asset.getFileUrl(), asset.getFileType());
    }

    @Transactional
    public void deleteAsset(User user, UUID assetId) {
        MediaAsset asset = assetRepository.findById(assetId).orElse(null);
        if (asset == null) return;
        boolean isUploader = asset.getUser() != null && asset.getUser().getId().equals(user.getId());
        if (!isUploader) {
            requireManageAccess(user, asset.getFolder());
        }
        assetRepository.delete(asset);
    }

    /**
     * AI image recommendation (CLAUDE.md Caption Studio flow): given a folder and a
     * free-text description, ranks that folder's images best-match-first.
     */
    public List<MediaController.RecommendationDto> recommendImages(User user, UUID folderId, String description) {
        MediaFolder folder = requireViewAccess(user, folderId);

        List<MediaAsset> images = assetRepository.findByFolder_Id(folder.getId()).stream()
            .filter(a -> a.getFileType() != null && a.getFileType().startsWith("image"))
            .limit(MAX_RANK_CANDIDATES)
            .toList();

        if (images.isEmpty()) {
            return List.of();
        }

        Map<UUID, MediaAsset> byId = images.stream()
            .collect(Collectors.toMap(MediaAsset::getId, a -> a));

        List<GeminiClient.AssetForRanking> candidates = images.stream()
            .map(a -> new GeminiClient.AssetForRanking(a.getId(), a.getFileUrl()))
            .toList();

        return geminiClient.rankImages(candidates, description).stream()
            .filter(r -> byId.containsKey(r.id()))
            .map(r -> {
                MediaAsset a = byId.get(r.id());
                return new MediaController.RecommendationDto(a.getId(), a.getFileName(), a.getFileUrl(), a.getFileType(), r.score(), r.reason());
            })
            .toList();
    }

    /**
     * Caption Studio entry point: user selects multiple images in Media Repository,
     * this resolves them (with access checks) and generates 3 caption options
     * treating them as one cohesive post.
     */
    public List<String> generateCaptionsFromAssets(User user, List<UUID> assetIds, String tone) {
        if (assetIds == null || assetIds.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No images selected");
        }
        if (assetIds.size() > GeminiClient.MAX_CAPTION_IMAGES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Too many images selected (max " + GeminiClient.MAX_CAPTION_IMAGES + ")");
        }

        List<MediaAsset> assets = assetRepository.findAllById(assetIds);
        if (assets.size() != assetIds.size()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "One or more assets not found");
        }

        // Same access model as recommendImages: check every distinct folder touched.
        assets.stream()
            .map(a -> a.getFolder().getId())
            .distinct()
            .forEach(folderId -> requireViewAccess(user, folderId));

        List<String> imageUrls = assets.stream()
            .filter(a -> a.getFileType() != null && a.getFileType().startsWith("image"))
            .map(MediaAsset::getFileUrl)
            .toList();

        if (imageUrls.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No image assets in selection");
        }

        return geminiClient.generateCaptionsMultiImage(imageUrls, tone, user.getOrgName());
    }

    /** Org folders: must be an approved member of the owning org. Personal folders: must be the owner. */
    private MediaFolder requireViewAccess(User user, UUID folderId) {
        MediaFolder folder = folderRepository.findById(folderId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Folder not found"));
        if (folder.getOrganization() != null) {
            organizationPermissionService.requireApprovedMember(user.getId(), folder.getOrganization().getId());
        } else if (folder.getUser() == null || !folder.getUser().getId().equals(user.getId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Folder not found");
        }
        return folder;
    }

    /** Org folders: officer/admin of the owning org. Personal folders: the owner. */
    private void requireManageAccess(User user, MediaFolder folder) {
        if (folder.getOrganization() != null) {
            organizationPermissionService.requireOfficerOrAdmin(user.getId(), folder.getOrganization().getId());
        } else if (folder.getUser() == null || !folder.getUser().getId().equals(user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not allowed");
        }
    }
}