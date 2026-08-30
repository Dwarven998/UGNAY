-- Appeal workflow for already-SCHEDULED org posts: a non-officer/admin member can no
-- longer edit or cancel their post directly once it's scheduled — they submit an
-- appeal (edit or cancel), which an officer/admin approves or rejects. Approving an
-- edit appeal unlocks a one-time edit for the owner; approving a cancel appeal
-- deletes the post outright.
--
-- spring.jpa.hibernate.ddl-auto=validate, so run this against Supabase
-- (SQL editor or psql) before starting the backend, same as the earlier migrations.

ALTER TABLE posts
    ADD COLUMN appeal_type varchar(20),
    ADD COLUMN edit_unlocked boolean NOT NULL DEFAULT false;
