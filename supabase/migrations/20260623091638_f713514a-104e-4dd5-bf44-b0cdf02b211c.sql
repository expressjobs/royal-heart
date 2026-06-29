CREATE POLICY "Authenticated can view profile photos" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'profile-photos');
CREATE POLICY "Users upload own profile photos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "Users update own profile photos" ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "Users delete own profile photos" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text
  );