-- Add SELECT policy for authenticated users to read chat media
CREATE POLICY "Authenticated users can view chat media"
ON storage.objects
FOR SELECT
USING (bucket_id = 'chat-media' AND auth.role() = 'authenticated');