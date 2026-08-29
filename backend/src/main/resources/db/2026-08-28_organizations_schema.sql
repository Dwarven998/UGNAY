-- Organization model + directory-level permission layer (CLAUDE.md Phase 1+2).
--
-- spring.jpa.hibernate.ddl-auto=validate, so Hibernate will NOT create these
-- tables for you. Run this script against the Supabase Postgres database
-- (SQL editor or psql) before starting the backend, or it will fail to boot
-- with a schema-validation error.

CREATE TABLE organizations (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name           varchar(255) NOT NULL,
    type           varchar(50)  NOT NULL CHECK (type IN ('UNIVERSITY', 'DEPARTMENT', 'PROGRAM')),
    parent_org_id  uuid REFERENCES organizations(id),
    join_code      varchar(32)  NOT NULL UNIQUE,
    open_join      boolean      NOT NULL DEFAULT false,
    created_by     uuid REFERENCES users(id),
    created_at     timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX idx_organizations_parent_org_id ON organizations(parent_org_id);

CREATE TABLE organization_memberships (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          uuid NOT NULL REFERENCES users(id),
    organization_id  uuid NOT NULL REFERENCES organizations(id),
    role             varchar(50) NOT NULL CHECK (role IN ('ADMIN', 'OFFICER', 'CONTRIBUTOR', 'MEMBER')),
    status           varchar(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    requested_at     timestamptz NOT NULL DEFAULT now(),
    joined_at        timestamptz,
    UNIQUE (user_id, organization_id)
);

CREATE INDEX idx_org_memberships_org_id ON organization_memberships(organization_id);
CREATE INDEX idx_org_memberships_user_id ON organization_memberships(user_id);

CREATE TABLE post_directories (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id    uuid NOT NULL REFERENCES organizations(id),
    title              varchar(255) NOT NULL,
    upload_deadline    timestamptz,
    allowed_file_types text[],
    requires_approval  boolean NOT NULL DEFAULT true,
    created_by         uuid REFERENCES users(id),
    created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_post_directories_org_id ON post_directories(organization_id);

CREATE TABLE directory_contributors (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    directory_id  uuid NOT NULL REFERENCES post_directories(id),
    user_id       uuid NOT NULL REFERENCES users(id),
    granted_by    uuid REFERENCES users(id),
    granted_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (directory_id, user_id)
);

CREATE INDEX idx_directory_contributors_directory_id ON directory_contributors(directory_id);
