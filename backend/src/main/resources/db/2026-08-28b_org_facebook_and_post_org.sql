-- Per-organization Facebook Page connection, and letting posts remember which
-- organization (and therefore which connected Page) they belong to.
--
-- spring.jpa.hibernate.ddl-auto=validate, so run this against Supabase
-- (SQL editor or psql) before starting the backend, same as the first migration.

ALTER TABLE organizations
    ADD COLUMN fb_page_id      varchar(255),
    ADD COLUMN fb_access_token text;

ALTER TABLE posts
    ADD COLUMN organization_id uuid REFERENCES organizations(id);

CREATE INDEX idx_posts_organization_id ON posts(organization_id);
