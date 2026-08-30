-- Post multi-image support: join table for ordering and storing multiple media assets per post
--
-- spring.jpa.hibernate.ddl-auto=validate, so run this against Supabase
-- (SQL editor or psql) before starting the backend.

CREATE TABLE IF NOT EXISTS post_media_assets (
    post_id        uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    media_asset_id uuid NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
    position       int NOT NULL DEFAULT 0,
    PRIMARY KEY (post_id, media_asset_id)
);

CREATE INDEX IF NOT EXISTS idx_post_media_assets_post_id ON post_media_assets(post_id);

-- Backfill any existing single-image posts into the new join table
INSERT INTO post_media_assets (post_id, media_asset_id, position)
SELECT id, media_asset_id, 0
FROM posts
WHERE media_asset_id IS NOT NULL
ON CONFLICT DO NOTHING;
