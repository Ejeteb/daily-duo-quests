UPDATE storage.buckets SET public = true WHERE id = 'duo-media';

DROP POLICY IF EXISTS "duo public read" ON storage.objects;
DROP POLICY IF EXISTS "duo public insert" ON storage.objects;

CREATE POLICY "duo public read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'duo-media');

CREATE POLICY "duo public insert" ON storage.objects
  FOR INSERT TO public
  WITH CHECK (bucket_id = 'duo-media');