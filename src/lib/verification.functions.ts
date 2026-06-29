import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getImageInfo, type ImageFormat } from "./image-validation";
import type { Database } from "@/integrations/supabase/types";

type VerificationRequest = Database["public"]["Tables"]["verification_requests"]["Row"];

const ACCEPTED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB
const MIN_DIMENSION = 400; // px, shortest side
const BUCKET = "profile-photos";

const DOCUMENT_TYPES = new Set(["passport", "national_id", "drivers_license"]);

const EXT_BY_FORMAT: Record<ImageFormat, string> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
};

export type SubmitVerificationResult =
  | { ok: true; request: VerificationRequest }
  | { ok: false; error: string };

type ValidatedImage = {
  file: File;
  bytes: Uint8Array;
  format: ImageFormat;
};

/** Runs the shared MIME/size/format/resolution checks on an uploaded image. */
function validateImage(file: File, label: string): ValidatedImage | string {
  if (!ACCEPTED_MIME.has(file.type)) {
    return `Unsupported ${label} file type. Please upload a JPG, PNG or WebP image.`;
  }
  if (file.size > MAX_FILE_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return `${label} image is too large (${mb}MB). Maximum size is 8MB.`;
  }
  if (file.size === 0) {
    return `That ${label} file is empty. Please choose a valid image.`;
  }
  return { file, bytes: new Uint8Array(), format: "jpeg" };
}

/** SHA-256 hex digest of the image bytes — used to detect re-used selfies. */
async function hashBytes(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const submitVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error("Expected form data");
    const file = data.get("file");
    if (!(file instanceof File)) throw new Error("No selfie provided");
    const idFileRaw = data.get("idFile");
    const idFile = idFileRaw instanceof File && idFileRaw.size > 0 ? idFileRaw : null;
    const documentTypeRaw = data.get("documentType");
    const documentType =
      typeof documentTypeRaw === "string" && documentTypeRaw ? documentTypeRaw : null;
    return { file, idFile, documentType };
  })
  .handler(async ({ data, context }): Promise<SubmitVerificationResult> => {
    const { file, idFile, documentType } = data;
    const { supabase, userId } = context;

    // Government ID is optional, but if a document is attached its type must be valid.
    if (idFile && (!documentType || !DOCUMENT_TYPES.has(documentType))) {
      return { ok: false, error: "Please choose a valid document type for your ID." };
    }
    if (documentType && !idFile) {
      return { ok: false, error: "Please attach a photo of your government ID." };
    }

    // --- Validate the selfie ---
    const selfieCheck = validateImage(file, "selfie");
    if (typeof selfieCheck === "string") return { ok: false, error: selfieCheck };

    const selfieBytes = new Uint8Array(await file.arrayBuffer());
    const selfieInfo = getImageInfo(selfieBytes);
    if (!selfieInfo) {
      return {
        ok: false,
        error: "We couldn't read that selfie. Please upload a valid JPG, PNG or WebP photo.",
      };
    }
    if (!ACCEPTED_MIME.has(`image/${selfieInfo.format}`)) {
      return { ok: false, error: "Selfie contents don't match a supported image type." };
    }
    if (selfieInfo.width < MIN_DIMENSION || selfieInfo.height < MIN_DIMENSION) {
      return {
        ok: false,
        error: `Selfie resolution is too low (${selfieInfo.width}×${selfieInfo.height}px). Please use an image at least ${MIN_DIMENSION}×${MIN_DIMENSION}px.`,
      };
    }

    // --- Validate the optional government ID image ---
    let idBytes: Uint8Array | null = null;
    let idFormat: ImageFormat | null = null;
    if (idFile) {
      const idCheck = validateImage(idFile, "ID");
      if (typeof idCheck === "string") return { ok: false, error: idCheck };
      idBytes = new Uint8Array(await idFile.arrayBuffer());
      const idInfo = getImageInfo(idBytes);
      if (!idInfo) {
        return {
          ok: false,
          error: "We couldn't read that ID image. Please upload a valid JPG, PNG or WebP photo.",
        };
      }
      if (!ACCEPTED_MIME.has(`image/${idInfo.format}`)) {
        return { ok: false, error: "ID image contents don't match a supported image type." };
      }
      idFormat = idInfo.format;
    }

    const selfieHash = await hashBytes(selfieBytes);

    // --- Fraud screening (privileged, cross-user checks) ---
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const flags: string[] = [];

    // 1. Re-used selfie: same image already submitted by anyone else.
    //    The selfie fingerprint lives in the admin-only verification_review table.
    const { data: hashRows } = await supabaseAdmin
      .from("verification_review")
      .select("request_id")
      .eq("selfie_hash", selfieHash);
    if (hashRows && hashRows.length > 0) {
      const { data: dupRows } = await supabaseAdmin
        .from("verification_requests")
        .select("user_id")
        .in(
          "id",
          hashRows.map((r) => r.request_id),
        )
        .neq("user_id", userId)
        .limit(1);
      if (dupRows && dupRows.length > 0) flags.push("duplicate_selfie");
    }

    // 2. Repeated rejected attempts by this user.
    const { count: rejectedCount } = await supabaseAdmin
      .from("verification_requests")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "rejected");
    if ((rejectedCount ?? 0) >= 2) flags.push("repeat_rejections");

    // 3. Account / profile signals.
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("created_at, bio")
      .eq("id", userId)
      .maybeSingle();
    if (prof) {
      const ageHours = (Date.now() - new Date(prof.created_at).getTime()) / 36e5;
      if (ageHours < 24) flags.push("new_account");
      if (!prof.bio || prof.bio.trim().length === 0) flags.push("empty_profile");
    }

    // 3b. Previously banned / suspended account.
    const { data: moderation } = await supabaseAdmin
      .from("user_moderation")
      .select("is_banned")
      .eq("user_id", userId)
      .maybeSingle();
    if (moderation?.is_banned) flags.push("previously_banned");

    // 4. No public profile photos uploaded.
    const { count: photoCount } = await supabaseAdmin
      .from("profile_photos")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if ((photoCount ?? 0) === 0) flags.push("no_profile_photos");

    // 5. No government ID supplied (lower-assurance, selfie-only).
    if (!idFile) flags.push("selfie_only");

    const fraudScore = flags.reduce(
      (sum, f) =>
        sum +
        (f === "duplicate_selfie" || f === "previously_banned" ? 3 : f === "selfie_only" ? 1 : 2),
      0,
    );

    // --- Upload selfie ---
    const selfiePath = `${userId}/${crypto.randomUUID()}.${EXT_BY_FORMAT[selfieInfo.format]}`;
    const { error: selfieUploadError } = await supabase.storage
      .from(BUCKET)
      .upload(selfiePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
    if (selfieUploadError) {
      return { ok: false, error: "Selfie upload failed. Please try again." };
    }

    // --- Upload government ID (if present) ---
    let idPath: string | null = null;
    if (idFile && idFormat) {
      idPath = `${userId}/${crypto.randomUUID()}.${EXT_BY_FORMAT[idFormat]}`;
      const { error: idUploadError } = await supabase.storage.from(BUCKET).upload(idPath, idFile, {
        cacheControl: "3600",
        upsert: false,
        contentType: idFile.type,
      });
      if (idUploadError) {
        await supabase.storage.from(BUCKET).remove([selfiePath]);
        return { ok: false, error: "ID upload failed. Please try again." };
      }
    }

    // --- Record the request (user-readable, safe columns only) ---
    const { data: row, error: insertError } = await supabase
      .from("verification_requests")
      .insert({
        user_id: userId,
        photo_path: selfiePath,
        document_type: documentType,
      })
      .select("*")
      .single();
    if (insertError || !row) {
      const cleanup = idPath ? [selfiePath, idPath] : [selfiePath];
      await supabase.storage.from(BUCKET).remove(cleanup);
      return { ok: false, error: "Could not submit your request. Please try again." };
    }

    // --- Store fraud/biometric signals in the admin-only review table ---
    const { error: reviewError } = await supabaseAdmin.from("verification_review").insert({
      request_id: row.id,
      fraud_score: fraudScore,
      fraud_flags: flags,
      selfie_hash: selfieHash,
      id_photo_path: idPath,
    });
    if (reviewError) {
      await supabaseAdmin.from("verification_requests").delete().eq("id", row.id);
      const cleanup = idPath ? [selfiePath, idPath] : [selfiePath];
      await supabase.storage.from(BUCKET).remove(cleanup);
      return { ok: false, error: "Could not submit your request. Please try again." };
    }

    return { ok: true, request: row };
  });
