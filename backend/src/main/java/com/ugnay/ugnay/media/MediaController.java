package com.ugnay.ugnay.media;



import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.ugnay.ugnay.core.User;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/media")
@RequiredArgsConstructor
public class MediaController {

    private final MediaService mediaService;

    // --- FOLDERS ---
    @GetMapping("/folders")
    public ResponseEntity<List<FolderDto>> getFolders(@AuthenticationPrincipal User user,
                                                       @RequestParam(required = false) UUID orgId) {
        return ResponseEntity.ok().body(mediaService.getFolders(user, orgId));
    }

    @PostMapping("/folders")
    public ResponseEntity<FolderDto> createFolder(@AuthenticationPrincipal User user,
                                                  @RequestBody CreateFolderRequest req) {
        return ResponseEntity.ok().body(mediaService.createFolder(user, req.name(), req.orgId()));
    }

    @DeleteMapping("/folders/{folderId}")
    public ResponseEntity<Void> deleteFolder(@AuthenticationPrincipal User user,
                                             @PathVariable UUID folderId) {
        mediaService.deleteFolder(user, folderId);
        return ResponseEntity.noContent().build();
    }

    // --- ASSETS ---
    @GetMapping("/folders/{folderId}/assets")
    public ResponseEntity<List<AssetDto>> getAssets(@AuthenticationPrincipal User user,
                                                    @PathVariable UUID folderId) {
        return ResponseEntity.ok(mediaService.getAssets(user, folderId));
    }

    // NOTE: File upload goes directly to Supabase Storage from the frontend.
    // This endpoint saves the metadata after upload.
    @PostMapping("/assets")
    public ResponseEntity<AssetDto> saveAssetMetadata(@AuthenticationPrincipal User user,
                                                      @RequestBody AssetMetaRequest req) {
        return ResponseEntity.ok().body(mediaService.saveAsset(user, req));
    }

    @DeleteMapping("/assets/{assetId}")
    public ResponseEntity<Void> deleteAsset(@AuthenticationPrincipal User user,
                                            @PathVariable UUID assetId) {
        mediaService.deleteAsset(user, assetId);
        return ResponseEntity.noContent().build();
    }

    // --- AI RECOMMENDATION ---
    @PostMapping("/folders/{folderId}/recommend")
    public ResponseEntity<List<RecommendationDto>> recommend(@AuthenticationPrincipal User user,
                                                              @PathVariable UUID folderId,
                                                              @RequestBody RecommendRequest req) {
        return ResponseEntity.ok(mediaService.recommendImages(user, folderId, req.description()));
    }

    // DTOs
    public record FolderDto(UUID id, String name, int assetCount) {}
    public record AssetDto(UUID id, String fileName, String fileUrl, String fileType) {}
    public record AssetMetaRequest(UUID folderId, String fileName, String fileUrl, String fileType) {}
    public record CreateFolderRequest(String name, UUID orgId) {}
    public record RecommendRequest(String description) {}
    public record RecommendationDto(UUID id, String fileName, String fileUrl, String fileType, int score, String reason) {}
}