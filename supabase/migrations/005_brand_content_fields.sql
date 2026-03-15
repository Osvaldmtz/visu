ALTER TABLE brands ADD COLUMN IF NOT EXISTS brand_description text;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS brand_voice text;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS content_topics text;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS topics_to_avoid text;
