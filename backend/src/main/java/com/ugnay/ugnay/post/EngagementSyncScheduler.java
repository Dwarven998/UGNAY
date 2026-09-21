package com.ugnay.ugnay.post;

import java.util.List;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.ugnay.ugnay.core.User;
import com.ugnay.ugnay.core.UserRepository;
import com.ugnay.ugnay.org.ConnectedPageResolver;
import com.ugnay.ugnay.org.Organization;
import com.ugnay.ugnay.org.OrganizationRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Background heartbeat that keeps every organization's and every legacy personal account's
 * engagement counts fresh from Facebook, so the Analytics panel stays in sync even when nobody
 * currently has it open. Each organization and each user is synced strictly against its own
 * Page token and only the posts of the Page that token belongs to, so nothing crosses between
 * organizations, users or Pages.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class EngagementSyncScheduler {

    private final OrganizationRepository organizationRepository;
    private final UserRepository userRepository;
    private final PostRepository postRepository;
    private final EngagementSyncService engagementSyncService;

    @Scheduled(fixedRateString = "${analytics.engagement-sync.interval-ms:180000}")
    public void syncAllEngagement() {
        for (Organization org : organizationRepository.findAll()) {
            String pageId = ConnectedPageResolver.normalize(org.getFbPageId());
            if (pageId == null || org.getFbAccessToken() == null || org.getFbAccessToken().isBlank()) continue;
            List<Post> posts = postRepository.findInScope(org.getId(), null, pageId);
            engagementSyncService.syncPosts(posts, org.getFbAccessToken());
        }

        for (User user : userRepository.findAll()) {
            String pageId = ConnectedPageResolver.normalize(user.getFbPageId());
            if (pageId == null || user.getFbAccessToken() == null || user.getFbAccessToken().isBlank()) continue;
            List<Post> posts = postRepository.findInScope(null, user, pageId);
            engagementSyncService.syncPosts(posts, user.getFbAccessToken());
        }
    }
}
