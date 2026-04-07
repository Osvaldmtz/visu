-- Add overlay_filter column for background overlay style
ALTER TABLE posts ADD COLUMN IF NOT EXISTS overlay_filter text NOT NULL DEFAULT 'purple';
