ALTER TABLE brands ADD COLUMN IF NOT EXISTS brand_skill text;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS brand_skill_updated_at timestamptz;
