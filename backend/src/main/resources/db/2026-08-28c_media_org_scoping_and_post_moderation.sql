-- Org-scoped Media Repository folders, and the two new Post statuses
-- (PENDING_REVIEW, REJECTED) used for officer/admin moderation of posts
-- made by non-officer org members.
--
-- spring.jpa.hibernate.ddl-auto=validate, so run this against Supabase
-- (SQL editor or psql) before starting the backend, same as the earlier migrations.

ALTER TABLE media_folders
    ADD COLUMN organization_id uuid REFERENCES organizations(id);

CREATE INDEX idx_media_folders_organization_id ON media_folders(organization_id);

-- Posts.status is stored as plain text via Hibernate; drop any old CHECK
-- constraint restricting it to the original 4 values, if one exists, so the
-- two new statuses aren't rejected. Safe to run even if no such constraint exists.
DO $$
DECLARE
    con record;
BEGIN
    FOR con IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'posts'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%status%'
    LOOP
        EXECUTE format('ALTER TABLE posts DROP CONSTRAINT %I', con.conname);
    END LOOP;
END $$;
