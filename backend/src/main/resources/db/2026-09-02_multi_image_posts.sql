-- Support for multiple images per post (1-3 images with generalized captions)
-- This migration:
-- 1. Creates a junction table for post-media relationships (PostMediaAsset entity)
-- 2. Removes the single media_asset_id foreign key from posts
-- 3. Ensures display order is preserved for images in a post
-- 4. Migrates existing single media relationships to the new table

-- Create junction table for one-to-many relationship between Post and PostMediaAsset
CREATE TABLE posts_media_assets (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id            uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    media_asset_id     uuid NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
    display_order      integer NOT NULL DEFAULT 0,
    created_at         timestamptz NOT NULL DEFAULT now(),
    UNIQUE (post_id, media_asset_id)
);

CREATE INDEX idx_posts_media_assets_post_id ON posts_media_assets(post_id);
CREATE INDEX idx_posts_media_assets_media_asset_id ON posts_media_assets(media_asset_id);
CREATE INDEX idx_posts_media_assets_display_order ON posts_media_assets(post_id, display_order);

-- Migrate existing single media relationships to the junction table
INSERT INTO posts_media_assets (id, post_id, media_asset_id, display_order, created_at)
SELECT gen_random_uuid(), id, media_asset_id, 0, now()
FROM posts
WHERE media_asset_id IS NOT NULL;

-- Drop the old single foreign key column from posts
ALTER TABLE posts DROP COLUMN media_asset_id;
