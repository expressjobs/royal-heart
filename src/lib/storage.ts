import { supabase } from "@/integrations/supabase/client";

const BUCKET = "profile-photos";
const EXPIRY = 60 * 60 * 24; // 24h signed URLs

const cache = new Map<string, { url: string; expires: number }>();

function isDirectAssetPath(path: string): boolean {
  return path.startsWith("/") || path.startsWith("http://") || path.startsWith("https://");
}

/** Returns a usable URL synchronously when it is already direct or cached. */
export function getCachedSignedUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (isDirectAssetPath(path)) return path;
  const hit = cache.get(path);
  if (!hit) return null;
  if (hit.expires <= Date.now()) {
    cache.delete(path);
    return null;
  }
  return hit.url;
}

/** Returns a signed URL for a stored photo path, cached in-memory. */
export async function getSignedUrl(path: string): Promise<string | null> {
  if (!path) return null;
  const cached = getCachedSignedUrl(path);
  if (cached) return cached;
  const now = Date.now();

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, EXPIRY);
  if (error || !data?.signedUrl) return null;
  cache.set(path, { url: data.signedUrl, expires: now + (EXPIRY - 60) * 1000 });
  return data.signedUrl;
}

/** Batch signed URLs for many paths. */
export async function getSignedUrls(paths: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const now = Date.now();
  const missing: string[] = [];

  for (const p of paths) {
    if (isDirectAssetPath(p)) {
      out[p] = p;
      continue;
    }
    const hit = cache.get(p);
    if (hit && hit.expires > now) out[p] = hit.url;
    else if (p) missing.push(p);
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

/**
 * Profile photo uploads are handled server-side with magic-byte validation.
 * See `uploadProfilePhoto` in `src/lib/photos.functions.ts`.
 */

export async function deletePhotoFile(path: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([path]);
  cache.delete(path);
}
