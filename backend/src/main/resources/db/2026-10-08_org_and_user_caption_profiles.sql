-- Organization & User AI caption profiles (idempotent migration)
-- Adds profile columns to organizations and users for AI caption grounding and framing.
-- All columns are nullable to preserve 100% backward compatibility for existing records.

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS full_name varchar(255);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS audience varchar(255);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS focus_areas text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS language_pref varchar(100);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS official_hashtags varchar(255);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS caption_avoid text;

ALTER TABLE users ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name varchar(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS audience varchar(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS focus_areas text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS language_pref varchar(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS official_hashtags varchar(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS caption_avoid text;
