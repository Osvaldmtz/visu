ALTER TABLE posts ADD COLUMN IF NOT EXISTS element_positions jsonb DEFAULT '{}'::jsonb;
