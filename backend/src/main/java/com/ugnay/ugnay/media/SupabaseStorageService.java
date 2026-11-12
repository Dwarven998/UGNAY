package com.ugnay.ugnay.media;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import lombok.extern.slf4j.Slf4j;
import reactor.core.publisher.Mono;

/**
 * Deletes objects from Supabase Storage. Used to release the underlying file once a media asset
 * is no longer needed (e.g. after its post has been published), so storage doesn't grow unbounded.
 * Reuses the same project URL/anon key/bucket the frontend uploads with.
 */
@Component
@Slf4j
public class SupabaseStorageService {

    @Value("${supabase.storage.url:}")
    private String storageUrl;

    @Value("${supabase.storage.key:}")
    private String storageKey;

    @Value("${supabase.storage.bucket:media}")
    private String bucket;

    private final WebClient webClient = WebClient.builder().build();

    /** Best-effort delete; never throws, so a storage hiccup can't block the caller's own transaction. */
    public void deletePublicObject(String fileUrl) {
        if (storageUrl == null || storageUrl.isBlank() || storageKey == null || storageKey.isBlank()) {
            log.warn("Supabase storage not configured; skipping remote file cleanup for {}", fileUrl);
            return;
        }
        String path = extractObjectPath(fileUrl);
        if (path == null) {
            log.warn("Could not resolve storage object path from URL {}; skipping cleanup", fileUrl);
            return;
        }

        webClient.delete()
            .uri(storageUrl + "/storage/v1/object/" + bucket + "/" + path)
            .header("Authorization", "Bearer " + storageKey)
            .header("apikey", storageKey)
            .retrieve()
            .toBodilessEntity()
            .doOnSuccess(r -> log.info("Deleted Supabase storage object {}", path))
            .onErrorResume(e -> {
                log.warn("Failed to delete Supabase storage object {}: {}", path, e.getMessage());
                return Mono.empty();
            })
            .subscribe();
    }

    /**
     * True when {@code fileUrl} is a public object of this project's bucket whose path starts with
     * {@code pathPrefix} (e.g. "caption-studio/"). Used to accept only files the app itself uploaded.
     */
    public boolean isOwnPublicObject(String fileUrl, String pathPrefix) {
        if (fileUrl == null || storageUrl == null || storageUrl.isBlank()) {
            return false;
        }
        String base = storageUrl.replaceAll("/+$", "") + "/storage/v1/object/public/" + bucket + "/";
        if (!fileUrl.startsWith(base)) {
            return false;
        }
        String path = fileUrl.substring(base.length());
        return path.startsWith(pathPrefix) && path.length() > pathPrefix.length() && !path.contains("..");
    }

    private String extractObjectPath(String fileUrl) {
        if (fileUrl == null) {
            return null;
        }
        String marker = "/object/public/" + bucket + "/";
        int idx = fileUrl.indexOf(marker);
        if (idx == -1) {
            marker = "/object/" + bucket + "/";
            idx = fileUrl.indexOf(marker);
        }
        return idx == -1 ? null : fileUrl.substring(idx + marker.length());
    }
}
