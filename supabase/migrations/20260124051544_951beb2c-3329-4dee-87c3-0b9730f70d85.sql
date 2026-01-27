-- Storage policies for dispatch-media bucket (used for inbox attachments and audio)

-- Allow authenticated users to upload files to dispatch-media
CREATE POLICY "Authenticated users can upload to dispatch-media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'dispatch-media');

-- Allow authenticated users to update their uploaded files
CREATE POLICY "Authenticated users can update dispatch-media files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'dispatch-media');

-- Allow public read access to dispatch-media files (bucket is already public)
CREATE POLICY "Public read access to dispatch-media"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'dispatch-media');

-- Allow authenticated users to delete their files
CREATE POLICY "Authenticated users can delete dispatch-media files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'dispatch-media');