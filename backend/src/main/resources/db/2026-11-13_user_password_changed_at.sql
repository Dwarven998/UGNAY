-- Records when a user's password last changed (profile change or email reset).
--
-- The JWT filter rejects any session token issued before this instant, so changing or resetting a
-- password signs the account out everywhere else (a stolen session cookie stops working).
-- NULL means the password has not changed since this column was added; every existing token stays valid.
--
-- Idempotent: safe to run multiple times and can be pasted into the Supabase SQL editor.
-- Runs at startup before Hibernate validates the schema.

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at timestamptz;
