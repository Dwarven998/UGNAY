package com.ugnay.ugnay.facebook;

import java.util.UUID;

/**
 * Published after a workspace's Facebook Page is connected, switched or disconnected. Anything that
 * caches Page-scoped data (Analytics) must drop it when this fires, so the previous Page's numbers are
 * never served for the new one. {@code orgId} is null for a personal workspace.
 */
public record FacebookConnectionChangedEvent(UUID userId, UUID orgId) {}
