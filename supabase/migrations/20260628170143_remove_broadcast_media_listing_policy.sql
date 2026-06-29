-- Public buckets serve object URLs without a storage.objects SELECT policy.
-- Removing this policy prevents unauthenticated bucket listing.
DROP POLICY IF EXISTS "Broadcast media is public" ON storage.objects;
