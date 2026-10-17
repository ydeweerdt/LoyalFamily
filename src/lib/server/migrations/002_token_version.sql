-- 002_token_version.sql — sessions must be revocable (REQUIREMENTS §7).
-- Bumping a user's token_version invalidates every session cookie issued before.
ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;
