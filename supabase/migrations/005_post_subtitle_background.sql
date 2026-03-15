-- Add subtitle and background_url to posts for interactive template rendering
ALTER TABLE posts ADD COLUMN IF NOT EXISTS subtitle text;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS background_url text;
