-- Create the "posts" storage bucket for generated post PNGs
INSERT INTO storage.buckets (id, name, public) VALUES ('posts', 'posts', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access for posts bucket
CREATE POLICY "Public read access for posts" ON storage.objects
  FOR SELECT USING (bucket_id = 'posts');

-- Authenticated users can upload post images
CREATE POLICY "Authenticated users can upload posts" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'posts' AND auth.role() = 'authenticated');

-- Authenticated users can update their own post images
CREATE POLICY "Authenticated users can update posts" ON storage.objects
  FOR UPDATE USING (bucket_id = 'posts' AND auth.role() = 'authenticated');

-- Authenticated users can delete their own post images
CREATE POLICY "Authenticated users can delete posts" ON storage.objects
  FOR DELETE USING (bucket_id = 'posts' AND auth.role() = 'authenticated');
