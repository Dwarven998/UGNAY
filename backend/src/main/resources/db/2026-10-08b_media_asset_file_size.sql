-- Media asset file size (idempotent migration)
-- Lets the Media Repository sort and show files by size. Nullable: assets uploaded before this
-- migration have no recorded size and are listed last when sorting by size.
-- spring.jpa.hibernate.ddl-auto=validate, so run this against Supabase before starting the backend.

ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS file_size bigint;
