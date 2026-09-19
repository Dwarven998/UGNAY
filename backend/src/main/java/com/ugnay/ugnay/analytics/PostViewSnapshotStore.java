package com.ugnay.ugnay.analytics;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Facebook only reports a post's lifetime view total, never a history. To draw the per-post views
 * graph, every time the panel reads a post's live numbers and they differ from the last stored
 * reading, a snapshot is appended here. Rows are keyed by Page id as well as post id, so one
 * Page's history is never read for another.
 *
 * The table is created idempotently at startup (ddl-auto is "validate", so it is intentionally not a
 * JPA entity). If the database refuses the DDL the store simply disables itself and the graph falls
 * back to the live reading alone.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class PostViewSnapshotStore {

    private static final int MAX_POINTS = 2000;

    private final JdbcTemplate jdbc;
    private volatile boolean available = false;

    public record Sample(String fbPostId, long views, Long viewers, long reactions, long comments, long shares) {}

    public record Reading(Instant capturedAt, long views) {}

    @PostConstruct
    void ensureTable() {
        try {
            jdbc.execute("""
                CREATE TABLE IF NOT EXISTS post_view_snapshots (
                    id          BIGSERIAL PRIMARY KEY,
                    page_id     VARCHAR(64)  NOT NULL,
                    fb_post_id  VARCHAR(128) NOT NULL,
                    captured_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
                    views       BIGINT       NOT NULL,
                    viewers     BIGINT,
                    reactions   BIGINT       NOT NULL DEFAULT 0,
                    comments    BIGINT       NOT NULL DEFAULT 0,
                    shares      BIGINT       NOT NULL DEFAULT 0
                )""");
            jdbc.execute("CREATE INDEX IF NOT EXISTS idx_post_view_snapshots_post "
                + "ON post_view_snapshots (page_id, fb_post_id, captured_at)");
            available = true;
        } catch (Exception ex) {
            log.warn("post_view_snapshots is unavailable; per-post view history is disabled: {}", ex.getMessage());
        }
    }

    /** Appends a snapshot for every sample whose numbers differ from that post's latest stored reading. */
    public void recordIfChanged(String pageId, Collection<Sample> samples) {
        if (!available || samples.isEmpty()) return;
        try {
            String placeholders = samples.stream().map(s -> "?").collect(Collectors.joining(","));
            Object[] args = new Object[samples.size() + 1];
            args[0] = pageId;
            int i = 1;
            for (Sample s : samples) args[i++] = s.fbPostId();

            Map<String, long[]> latest = new HashMap<>();
            jdbc.query("""
                SELECT DISTINCT ON (fb_post_id) fb_post_id, views, reactions, comments, shares
                FROM post_view_snapshots
                WHERE page_id = ? AND fb_post_id IN (%s)
                ORDER BY fb_post_id, captured_at DESC""".formatted(placeholders),
                rs -> {
                    latest.put(rs.getString("fb_post_id"), new long[] {
                        rs.getLong("views"), rs.getLong("reactions"), rs.getLong("comments"), rs.getLong("shares") });
                }, args);

            Timestamp now = Timestamp.from(Instant.now());
            List<Object[]> inserts = samples.stream()
                .filter(s -> {
                    long[] last = latest.get(s.fbPostId());
                    return last == null || last[0] != s.views() || last[1] != s.reactions()
                        || last[2] != s.comments() || last[3] != s.shares();
                })
                .map(s -> new Object[] { pageId, s.fbPostId(), now, s.views(), s.viewers(),
                    s.reactions(), s.comments(), s.shares() })
                .toList();
            if (!inserts.isEmpty()) {
                jdbc.batchUpdate("""
                    INSERT INTO post_view_snapshots
                        (page_id, fb_post_id, captured_at, views, viewers, reactions, comments, shares)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)""", inserts);
            }
        } catch (Exception ex) {
            log.warn("Could not record post view snapshots: {}", ex.getMessage());
        }
    }

    /** Stored readings for one post, oldest first. */
    public List<Reading> history(String pageId, String fbPostId) {
        if (!available) return List.of();
        try {
            return jdbc.query("""
                SELECT captured_at, views FROM (
                    SELECT captured_at, views FROM post_view_snapshots
                    WHERE page_id = ? AND fb_post_id = ?
                    ORDER BY captured_at DESC LIMIT %d
                ) recent ORDER BY captured_at ASC""".formatted(MAX_POINTS),
                (rs, n) -> new Reading(rs.getTimestamp("captured_at").toInstant(), rs.getLong("views")),
                pageId, fbPostId);
        } catch (Exception ex) {
            log.warn("Could not read post view history: {}", ex.getMessage());
            return List.of();
        }
    }
}
