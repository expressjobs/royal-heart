import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getImageInfo, type ImageFormat } from "./image-validation";

const ACCEPTED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB
const BUCKET = "profile-photos";

const EXT_BY_FORMAT: Record<ImageFormat, string> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
};

export type UploadProfilePhotoResult = { ok: true; path: string } | { ok: false; error: string };

/**
 * Server-side validated profile photo upload.
 * Inspects the real magic bytes (defeating spoofed extensions / MIME / SVG-with-JS),
 * rejects anything that isn't a genuine JPEG/PNG/WebP, and stores the file with an
 * explicit, server-derived content type under the user's own folder (RLS enforced).
 */
export const uploadProfilePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error("Expected form data");
    const file = data.get("file");
    if (!(file instanceof File)) throw new Error("No file provided");
    return { file };
  })
  .handler(async ({ data, context }): Promise<UploadProfilePhotoResult> => {
    const { file } = data;
    const { supabase, userId } = context;

    // 1. Declared MIME allowlist (fast reject; real check is magic bytes below).
    if (!ACCEPTED_MIME.has(file.type)) {
      return { ok: false, error: "Unsupported file type. Please upload a JPG, PNG or WebP image." };
    }

    // 2. Size.
    if (file.size > MAX_FILE_BYTES) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      return { ok: false, error: `Image is too large (${mb}MB). Maximum size is 8MB.` };
    }
    if (file.size === 0) {
      return { ok: false, error: "That file is empty. Please choose a valid photo." };
    }

    // 3. Verify the real format from the actual bytes (rejects SVG/HTML/spoofed files).
    const bytes = new Uint8Array(await file.arrayBuffer());
    const info = getImageInfo(bytes);
    if (!info || !ACCEPTED_MIME.has(`image/${info.format}`)) {
      return {
        ok: false,
        error: "File contents don't match a supported image type (JPG, PNG or WebP).",
      };
    }

    // 4. Store under the user's folder with a server-derived content type.
    const path = `${userId}/${crypto.randomUUID()}.${EXT_BY_FORMAT[info.format]}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, bytes, {
      cacheControl: "3600",
      upsert: false,
      contentType: `image/${info.format}`,
    });
    if (uploadError) {
      console.error("[profile-photo-upload] Supabase Storage upload failed", {
        bucket: BUCKET,
        path,
        userId,
        message: uploadError.message,
        name: uploadError.name,
      });
      return {
        ok: false,
        error: `Storage upload failed: ${uploadError.message}`,
      };
    }

    return { ok: true, path };
  });
