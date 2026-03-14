CREATE TABLE IF NOT EXISTS post_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  topic text NOT NULL,
  used_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE post_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own brand topics" ON post_topics
  FOR SELECT USING (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own brand topics" ON post_topics
  FOR INSERT WITH CHECK (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()));
