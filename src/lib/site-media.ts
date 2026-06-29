import { supabase } from "@/integrations/supabase/client";

const BUCKET = "site-media";
const EXPIRY = 60 * 60 * 24; // 24h signed URLs

const cache = new Map<string, { url: string; expires: number }>();

/** Returns a signed URL for a stored site-media path, cached in-memory. */
export async function getMediaUrl(path: string): Promise<string | null> {
  if (!path) return null;
  const now = Date.now();
  const hit = cache.get(path);
  if (hit && hit.expires > now) return hit.url;

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, EXPIRY);
  if (error || !data?.signedUrl) return null;
  cache.set(path, { url: data.signedUrl, expires: now + (EXPIRY - 60) * 1000 });
  return data.signedUrl;
}

/** Batch signed URLs for many site-media paths. */
export async function getMediaUrls(paths: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const now = Date.now();
  const missing: string[] = [];

  for (const p of paths) {
    if (!p) continue;
    const hit = cache.get(p);
    if (hit && hit.expires > now) out[p] = hit.url;
    else missing.push(p);
  }
  if (missing.length === 0) return out;

  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(missing, EXPIRY);
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) {
      out[item.path] = item.signedUrl;
      cache.set(item.path, { url: item.signedUrl, expires: now + (EXPIRY - 60) * 1000 });
    }
  }
  return out;
}

/** Remove a file from the site-media bucket. */
export async function deleteMediaFile(path: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([path]);
  cache.delete(path);
}
