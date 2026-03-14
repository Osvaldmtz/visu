-- Add onboarding-related columns to brands table
ALTER TABLE brands ADD COLUMN IF NOT EXISTS secondary_color text;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS font_family text default 'Inter';
ALTER TABLE brands ADD COLUMN IF NOT EXISTS active_layouts int[] default '{0,1,2,3}';
ALTER TABLE brands ADD COLUMN IF NOT EXISTS logo_storage_path text;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS logo_light_url text;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS logo_dark_url text;

-- Storage: create logos bucket (run only if not already created via API)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true) ON CONFLICT DO NOTHING;

-- Storage: public read policy for logos bucket
CREATE POLICY "Public read logos" ON storage.objects
  FOR SELECT USING (bucket_id = 'logos');

-- Storage: authenticated users can upload to their own path
CREATE POLICY "Users can upload logos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'logos'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can update their logos" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'logos'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can delete their logos" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'logos'
    AND auth.role() = 'authenticated'
  );
