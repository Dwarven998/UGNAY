package com.ugnay.ugnay.post;

import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;

import org.springframework.context.event.EventListener;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ugnay.ugnay.core.User;
import com.ugnay.ugnay.media.MediaAsset;
import com.ugnay.ugnay.media.MediaAssetRepository;
import com.ugnay.ugnay.org.Organization;
import com.ugnay.ugnay.org.OrganizationPermissionService;
import com.ugnay.ugnay.org.OrganizationRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class PostSchedulerService {

    private final PostRepository postRepository;
    private final MediaAssetRepository assetRepository;
    private final OrganizationRepository organizationRepository;
    private final OrganizationPermissionService organizationPermissionService;
    private final ConflictDetectionService conflictDetectionService;
    private final FacebookPublishingJob facebookPublishingJob;
    private final TaskScheduler postTaskScheduler;
    private final ConcurrentHashMap<UUID, ScheduledFuture<?>> scheduledTasks = new ConcurrentHashMap<>();

    @EventListener(ApplicationReadyEvent.class)
    public void restoreScheduledPosts() {
        Instant now = Instant.now();
        postRepository.findByStatusAndScheduledAtAfterOrderByScheduledAtAsc(Post.PostStatus.SCHEDULED, now)
            .forEach(this::schedulePost);
    }

    @Transactional
    public PostController.PostDto createPost(User user, PostController.CreatePostRequest req) {
        Post post = buildPost(user, req, null);
        postRepository.save(post);
        schedulePost(post);
        return toDto(post);
    }

    @Transactional
    public PostController.PostDto updatePost(User user, UUID postId, PostController.CreatePostRequest req) {
        Post post = postRepository.findDetailedById(postId)
            .filter(existing -> existing.getUser().getId().equals(user.getId()))
            .orElseThrow(() -> new NoSuchElementException("Post not found"));

        if (isEditLockedForOwner(user, post)) {
            throw new IllegalStateException(
                "This post is already scheduled — request an edit appeal for officer/admin approval before changing it.");
        }

        cancelScheduledTask(post.getId());

        applyRequest(post, user, req, post.getId());
        // An unlocked edit is one-time: consume it (and any resolved appeal marker) on save.
        post.setEditUnlocked(false);
        post.setAppealType(null);
        postRepository.save(post);
        schedulePost(post);
        return toDto(post);
    }

    @Transactional
    public void deletePost(User user, UUID postId) {
        postRepository.findDetailedById(postId)
            .filter(existing -> canManage(user, existing))
            .ifPresent(post -> {
                boolean isModerator = post.getOrganization() != null
                    && organizationPermissionService.isOfficerOrAdmin(user.getId(), post.getOrganization().getId());
                if (!isModerator && isOrgScopedAndScheduled(post)) {
                    throw new IllegalStateException(
                        "This post is already scheduled — request a cancel appeal for officer/admin approval before deleting it.");
                }
                cancelScheduledTask(post.getId());
                postRepository.delete(post);
            });
    }

    /**
     * A member (not officer/admin) requests officer/admin review to edit or cancel their own
     * already-SCHEDULED org post — they can no longer change it directly once scheduled.
     */
    @Transactional
    public PostController.PostDto requestAppeal(User user, UUID postId, Post.PostAppealType type) {
        Post post = postRepository.findDetailedById(postId)
            .filter(existing -> existing.getUser().getId().equals(user.getId()))
            .orElseThrow(() -> new NoSuchElementException("Post not found"));

        if (!isOrgScopedAndScheduled(post)) {
            throw new IllegalStateException("Only a scheduled post can be appealed.");
        }
        if (post.getAppealType() != null) {
            throw new IllegalStateException("An appeal is already pending for this post.");
        }

        post.setAppealType(type);
        postRepository.save(post);
        return toDto(post);
    }

    /**
     * Officer/admin resolves a pending appeal. Approving EDIT unlocks a one-time edit for the
     * owner; approving CANCEL deletes the post outright, removing it from the calendar.
     */
    @Transactional
    public void resolveAppeal(User approver, UUID postId, boolean approve) {
        Post post = postRepository.findDetailedById(postId)
            .orElseThrow(() -> new NoSuchElementException("Post not found"));
        if (post.getOrganization() == null) {
            throw new IllegalStateException("This post is not scoped to an organization");
        }
        organizationPermissionService.requireOfficerOrAdmin(approver.getId(), post.getOrganization().getId());

        Post.PostAppealType type = post.getAppealType();
        if (type == null) {
            throw new IllegalStateException("This post has no pending appeal");
        }

        if (approve && type == Post.PostAppealType.CANCEL) {
            cancelScheduledTask(post.getId());
            postRepository.delete(post);
            return;
        }

        if (approve && type == Post.PostAppealType.EDIT) {
            post.setEditUnlocked(true);
        }
        post.setAppealType(null);
        postRepository.save(post);
    }

    private boolean isEditLockedForOwner(User user, Post post) {
        return isOrgScopedAndScheduled(post)
            && !post.isEditUnlocked()
            && !organizationPermissionService.isOfficerOrAdmin(user.getId(), post.getOrganization().getId());
    }

    private boolean isOrgScopedAndScheduled(Post post) {
        return post.getOrganization() != null && post.getStatus() == Post.PostStatus.SCHEDULED;
    }

    public List<PostController.PostDto> listPendingForModeration(User requester, UUID orgId) {
        organizationPermissionService.requireOfficerOrAdmin(requester.getId(), orgId);
        return postRepository.findByOrganization_IdAndStatusOrderByCreatedAtDesc(orgId, Post.PostStatus.PENDING_REVIEW).stream()
            .map(this::toDto)
            .toList();
    }

    @Transactional
    public PostController.PostDto approvePost(User approver, UUID postId) {
        Post post = postRepository.findDetailedById(postId)
            .orElseThrow(() -> new NoSuchElementException("Post not found"));
        requireModeratable(approver, post);

        post.setStatus(post.getScheduledAt() != null ? Post.PostStatus.SCHEDULED : Post.PostStatus.DRAFT);
        postRepository.save(post);
        schedulePost(post);
        return toDto(post);
    }

    @Transactional
    public PostController.PostDto rejectPost(User approver, UUID postId) {
        Post post = postRepository.findDetailedById(postId)
            .orElseThrow(() -> new NoSuchElementException("Post not found"));
        requireModeratable(approver, post);

        post.setStatus(Post.PostStatus.REJECTED);
        postRepository.save(post);
        return toDto(post);
    }

    private void requireModeratable(User approver, Post post) {
        if (post.getOrganization() == null) {
            throw new IllegalStateException("This post is not scoped to an organization");
        }
        organizationPermissionService.requireOfficerOrAdmin(approver.getId(), post.getOrganization().getId());
        if (post.getStatus() != Post.PostStatus.PENDING_REVIEW) {
            throw new IllegalStateException("Only pending posts can be approved or rejected");
        }
    }

    private boolean canManage(User user, Post post) {
        if (post.getUser().getId().equals(user.getId())) return true;
        return post.getOrganization() != null
            && organizationPermissionService.isOfficerOrAdmin(user.getId(), post.getOrganization().getId());
    }

    @Transactional
    public void publishNow(User user, UUID postId) {
        postRepository.findDetailedById(postId)
            .filter(existing -> existing.getUser().getId().equals(user.getId()))
            .ifPresent(post -> {
                cancelScheduledTask(post.getId());
                facebookPublishingJob.publishImmediately(post.getId());
            });
    }

    private Post buildPost(User user, PostController.CreatePostRequest req, UUID excludePostId) {
        Post post = new Post();
        applyRequest(post, user, req, excludePostId);
        return post;
    }

    private void applyRequest(Post post, User user, PostController.CreatePostRequest req, UUID excludePostId) {
        Organization organization = resolveOrganization(user, req.orgId());
        // Org members without officer/admin rights can still create/schedule/caption posts,
        // but those posts stay under officer/creator control until approved.
        boolean requiresApproval = organization != null
            && !organizationPermissionService.isOfficerOrAdmin(user.getId(), organization.getId());

        Instant scheduledAt = parseScheduledAt(req.scheduledAt());
        if (scheduledAt != null) {
            requireFacebookConnection(user, organization);
            conflictDetectionService.findConflict(user.getOrgName(), scheduledAt, excludePostId)
                .ifPresent(conflict -> { throw new SchedulingConflictException(conflict); });
        }

        MediaAsset asset = req.mediaAssetId() != null
            ? assetRepository.findById(req.mediaAssetId()).orElse(null)
            : post.getMediaAsset();

        post.setUser(user);
        post.setOrganization(organization);
        post.setMediaAsset(asset);
        post.setCaption(req.caption());
        post.setHashtags(req.hashtags());
        post.setTone(req.tone());
        post.setScheduledAt(scheduledAt);
        post.setStatus(requiresApproval
            ? Post.PostStatus.PENDING_REVIEW
            : (scheduledAt != null ? Post.PostStatus.SCHEDULED : Post.PostStatus.DRAFT));
        if (scheduledAt == null) {
            post.setPublishedAt(null);
            post.setFbPostId(null);
        }
    }

    /** Resolves and authorizes the org a post is being scoped to, if any. Requires the author to be an approved member. */
    private Organization resolveOrganization(User user, UUID orgId) {
        if (orgId == null) {
            return null;
        }
        organizationPermissionService.requireApprovedMember(user.getId(), orgId);
        return organizationRepository.findById(orgId)
            .orElseThrow(() -> new NoSuchElementException("Organization not found"));
    }

    private void requireFacebookConnection(User user, Organization organization) {
        boolean connected = organization != null
            ? isConnected(organization.getFbPageId(), organization.getFbAccessToken())
            : isConnected(user.getFbPageId(), user.getFbAccessToken());
        if (!connected) {
            String target = organization != null ? "your organization's" : "your";
            throw new FacebookConnectionRequiredException("Connect " + target + " Facebook Page to enable post scheduling.");
        }
    }

    private boolean isConnected(String pageId, String accessToken) {
        return pageId != null && !pageId.isBlank() && accessToken != null && !accessToken.isBlank();
    }

    private Instant parseScheduledAt(String scheduledAt) {
        if (scheduledAt == null || scheduledAt.isBlank()) {
            return null;
        }
        return Instant.parse(scheduledAt);
    }

    private void schedulePost(Post post) {
        if (post.getScheduledAt() == null || !Post.PostStatus.SCHEDULED.equals(post.getStatus())) {
            return;
        }

        Instant scheduledAt = post.getScheduledAt();
        if (scheduledAt.isBefore(Instant.now())) {
            facebookPublishingJob.publishScheduledPost(post.getId());
            return;
        }

        ScheduledFuture<?> future = postTaskScheduler.schedule(
            () -> facebookPublishingJob.publishScheduledPost(post.getId()),
            Date.from(scheduledAt)
        );
        if (future != null) {
            scheduledTasks.put(post.getId(), future);
        }
    }

    private void cancelScheduledTask(UUID postId) {
        ScheduledFuture<?> future = scheduledTasks.remove(postId);
        if (future != null) {
            future.cancel(false);
        }
    }

    private PostController.PostDto toDto(Post post) {
        return new PostController.PostDto(
            post.getId(),
            post.getCaption(),
            post.getHashtags(),
            post.getTone(),
            post.getStatus().name(),
            post.getScheduledAt() != null ? post.getScheduledAt().toString() : null,
            post.getMediaAsset() != null ? post.getMediaAsset().getFileUrl() : null,
            post.getFbPostId(),
            post.getOrganization() != null ? post.getOrganization().getId() : null,
            post.getUser() != null ? post.getUser().getId() : null,
            post.getAppealType() != null ? post.getAppealType().name() : null,
            post.isEditUnlocked()
        );
    }
}