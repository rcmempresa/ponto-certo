-- Storage policies for faltas_docs bucket

-- Allow users to upload their own files
CREATE POLICY "Users can upload their own faltas docs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'faltas_docs' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to view their own files
CREATE POLICY "Users can view their own faltas docs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'faltas_docs' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow admins to view all faltas docs
CREATE POLICY "Admins can view all faltas docs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'faltas_docs' 
  AND public.is_admin()
);

-- Allow users to delete their own files
CREATE POLICY "Users can delete their own faltas docs"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'faltas_docs' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);