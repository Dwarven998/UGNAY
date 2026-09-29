-- Password reset tokens for the Forgot Password / Reset Password flow.
--
-- token_hash stores SHA-256(raw_token) so the raw token only ever exists in memory
-- and in the reset email. Expiry is enforced on read. The token is deleted on use.
--
-- Every statement is idempotent: safe to run multiple times and can be pasted into
-- the Supabase SQL editor. Runs at startup before Hibernate validates the schema.

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id         uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash varchar(64)  NOT NULL UNIQUE,
    expires_at timestamptz  NOT NULL,
    used       boolean      NOT NULL DEFAULT false,
    created_at timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prt_token_hash  ON password_reset_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_prt_user_id     ON password_reset_tokens (user_id);
