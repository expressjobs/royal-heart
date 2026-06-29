import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireServerAdmin } from "@/lib/server-auth";
import { writeAdminAuditWarning } from "@/lib/admin-audit";
import { structuredAdminError, type StructuredAdminError } from "@/lib/admin-errors";
import { getImageInfo } from "@/lib/image-validation";
import type { Json } from "@/integrations/supabase/types";

const BROADCAST_MEDIA_BUCKET = "broadcast-media";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const VIDEO_MIME_TYPES = new Set(["video/mp4", "video/webm"]);
const IMAGE_EXT_BY_FORMAT: Record<string, string> = { jpeg: "jpg", png: "png", webp: "webp" };
const VIDEO_EXT_BY_MIME: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm" };

const audienceSchema = z.object({
  group: z
    .enum([
      "all",
      "free",
      "gold",
      "platinum",
      "incomplete",
      "inactive",
      "verified",
      "location",
      "marketers",
      "selected",
      "admin_test",
    ])
    .default("all"),
  country: z.string().trim().max(120).optional(),
  city: z.string().trim().max(120).optional(),
  userIds: z.array(z.string().uuid()).max(500).optional(),
});

const broadcastSchema = z
  .object({
    id: z.string().uuid().nullable().optional(),
    title: z.string().trim().min(1).max(160),
    message: z.string().trim().min(1).max(2000),
    ctaLabel: z.string().trim().max(80).optional().nullable(),
    ctaUrl: z.string().trim().max(1000).optional().nullable(),
    imageUrl: z.string().trim().max(1000).optional().nullable(),
    mediaUrl: z.string().trim().max(1000).optional().nullable(),
    mediaType: z.enum(["image", "video"]).optional().nullable(),
    mediaPath: z.string().trim().max(1000).optional().nullable(),
    audience: audienceSchema,
    broadcastType: z
      .enum([
        "in_app_notification",
        "promotional_message",
        "system_announcement",
        "upgrade_offer",
        "safety_notice",
      ])
      .default("system_announcement"),
    status: z.enum(["draft", "scheduled", "sent", "failed"]).default("draft"),
    scheduledFor: z.string().datetime().optional().nullable(),
    sendNow: z.boolean().default(false),
    confirmAll: z.boolean().default(false),
  })
  .superRefine((value, context) => {
    if (value.status === "scheduled" && !value.scheduledFor) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scheduledFor"],
        message: "Choose a date and time for the scheduled broadcast.",
      });
    }
    if (
      value.status === "scheduled" &&
      value.scheduledFor &&
      new Date(value.scheduledFor).getTime() <= Date.now()
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scheduledFor"],
        message: "Scheduled broadcasts must be set for a future time.",
      });
    }
  });

type BroadcastInput = z.infer<typeof broadcastSchema>;

export interface BroadcastRow {
  id: string;
  title: string;
  message: string;
  cta_label: string | null;
  cta_url: string | null;
  image_url: string | null;
  media_url: string | null;
  media_type: "image" | "video" | null;
  media_path: string | null;
  audience_filter: Json;
  broadcast_type: string;
  status: string;
  scheduled_for: string | null;
  sent_at: string | null;
  audience_size: number;
  sent_count: number;
  failed_count: number;
  created_by: string | null;
  created_at: string;
}

export interface BroadcastDeliveryRow {
  id: string;
  broadcast_id: string;
  user_id: string;
  notification_id: string | null;
  media_url: string | null;
  media_type: "image" | "video" | null;
  status: string;
  error: string | null;
  sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  attempt_count: number;
  last_attempt_at: string | null;
  created_at: string;
}

type BroadcastActionResult =
  | {
      ok: true;
      id?: string;
      audienceSize?: number;
      sent?: number;
      failed?: number;
      status?: string;
    }
  | ({ ok: false; error: string } & StructuredAdminError);

export type UploadBroadcastMediaResult =
  | { ok: true; path: string; url: string; mediaType: "image" | "video" }
  | { ok: false; error: string };

async function auditAdminAction(
  actorId: string,
  action: string,
  entityId: string | null,
  details: Record<string, unknown> = {},
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await writeAdminAuditWarning(supabaseAdmin, {
    actorId,
    action,
    entityType: "broadcast",
    entityId,
    details,
  });
}

async function resolveAudience(
  supabaseAdmin: Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"],
  audience: z.infer<typeof audienceSchema>,
  adminId: string,
) {
  if (audience.group === "admin_test") return [adminId];
  if (audience.group === "selected") return [...new Set(audience.userIds ?? [])];

  if (audience.group === "marketers") {
    const { data, error } = await supabaseAdmin
      .from("marketers" as never)
      .select("user_id")
      .eq("status", "active")
      .not("user_id", "is", null);
    if (error) throw structuredAdminError(error, "resolve_audience.marketers");
    return [
      ...new Set(
        ((data ?? []) as unknown as Array<{ user_id: string | null }>)
          .map((row) => row.user_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
  }

  let query = supabaseAdmin
    .from("profiles")
    .select(
      "id, membership_tier, profile_completion_score, is_verified, last_active, location_country, location_city",
    );

  if (audience.group === "free") query = query.eq("membership_tier", "free");
  if (audience.group === "gold") query = query.eq("membership_tier", "gold");
  if (audience.group === "platinum") query = query.eq("membership_tier", "platinum");
  if (audience.group === "verified") query = query.eq("is_verified", true);
  if (audience.group === "incomplete") query = query.lt("profile_completion_score", 80);
  if (audience.group === "inactive") {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    query = query.lt("last_active", since);
  }
  if (audience.group === "location") {
    if (audience.country) query = query.ilike("location_country", audience.country);
    if (audience.city) query = query.ilike("location_city", audience.city);
  }

  const { data, error } = await query.limit(10000);
  if (error) throw structuredAdminError(error, "resolve_audience.profiles");
  return [...new Set((data ?? []).map((row) => row.id))];
}

function notificationTypeFor(broadcastType: string) {
  if (broadcastType === "upgrade_offer" || broadcastType === "promotional_message")
    return "promotion";
  if (broadcastType === "safety_notice") return "safety";
  return "system";
}

function isSupportedVideo(bytes: Uint8Array, mimeType: string) {
  if (mimeType === "video/webm") {
    return (
      bytes.length >= 4 &&
      bytes[0] === 0x1a &&
      bytes[1] === 0x45 &&
      bytes[2] === 0xdf &&
      bytes[3] === 0xa3
    );
  }
  if (mimeType === "video/mp4") {
    if (bytes.length < 12) return false;
    const box = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    return box === "ftyp" && /^(isom|iso2|avc1|mp41|mp42|M4V |MSNV|dash)$/.test(brand);
  }
  return false;
}

export const uploadAdminBroadcastMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error("Expected form data");
    const file = data.get("file");
    if (!(file instanceof File)) throw new Error("No file provided");
    return { file };
  })
  .handler(async ({ data, context }): Promise<UploadBroadcastMediaResult> => {
    const { file } = data;
    try {
      await requireServerAdmin(context.supabase, context.userId);
    } catch {
      return { ok: false, error: "Only admins can upload broadcast media." };
    }

    if (file.size === 0) return { ok: false, error: "That file is empty." };

    const bytes = new Uint8Array(await file.arrayBuffer());
    let mediaType: "image" | "video";
    let extension: string;
    let contentType: string;

    if (IMAGE_MIME_TYPES.has(file.type)) {
      if (file.size > MAX_IMAGE_BYTES) {
        return { ok: false, error: "Image is too large. Maximum size is 5MB." };
      }
      const info = getImageInfo(bytes);
      if (!info || !IMAGE_MIME_TYPES.has(`image/${info.format}`)) {
        return { ok: false, error: "File contents do not match a supported image type." };
      }
      mediaType = "image";
      extension = IMAGE_EXT_BY_FORMAT[info.format];
      contentType = `image/${info.format}`;
    } else if (VIDEO_MIME_TYPES.has(file.type)) {
      if (file.size > MAX_VIDEO_BYTES) {
        return { ok: false, error: "Video is too large. Maximum size is 50MB." };
      }
      if (!isSupportedVideo(bytes, file.type)) {
        return { ok: false, error: "File contents do not match a supported video type." };
      }
      mediaType = "video";
      extension = VIDEO_EXT_BY_MIME[file.type];
      contentType = file.type;
    } else {
      return { ok: false, error: "Unsupported file type. Upload JPG, PNG, WebP, MP4, or WebM." };
    }

    const path = `${context.userId}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await context.supabase.storage
      .from(BROADCAST_MEDIA_BUCKET)
      .upload(path, file, {
        cacheControl: "31536000",
        upsert: false,
        contentType,
      });
    if (uploadError) return { ok: false, error: uploadError.message };

    const { data: publicUrl } = context.supabase.storage
      .from(BROADCAST_MEDIA_BUCKET)
      .getPublicUrl(path);
    return { ok: true, path, url: publicUrl.publicUrl, mediaType };
  });

export const removeAdminBroadcastMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ path: z.string().trim().min(1).max(1000) }).parse(data),
  )
  .handler(async ({ data, context }): Promise<{ ok: true } | { ok: false; error: string }> => {
    try {
      await requireServerAdmin(context.supabase, context.userId);
    } catch {
      return { ok: false, error: "Only admins can remove broadcast media." };
    }

    const { error } = await context.supabase.storage
      .from(BROADCAST_MEDIA_BUCKET)
      .remove([data.path]);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });

async function deliverBroadcast(
  broadcastId: string,
  payload: BroadcastInput,
  adminId: string,
  retryUserIds?: string[],
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const audience =
    retryUserIds ?? (await resolveAudience(supabaseAdmin, payload.audience, adminId));
  if (payload.audience.group === "all" && !payload.confirmAll) {
    throw new Error("Confirm all-user broadcast before sending.");
  }

  const { error: startingError } = await supabaseAdmin
    .from("broadcasts" as never)
    .update({
      status: "sending",
      ...(retryUserIds
        ? {}
        : {
            audience_size: audience.length,
            sent_count: 0,
            failed_count: 0,
          }),
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", broadcastId);
  if (startingError) throw structuredAdminError(startingError, "broadcast_status.sending");

  const type = notificationTypeFor(payload.broadcastType);
  let sent = 0;
  let failed = 0;
  for (const userId of audience) {
    const attemptedAt = new Date().toISOString();
    try {
      const { data: notification, error } = await supabaseAdmin
        .from("notifications")
        .insert({
          user_id: userId,
          type,
          title: payload.title,
          body: payload.message,
          data: {
            broadcast_id: broadcastId,
            cta_label: payload.ctaLabel || null,
            cta_url: payload.ctaUrl || null,
            image_url: payload.mediaUrl || payload.imageUrl || null,
            media_url: payload.mediaUrl || null,
            media_type: payload.mediaType || null,
          },
        } as never)
        .select("id")
        .single();
      if (error) throw error;
      const { error: deliveryError } = await supabaseAdmin
        .from("broadcast_deliveries" as never)
        .upsert(
          {
            broadcast_id: broadcastId,
            user_id: userId,
            notification_id: (notification as { id?: string } | null)?.id ?? null,
            media_url: payload.mediaUrl || null,
            media_type: payload.mediaType || null,
            status: "sent",
            error: null,
            sent_at: attemptedAt,
            attempt_count: 1,
            last_attempt_at: attemptedAt,
          } as never,
          { onConflict: "broadcast_id,user_id" },
        );
      if (deliveryError) throw structuredAdminError(deliveryError, "broadcast_delivery.sent");
      sent += 1;
    } catch (error) {
      const { error: failedDeliveryError } = await supabaseAdmin
        .from("broadcast_deliveries" as never)
        .upsert(
          {
            broadcast_id: broadcastId,
            user_id: userId,
            media_url: payload.mediaUrl || null,
            media_type: payload.mediaType || null,
            status: "failed",
            error: error instanceof Error ? error.message : "Delivery failed",
            attempt_count: 1,
            last_attempt_at: attemptedAt,
          } as never,
          { onConflict: "broadcast_id,user_id" },
        );
      if (failedDeliveryError) {
        throw structuredAdminError(failedDeliveryError, "broadcast_delivery.failed");
      }
      failed += 1;
    }

    const processed = sent + failed;
    if (processed % 10 === 0 || processed === audience.length) {
      const progress = retryUserIds
        ? { updated_at: new Date().toISOString() }
        : {
            sent_count: sent,
            failed_count: failed,
            updated_at: new Date().toISOString(),
          };
      const { error: progressError } = await supabaseAdmin
        .from("broadcasts" as never)
        .update(progress as never)
        .eq("id", broadcastId);
      if (progressError) {
        throw structuredAdminError(progressError, "broadcast_status.progress");
      }
    }
  }

  const [
    { count: deliveredCount, error: deliveredCountError },
    { count: failedCount, error: failedCountError },
  ] = await Promise.all([
    supabaseAdmin
      .from("broadcast_deliveries" as never)
      .select("id", { count: "exact", head: true })
      .eq("broadcast_id", broadcastId)
      .in("status", ["sent", "opened", "clicked"]),
    supabaseAdmin
      .from("broadcast_deliveries" as never)
      .select("id", { count: "exact", head: true })
      .eq("broadcast_id", broadcastId)
      .eq("status", "failed"),
  ]);
  if (deliveredCountError) {
    throw structuredAdminError(deliveredCountError, "broadcast_delivery.delivered_count");
  }
  if (failedCountError) {
    throw structuredAdminError(failedCountError, "broadcast_delivery.failed_count");
  }
  const totalDelivered = deliveredCount ?? 0;
  const totalFailed = failedCount ?? 0;
  const { error: statusError } = await supabaseAdmin
    .from("broadcasts" as never)
    .update({
      status: totalFailed > 0 && totalDelivered === 0 ? "failed" : "sent",
      sent_at: new Date().toISOString(),
      sent_count: totalDelivered,
      failed_count: totalFailed,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", broadcastId);
  if (statusError) throw structuredAdminError(statusError, "broadcast_status.update");
  return {
    audienceSize: retryUserIds ? totalDelivered + totalFailed : audience.length,
    sent,
    failed,
  };
}

function broadcastInputFromRow(
  row: BroadcastRow,
  overrides: Partial<BroadcastInput> = {},
): BroadcastInput {
  const audience = audienceSchema.parse(row.audience_filter);
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    ctaLabel: row.cta_label,
    ctaUrl: row.cta_url,
    imageUrl: row.image_url,
    mediaUrl: row.media_url,
    mediaType: row.media_type,
    mediaPath: row.media_path,
    audience,
    broadcastType: z
      .enum([
        "in_app_notification",
        "promotional_message",
        "system_announcement",
        "upgrade_offer",
        "safety_notice",
      ])
      .parse(row.broadcast_type),
    status: "draft",
    scheduledFor: null,
    sendNow: false,
    confirmAll: audience.group === "all",
    ...overrides,
  };
}

export const previewBroadcastAudience = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => audienceSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ count: number }> => {
    await requireServerAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const audience = await resolveAudience(supabaseAdmin, data, context.userId);
    return { count: audience.length };
  });

export const listAdminBroadcasts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{ broadcasts: BroadcastRow[]; deliveries: BroadcastDeliveryRow[] }> => {
      await requireServerAdmin(context.supabase, context.userId);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const [
        { data: broadcasts, error: broadcastsError },
        { data: deliveries, error: deliveriesError },
      ] = await Promise.all([
        supabaseAdmin
          .from("broadcasts" as never)
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100),
        supabaseAdmin
          .from("broadcast_deliveries" as never)
          .select("*")
          .order("created_at", { ascending: false })
          .limit(10000),
      ]);
      if (broadcastsError) throw structuredAdminError(broadcastsError, "broadcasts.list");
      if (deliveriesError) throw structuredAdminError(deliveriesError, "broadcast_deliveries.list");
      return {
        broadcasts: (broadcasts ?? []) as unknown as BroadcastRow[],
        deliveries: (deliveries ?? []) as unknown as BroadcastDeliveryRow[],
      };
    },
  );

export const saveAdminBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => broadcastSchema.parse(data))
  .handler(async ({ data, context }): Promise<BroadcastActionResult> => {
    try {
      await requireServerAdmin(context.supabase, context.userId);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const audience = await resolveAudience(supabaseAdmin, data.audience, context.userId);
      const payload = {
        title: data.title,
        message: data.message,
        cta_label: data.ctaLabel || null,
        cta_url: data.ctaUrl || null,
        image_url: data.imageUrl || null,
        media_url: data.mediaUrl || null,
        media_type: data.mediaType || null,
        media_path: data.mediaPath || null,
        audience_filter: data.audience,
        broadcast_type: data.broadcastType,
        status: data.sendNow ? "draft" : data.status,
        scheduled_for: data.scheduledFor || null,
        audience_size: audience.length,
        updated_at: new Date().toISOString(),
      };
      let id = data.id ?? null;
      if (id) {
        const { error } = await supabaseAdmin
          .from("broadcasts" as never)
          .update(payload as never)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { data: created, error } = await supabaseAdmin
          .from("broadcasts" as never)
          .insert({ ...payload, created_by: context.userId } as never)
          .select("id")
          .single();
        if (error) throw error;
        id = (created as unknown as { id: string }).id;
      }
      await auditAdminAction(
        context.userId,
        data.sendNow ? "broadcast.send" : "broadcast.save",
        id,
        {
          audience_size: audience.length,
          audience: data.audience,
        },
      );
      if (!data.sendNow) {
        return { ok: true, id, audienceSize: audience.length, status: data.status };
      }
      const result = await deliverBroadcast(id, data, context.userId);
      return {
        ok: true,
        id,
        audienceSize: result.audienceSize,
        sent: result.sent,
        failed: result.failed,
      };
    } catch (error) {
      const structured = structuredAdminError(error, "broadcast.save", "Could not save broadcast.");
      return {
        ok: false,
        ...structured,
        error: structured.message,
      };
    }
  });

export const sendAdminBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        confirmAll: z.boolean().default(false),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<BroadcastActionResult> => {
    try {
      await requireServerAdmin(context.supabase, context.userId);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: row, error } = await supabaseAdmin
        .from("broadcasts" as never)
        .select("*")
        .eq("id", data.id)
        .single();
      if (error) throw error;
      const payload = broadcastInputFromRow(row as unknown as BroadcastRow, {
        sendNow: true,
        confirmAll: data.confirmAll,
      });
      await auditAdminAction(context.userId, "broadcast.send", data.id, {
        audience: payload.audience,
      });
      const result = await deliverBroadcast(data.id, payload, context.userId);
      return { ok: true, id: data.id, ...result };
    } catch (error) {
      const structured = structuredAdminError(error, "broadcast.send", "Could not send broadcast.");
      return { ok: false, ...structured, error: structured.message };
    }
  });

export const retryFailedBroadcastDeliveries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<BroadcastActionResult> => {
    try {
      await requireServerAdmin(context.supabase, context.userId);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const [{ data: row, error: broadcastError }, { data: failedRows, error: failedError }] =
        await Promise.all([
          supabaseAdmin
            .from("broadcasts" as never)
            .select("*")
            .eq("id", data.id)
            .single(),
          supabaseAdmin
            .from("broadcast_deliveries" as never)
            .select("user_id")
            .eq("broadcast_id", data.id)
            .eq("status", "failed"),
        ]);
      if (broadcastError) throw broadcastError;
      if (failedError) throw failedError;
      const failedUserIds = ((failedRows ?? []) as unknown as Array<{ user_id: string }>).map(
        (delivery) => delivery.user_id,
      );
      if (failedUserIds.length === 0) {
        throw new Error("This broadcast has no failed deliveries to retry.");
      }
      const payload = broadcastInputFromRow(row as unknown as BroadcastRow, {
        sendNow: true,
        confirmAll: true,
      });
      await auditAdminAction(context.userId, "broadcast.retry_failed", data.id, {
        failed_count: failedUserIds.length,
      });
      const result = await deliverBroadcast(data.id, payload, context.userId, failedUserIds);
      return { ok: true, id: data.id, ...result };
    } catch (error) {
      const structured = structuredAdminError(
        error,
        "broadcast.retry_failed",
        "Could not retry failed deliveries.",
      );
      return { ok: false, ...structured, error: structured.message };
    }
  });

export const deleteAdminBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(
    async ({ data, context }): Promise<{ ok: true } | ({ ok: false } & StructuredAdminError)> => {
      try {
        await requireServerAdmin(context.supabase, context.userId);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: row, error: readError } = await supabaseAdmin
          .from("broadcasts" as never)
          .select("media_path")
          .eq("id", data.id)
          .single();
        if (readError) throw readError;
        const { error } = await supabaseAdmin
          .from("broadcasts" as never)
          .delete()
          .eq("id", data.id);
        if (error) throw error;
        const mediaPath = (row as unknown as { media_path: string | null }).media_path;
        if (mediaPath) {
          await supabaseAdmin.storage.from(BROADCAST_MEDIA_BUCKET).remove([mediaPath]);
        }
        await auditAdminAction(context.userId, "broadcast.delete", data.id);
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          ...structuredAdminError(error, "broadcast.delete", "Could not delete broadcast."),
        };
      }
    },
  );

export const trackBroadcastClick = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ notificationId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("broadcast_deliveries" as never)
      .update({
        status: "clicked",
        opened_at: new Date().toISOString(),
        clicked_at: new Date().toISOString(),
      } as never)
      .eq("notification_id", data.notificationId)
      .eq("user_id", context.userId);
    if (error) throw structuredAdminError(error, "broadcast.click");
    return { ok: true };
  });
