package com.ugnay.ugnay.post;

import java.util.List;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.ugnay.ugnay.core.User;
import com.ugnay.ugnay.core.UserRepository;
import com.ugnay.ugnay.org.Organization;
import com.ugnay.ugnay.org.OrganizationRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Background heartbeat that keeps every organization's and every legacy personal account's
 * engagement counts fresh from Facebook, so the Analytics panel stays in sync even when nobody
 * currently has it open. Each organization and each user is synced strictly against its own
 * Page token and its own posts, so nothing crosses between them.
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
            if (org.getFbAccessToken() == null || org.getFbAccessToken().isBlank()) continue;
            List<Post> posts = postRepository.findByOrganization_IdOrderByCreatedAtDesc(org.getId());
            engagementSyncService.syncPosts(posts, org.getFbAccessToken());
        }

        for (User user : userRepository.findAll()) {
            if (user.getFbAccessToken() == null || user.getFbAccessToken().isBlank()) continue;
            List<Post> posts = postRepository.findByUserAndOrganizationIsNullOrderByCreatedAtDesc(user);
            engagementSyncService.syncPosts(posts, user.getFbAccessToken());
        }
    }
}
