
CREATE POLICY "Authenticated read receipts" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'receipts');
CREATE POLICY "Authenticated upload receipts" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'receipts');
