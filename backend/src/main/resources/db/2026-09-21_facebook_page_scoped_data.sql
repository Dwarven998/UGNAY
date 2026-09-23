-- Ties every post and every Media Repository folder to the Facebook Page it was created under, so
-- that switching (or disconnecting) an organization's Page can never surface another Page's data.
--
-- Every statement is idempotent. The backend runs this file at startup (spring.sql.init, before Hibernate
-- validates the schema), and it can equally be pasted into the Supabase SQL editor; running it twice
-- changes nothing the second time.
--
-- Backfill rules for pre-existing rows (only rows whose fb_page_id is still NULL are touched):
--   * published posts  -> the Page id embedded in their Facebook post id ("<pageId>_<postId>")
--   * other posts      -> the Page currently connected to their organization (or author, if personal)
--   * media folders    -> the Page currently connected to their organization (or owner, if personal)
-- Rows that still have no Page (nothing was ever connected) stay "unassigned" and are claimed by the
-- first Page that workspace connects.

ALTER TABLE posts ADD COLUMN IF NOT EXISTS fb_page_id varchar(255);

ALTER TABLE media_folders ADD COLUMN IF NOT EXISTS fb_page_id varchar(255);

UPDATE posts
   SET fb_page_id = split_part(fb_post_id, '_', 1)
 WHERE fb_page_id IS NULL
   AND fb_post_id LIKE '%\_%';

UPDATE posts p
   SET fb_page_id = o.fb_page_id
  FROM organizations o
 WHERE p.fb_page_id IS NULL
   AND p.organization_id = o.id
   AND o.fb_page_id IS NOT NULL;

UPDATE posts p
   SET fb_page_id = u.fb_page_id
  FROM users u
 WHERE p.fb_page_id IS NULL
   AND p.organization_id IS NULL
   AND p.user_id = u.id
   AND u.fb_page_id IS NOT NULL;

UPDATE media_folders f
   SET fb_page_id = o.fb_page_id
  FROM organizations o
 WHERE f.fb_page_id IS NULL
   AND f.organization_id = o.id
   AND o.fb_page_id IS NOT NULL;

UPDATE media_folders f
   SET fb_page_id = u.fb_page_id
  FROM users u
 WHERE f.fb_page_id IS NULL
   AND f.organization_id IS NULL
   AND f.user_id = u.id
   AND u.fb_page_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_posts_org_page ON posts (organization_id, fb_page_id);

CREATE INDEX IF NOT EXISTS idx_posts_user_page ON posts (user_id, fb_page_id);

CREATE INDEX IF NOT EXISTS idx_media_folders_org_page ON media_folders (organization_id, fb_page_id);

CREATE INDEX IF NOT EXISTS idx_media_folders_user_page ON media_folders (user_id, fb_page_id);
