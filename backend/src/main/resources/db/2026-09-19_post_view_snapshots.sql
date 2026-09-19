-- Per-post view history for the Analytics panel's "views over time" graph.
--
-- Facebook only reports a post's lifetime view total, so the backend appends a row here whenever a
-- post's live numbers change. The backend also runs this same idempotent DDL at startup
-- (PostViewSnapshotStore), so applying this file by hand is optional — it is kept here so the schema
-- is documented alongside the other migrations.

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
);

CREATE INDEX IF NOT EXISTS idx_post_view_snapshots_post
    ON post_view_snapshots (page_id, fb_post_id, captured_at);
