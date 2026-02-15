-- Sprint 15: Onboarding support
-- Add onboarding_completed field to distributors table

ALTER TABLE distributors ADD COLUMN onboarding_completed INTEGER DEFAULT 0;
