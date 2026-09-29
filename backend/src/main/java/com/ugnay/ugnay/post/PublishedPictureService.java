package com.ugnay.ugnay.post;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.fasterxml.jackson.databind.JsonNode;
import com.ugnay.ugnay.core.User;
import com.ugnay.ugnay.facebook.FacebookInsightsClient;
import com.ugnay.ugnay.org.ConnectedPageResolver;
import com.ugnay.ugnay.org.Organization;
import com.ugnay.ugnay.org.OrganizationPermissionService;
import com.ugnay.ugnay.org.OrganizationRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Once a post is published its uploaded files are released from storage (see FacebookPublishingJob), so a
 * published post no longer has a picture of its own. Its picture still lives on Facebook, and this looks it
 * up there ({@code full_picture}) for the posts list: up to 50 posts per Graph round trip, with the answers
 * cached so a list refresh normally costs no Graph call at all.
 *
 * Only the posts of the caller's current workspace and Page are looked up, with that Page's own token.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PublishedPictureService {

    private static final long FOUND_TTL_MS = 30L * 60 * 1000;
    /** A post without a picture (text post, or deleted on Facebook) is asked about again after a while. */
    private static final long MISSING_TTL_MS = 5L * 60 * 1000;
    private static final int MAX_POSTS = 200;

    private record Cached(String url, long expiresAt) {}

    private final PostRepository postRepository;
    private final OrganizationRepository organizationRepository;
    private final OrganizationPermissionService permissionService;
    private final FacebookInsightsClient graph;

    /** Keyed by Facebook post id, which is unique across Pages. */
    private final Map<String, Cached> cache = new ConcurrentHashMap<>();

    /** Post id → Facebook picture URL, for the workspace's published posts that have no media of their own. */
    public Map<UUID, String> picturesFor(User user, UUID orgId) {
        String pageId;
        String token;
        if (orgId != null) {
            permissionService.requireApprovedMember(user.getId(), orgId);
            Organization org = organizationRepository.findById(orgId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organization not found"));
            pageId = ConnectedPageResolver.normalize(org.getFbPageId());
            token = org.getFbAccessToken();
        } else {
            pageId = ConnectedPageResolver.normalize(user.getFbPageId());
            token = user.getFbAccessToken();
        }
        if (pageId == null || token == null || token.isBlank()) {
            return Map.of();
        }

        List<Post> candidates = postRepository.findInScope(orgId, user, pageId).stream()
            .filter(post -> post.getStatus() == Post.PostStatus.PUBLISHED)
            .filter(post -> post.getFbPostId() != null && !post.getFbPostId().isBlank())
            .filter(post -> post.getMediaAsset() == null
                && (post.getMediaAssets() == null || post.getMediaAssets().isEmpty()))
            .limit(MAX_POSTS)
            .toList();

        long now = System.currentTimeMillis();
        Map<UUID, String> pictures = new LinkedHashMap<>();
        List<Post> toFetch = new ArrayList<>();
        for (Post post : candidates) {
            Cached cached = cache.get(post.getFbPostId());
            if (cached != null && cached.expiresAt() > now) {
                if (!cached.url().isEmpty()) pictures.put(post.getId(), cached.url());
            } else {
                toFetch.add(post);
            }
        }

        if (!toFetch.isEmpty()) {
            List<String> requests = toFetch.stream()
                .map(post -> post.getFbPostId() + "?fields=full_picture")
                .toList();
            List<JsonNode> answers = graph.batchGet(token, requests);
            for (int i = 0; i < toFetch.size() && i < answers.size(); i++) {
                JsonNode answer = answers.get(i);
                if (answer == null) {
                    continue; // transient failure: try again on the next load instead of caching a miss
                }
                Post post = toFetch.get(i);
                String url = answer.path("full_picture").asText("");
                cache.put(post.getFbPostId(), new Cached(url, now + (url.isEmpty() ? MISSING_TTL_MS : FOUND_TTL_MS)));
                if (!url.isEmpty()) pictures.put(post.getId(), url);
            }
        }

        if (cache.size() > 5000) {
            cache.entrySet().removeIf(entry -> entry.getValue().expiresAt() < now);
        }
        return pictures;
    }
}
