package com.ugnay.ugnay.media;


import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.server.ResponseStatusException;

import com.ugnay.ugnay.caption.GeminiClient;
import com.ugnay.ugnay.caption.OrgAiProfile;
import com.ugnay.ugnay.caption.OrgAiProfileResolver;
import com.ugnay.ugnay.core.User;
import com.ugnay.ugnay.org.ConnectedPageResolver;
import com.ugnay.ugnay.org.Organization;
import com.ugnay.ugnay.org.OrganizationPermissionService;
import com.ugnay.ugnay.org.OrganizationRepository;
import com.ugnay.ugnay.post.PostRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class MediaService {

    // Bounds how many images from a folder are sent to Gemini in one ranking call.
    private static final int MAX_RANK_CANDIDATES = 12;
    private static final int MAX_BULK_DELETE = 200;
    private static final int MAX_FOLDER_NAME = 100;
    private static final String ASSET_IN_USE_MESSAGE =
        "Used by a draft or scheduled post. Remove it from that post or publish the post first.";

    private final MediaFolderRepository folderRepository;
    private final MediaAssetRepository assetRepository;
    private final OrganizationRepository organizationRepository;
    private final OrganizationPermissionService organizationPermissionService;
    private final ConnectedPageResolver connectedPageResolver;
    private final GeminiClient geminiClient;
    private final SupabaseStorageService supabaseStorageService;
    private final PostRepository postRepository;
    private final OrgAiProfileResolver orgAiProfileResolver;

    /**
     * Personal folders (orgId == null) list the caller's own; org folders list that org's, visible to approved
     * members only. Either way only the folders of the Facebook Page currently connected to that workspace are
     * returned, so switching Pages never carries the previous Page's media over.
     */
    public List<MediaController.FolderDto> getFolders(User user, UUID orgId) {
        String pageId = connectedPageResolver.currentPageId(user, orgId);
        List<MediaFolder> folders = folderRepository.findInScope(orgId, user, pageId);
        return folders.stream()
            .map(f -> new MediaController.FolderDto(f.getId(), f.getName(), f.getAssets().size()))
            .collect(Collectors.toList());
    }

    /** Personal folders can be created by anyone; org folders (org-wide directories) are officer/admin only. */
    @Transactional
    public MediaController.FolderDto createFolder(User user, String name, UUID orgId) {
        MediaFolder.MediaFolderBuilder builder = MediaFolder.builder().name(name).user(user)
            .fbPageId(ConnectedPageResolver.normalize(user.getFbPageId()));
        if (orgId != null) {
            organizationPermissionService.requireOfficerOrAdmin(user.getId(), orgId);
            Organization org = organizationRepository.findById(orgId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organization not found"));
            builder.organization(org).fbPageId(ConnectedPageResolver.normalize(org.getFbPageId()));
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
        // Posts hold a FK to their asset; deleting underneath a pending post would fail (or strip its image).
        if (postRepository.existsByMediaAsset_Folder_Id(folderId) || postRepository.existsByMediaAssets_Folder_Id(folderId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "This folder has media used by a draft or scheduled post. Remove or publish those posts first.");
        }
        List<String> fileUrls = folder.getAssets().stream().map(MediaAsset::getFileUrl).toList();
        folderRepository.delete(folder);
        deleteStoredFilesAfterCommit(fileUrls);
    }

    @Transactional(readOnly = true)
    public List<MediaController.AssetDto> getAssets(User user, UUID folderId) {
        requireViewAccess(user, folderId);
        return assetRepository.findByFolder_Id(folderId).stream()
            .map(MediaService::toAssetDto)
            .collect(Collectors.toList());
    }

    @Transactional
    public MediaController.AssetDto saveAsset(User user, MediaController.AssetMetaRequest req) {
        // Any approved org member can upload into an org folder; a personal folder only accepts its owner.
        MediaFolder folder = requireViewAccess(user, req.folderId());
        MediaAsset asset = MediaAsset.builder()
            .user(user).folder(folder)
            .fileName(req.fileName()).fileUrl(req.fileUrl()).fileType(req.fileType())
            .fileSize(req.fileSize() != null && req.fileSize() >= 0 ? req.fileSize() : null)
            .build();
        assetRepository.save(asset);
        return toAssetDto(asset);
    }

    private static MediaController.AssetDto toAssetDto(MediaAsset a) {
        return new MediaController.AssetDto(a.getId(), a.getFileName(), a.getFileUrl(), a.getFileType(),
            a.getFileSize(), a.getCreatedAt(), uploaderName(a.getUser()));
    }

    private static String uploaderName(User u) {
        if (u == null) return null;
        if (u.getFullName() != null && !u.getFullName().isBlank()) return u.getFullName();
        return u.getEmail();
    }

    @Transactional
    public void deleteAsset(User user, UUID assetId) {
        MediaAsset asset = assetRepository.findById(assetId).orElse(null);
        if (asset == null) return;
        boolean isUploader = asset.getUser() != null && asset.getUser().getId().equals(user.getId());
        if (asset.getFolder() != null) {
            requireOnConnectedPage(asset.getFolder());
        }
        if (!isUploader) {
            requireManageAccess(user, asset.getFolder());
        }
        if (!assetIdsInUse(List.of(assetId)).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, ASSET_IN_USE_MESSAGE);
        }
        assetRepository.delete(asset);
        deleteStoredFilesAfterCommit(List.of(asset.getFileUrl()));
    }

    /**
     * Deletes every asset the caller may delete and reports the rest instead of failing the whole batch:
     * files a not-yet-published post still uses, and (for non-managers) files someone else uploaded.
     */
    @Transactional
    public MediaController.BulkDeleteResult deleteAssets(User user, List<UUID> assetIds) {
        if (assetIds == null || assetIds.isEmpty()) {
            return new MediaController.BulkDeleteResult(List.of(), List.of());
        }
        if (assetIds.size() > MAX_BULK_DELETE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You can delete up to " + MAX_BULK_DELETE + " files at a time.");
        }
        Set<UUID> requested = new LinkedHashSet<>(assetIds);
        Set<UUID> inUse = assetIdsInUse(requested);
        List<MediaAsset> toDelete = new ArrayList<>();
        List<UUID> deleted = new ArrayList<>();
        List<MediaController.SkippedAsset> skipped = new ArrayList<>();

        for (MediaAsset asset : assetRepository.findAllById(requested)) {
            if (!canDeleteAsset(user, asset)) {
                skipped.add(new MediaController.SkippedAsset(asset.getId(), asset.getFileName(),
                    "You can only delete files you uploaded."));
            } else if (inUse.contains(asset.getId())) {
                skipped.add(new MediaController.SkippedAsset(asset.getId(), asset.getFileName(), ASSET_IN_USE_MESSAGE));
            } else {
                toDelete.add(asset);
                deleted.add(asset.getId());
            }
        }
        // Ids that no longer exist count as deleted, so a stale screen simply drops them.
        requested.stream().filter(id -> !deleted.contains(id) && skipped.stream().noneMatch(s -> s.id().equals(id)))
            .forEach(deleted::add);

        assetRepository.deleteAll(toDelete);
        deleteStoredFilesAfterCommit(toDelete.stream().map(MediaAsset::getFileUrl).toList());
        return new MediaController.BulkDeleteResult(deleted, skipped);
    }

    /** Uploaders may delete their own files; officers/admins (or the owner of a personal folder) may delete any. */
    private boolean canDeleteAsset(User user, MediaAsset asset) {
        MediaFolder folder = asset.getFolder();
        if (folder == null) return false;
        String current = ConnectedPageResolver.pageIdOf(folder.getOrganization(), folder.getUser());
        if (!Objects.equals(ConnectedPageResolver.normalize(folder.getFbPageId()), current)) return false;
        if (asset.getUser() != null && asset.getUser().getId().equals(user.getId())) return true;
        if (folder.getOrganization() != null) {
            return organizationPermissionService.isOfficerOrAdmin(user.getId(), folder.getOrganization().getId());
        }
        return folder.getUser() != null && folder.getUser().getId().equals(user.getId());
    }

    /** Assets that a draft/scheduled post still points at, as its single image or in its multi-image set. */
    private Set<UUID> assetIdsInUse(Collection<UUID> assetIds) {
        Set<UUID> inUse = new HashSet<>(postRepository.findSingleMediaAssetIdsInUse(assetIds));
        inUse.addAll(postRepository.findMultiMediaAssetIdsInUse(assetIds));
        return inUse;
    }

    /** Storage objects go only once the rows are gone for good, so a rolled-back delete never leaves broken links. */
    private void deleteStoredFilesAfterCommit(List<String> fileUrls) {
        if (fileUrls.isEmpty()) return;
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            fileUrls.forEach(supabaseStorageService::deletePublicObject);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                fileUrls.forEach(supabaseStorageService::deletePublicObject);
            }
        });
    }

    @Transactional
    public MediaController.FolderDto renameFolder(User user, UUID folderId, String rawName) {
        String name = rawName == null ? "" : rawName.trim();
        if (name.isEmpty() || name.length() > MAX_FOLDER_NAME) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Folder name must be 1–" + MAX_FOLDER_NAME + " characters.");
        }
        MediaFolder folder = folderRepository.findById(folderId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Folder not found"));
        requireManageAccess(user, folder);
        folder.setName(name);
        return new MediaController.FolderDto(folder.getId(), folder.getName(), folder.getAssets().size());
    }

    /**
     * System cleanup (no user/permission context): releases a media asset once its post has been
     * published, so the file no longer sits in the Media Repository consuming storage.
     */
    @Transactional
    public void releasePublishedAsset(UUID assetId) {
        if (assetId == null) return;
        assetRepository.findById(assetId).ifPresent(asset -> {
            supabaseStorageService.deletePublicObject(asset.getFileUrl());
            assetRepository.delete(asset);
        });
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
    public List<String> generateCaptionsFromAssets(User user, List<UUID> assetIds, String tone, UUID orgId, String notes) {
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

        OrgAiProfile profile = orgAiProfileResolver.resolveProfile(user, orgId);
        return geminiClient.generateCaptionsMultiImage(imageUrls, tone, profile, notes);
    }

    public List<String> generateCaptionsFromAssets(User user, List<UUID> assetIds, String tone) {
        return generateCaptionsFromAssets(user, assetIds, tone, null, null);
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
        requireOnConnectedPage(folder);
        return folder;
    }

    /**
     * A folder belongs to the Facebook Page it was created under and is only reachable while that Page is the
     * one connected to its workspace. Folders of a previously connected Page look exactly like missing ones.
     */
    private void requireOnConnectedPage(MediaFolder folder) {
        String current = ConnectedPageResolver.pageIdOf(folder.getOrganization(), folder.getUser());
        if (!Objects.equals(ConnectedPageResolver.normalize(folder.getFbPageId()), current)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Folder not found");
        }
    }

    /** Org folders: officer/admin of the owning org. Personal folders: the owner. */
    private void requireManageAccess(User user, MediaFolder folder) {
        if (folder.getOrganization() != null) {
            organizationPermissionService.requireOfficerOrAdmin(user.getId(), folder.getOrganization().getId());
        } else if (folder.getUser() == null || !folder.getUser().getId().equals(user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not allowed");
        }
        requireOnConnectedPage(folder);
    }
}