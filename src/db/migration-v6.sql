-- ============================================================
-- Sprint 6 Migration: Password Auth + TOTP 2FA + Language
-- ============================================================

ALTER TABLE distributors ADD COLUMN username TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_distributors_username ON distributors(username);
ALTER TABLE distributors ADD COLUMN password_hash TEXT;
ALTER TABLE distributors ADD COLUMN totp_secret TEXT;
ALTER TABLE distributors ADD COLUMN totp_enabled INTEGER DEFAULT 0;
ALTER TABLE distributors ADD COLUMN language TEXT DEFAULT 'ja';
