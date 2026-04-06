-- Add missing schedule columns to brands table
-- These are used by onboarding, settings, auto-generate, and bulk-schedule

ALTER TABLE brands ADD COLUMN IF NOT EXISTS posts_per_week int DEFAULT 1;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS preferred_days int[] DEFAULT '{1}';
ALTER TABLE brands ADD COLUMN IF NOT EXISTS publish_time time DEFAULT '09:00';
ALTER TABLE brands ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'America/Mexico_City';
