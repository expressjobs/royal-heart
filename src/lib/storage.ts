import { supabase } from "@/integrations/supabase/client";

const BUCKET = "profile-photos";
const EXPIRY = 60 * 60 * 24; // 24h signed URLs

const cache = new Map<string, { url: string; expires: number }>();

function isDirectAssetPath(path: string): boolean {
  return path.startsWith("/") || path.startsWith("http://") || path.startsWith("https://");
}

function normalizeStoragePath(source: string): string {
  const path = source.trim();
  if (!path) return "";

  if (path.startsWith("http://") || path.startsWith("https://")) {
    try {
      const url = new URL(path);
      const marker = "/storage/v1/object/";
      const markerIndex = url.pathname.indexOf(marker);
      if (markerIndex < 0) return path;

      const objectPath = url.pathname.slice(markerIndex + marker.length);
      const segments = objectPath.split("/").filter(Boolean);
      if (["public", "sign", "authenticated"].includes(segments[0] ?? "")) segments.shift();
      if (segments[0] === BUCKET) segments.shift();
      return decodeURIComponent(segments.join("/"));
    } catch {
      return path;
    }
  }

  const bucketPrefix = `${BUCKET}/`;
  return path.startsWith(bucketPrefix) ? path.slice(bucketPrefix.length) : path;
}

function safeStorageDiagnostic(
  operation: "sign-one" | "sign-many",
  error: { name?: string; statusCode?: string | number } | null,
  count: number,
) {
  console.warn("[profile-photo-storage] URL resolution failed", {
    operation,
    count,
    errorName: error?.name ?? "unknown",
    statusCode: error?.statusCode ?? null,
  });
}

/** Returns a usable URL synchronously when it is already direct or cached. */
export function getCachedSignedUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const normalized = normalizeStoragePath(path);
  if (!normalized) return null;
  if (isDirectAssetPath(normalized)) return normalized;
  const hit = cache.get(normalized);
  if (!hit) return null;
  if (hit.expires <= Date.now()) {
    cache.delete(normalized);
    return null;
  }
  return hit.url;
}

/** Returns a signed URL for a stored photo path, cached in-memory. */
export async function getSignedUrl(path: string): Promise<string | null> {
  if (!path) return null;
  const cached = getCachedSignedUrl(path);
  if (cached) return cached;
  const normalized = normalizeStoragePath(path);
  if (!normalized) return null;
  const now = Date.now();

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(normalized, EXPIRY);
  if (error || !data?.signedUrl) {
    safeStorageDiagnostic("sign-one", error, 1);
    return null;
  }
  cache.set(normalized, { url: data.signedUrl, expires: now + (EXPIRY - 60) * 1000 });
  return data.signedUrl;
}

/** Batch signed URLs for many paths. */
export async function getSignedUrls(paths: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const now = Date.now();
  const originalsByNormalized = new Map<string, string[]>();

  for (const p of paths) {
    const normalized = normalizeStoragePath(p);
    if (!normalized) continue;
    if (isDirectAssetPath(normalized)) {
      out[p] = normalized;
      continue;
    }
    const hit = cache.get(normalized);
    if (hit && hit.expires > now) out[p] = hit.url;
    else {
      const originals = originalsByNormalized.get(normalized) ?? [];
      originals.push(p);
      originalsByNormalized.set(normalized, originals);
    }
  }
  const missing = [...originalsByNormalized.keys()];
  if (missing.length === 0) return out;

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(missing, EXPIRY);
  if (error) safeStorageDiagnostic("sign-many", error, missing.length);
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) {
      cache.set(item.path, { url: item.signedUrl, expires: now + (EXPIRY - 60) * 1000 });
      for (const original of originalsByNormalized.get(item.path) ?? []) {
        out[original] = item.signedUrl;
      }
    }
  }
  return out;
}

export function invalidateSignedUrl(path: string) {
  const normalized = normalizeStoragePath(path);
  if (normalized && !isDirectAssetPath(normalized)) cache.delete(normalized);
}

/**
 * Profile photo uploads are handled server-side with magic-byte validation.
 * See `uploadProfilePhoto` in `src/lib/photos.functions.ts`.
 */

export async function deletePhotoFile(path: string): Promise<void> {
  const normalized = normalizeStoragePath(path);
  if (!normalized || isDirectAssetPath(normalized)) return;
  await supabase.storage.from(BUCKET).remove([normalized]);
  cache.delete(normalized);
}
