-- Add positions column to persist draggable element offsets
ALTER TABLE posts ADD COLUMN IF NOT EXISTS positions jsonb;
