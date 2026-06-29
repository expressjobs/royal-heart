import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireServerAdmin } from "@/lib/server-auth";
import { writeAdminAuditWarning } from "@/lib/admin-audit";
import type { Database } from "@/integrations/supabase/types";

type MembershipTier = Database["public"]["Enums"]["membership_tier"];

export interface AdminActionDatabaseError {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}

export interface AdminActionResult {
  ok: boolean;
  stage: string;
  userId?: string;
  error?: string;
  dbError?: AdminActionDatabaseError;
}

export interface AdminHealthCheckRow {
  name: string;
  passed: boolean;
  stage: string;
  error?: string;
  dbError?: AdminActionDatabaseError;
}

interface LogInput {
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  details?: Record<string, unknown>;
}

function supabaseErrorDetails(error: unknown): AdminActionDatabaseError {
  if (!error || typeof error !== "object") return { message: String(error) };
  const maybe = error as { message?: string; code?: string; details?: string; hint?: string };
  return {
    message: maybe.message,
    code: maybe.code,
    details: maybe.details,
    hint: maybe.hint,
  };
}

function failure(input: {
  error: unknown;
  stage: string;
  userId?: string;
  fallback?: string;
}): AdminActionResult {
  const dbError = supabaseErrorDetails(input.error);
  return {
    ok: false,
    stage: input.stage,
    userId: input.userId,
    error: dbError.message ?? input.fallback ?? "Admin action failed.",
    dbError,
  };
}

function cleanMemberPatch(input: unknown): {
  userId: string;
  patch: { membership_tier?: MembershipTier; is_verified?: boolean; is_featured?: boolean };
} {
  const raw = input as {
    userId?: unknown;
    patch?: { membership_tier?: unknown; is_verified?: unknown; is_featured?: unknown };
  };
  if (!raw || typeof raw.userId !== "string" || !raw.userId) {
    throw new Error("A user id is required.");
  }
  const patch: { membership_tier?: MembershipTier; is_verified?: boolean; is_featured?: boolean } =
    {};
  if (raw.patch?.membership_tier != null) {
    if (!["free", "gold", "platinum"].includes(String(raw.patch.membership_tier))) {
      throw new Error("Membership tier must be Free, Gold, or Platinum.");
    }
    patch.membership_tier = raw.patch.membership_tier as MembershipTier;
  }
  if (raw.patch?.is_verified != null) patch.is_verified = Boolean(raw.patch.is_verified);
  if (raw.patch?.is_featured != null) patch.is_featured = Boolean(raw.patch.is_featured);
  if (Object.keys(patch).length === 0) throw new Error("No profile changes were provided.");
  return { userId: raw.userId, patch };
}

function cleanModerationInput(input: unknown): {
  userId: string;
  action: "suspend7" | "ban" | "lift";
} {
  const raw = input as { userId?: unknown; action?: unknown };
  if (!raw || typeof raw.userId !== "string" || !raw.userId) {
    throw new Error("A user id is required.");
  }
  if (!["suspend7", "ban", "lift"].includes(String(raw.action))) {
    throw new Error("Unsupported moderation action.");
  }
  return { userId: raw.userId, action: raw.action as "suspend7" | "ban" | "lift" };
}

/**
 * Records an admin action in the admin_audit_log. Authorizes the caller as an
 * admin (or super_admin) and writes via the service role so the log stays
 * append-only and tamper-resistant from the client side.
 */
export const logAdminAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: LogInput) => {
    if (!data || typeof data.action !== "string" || !data.action.trim()) {
      throw new Error("An action label is required.");
    }
    return {
      action: data.action.slice(0, 120),
      entityType: data.entityType ? String(data.entityType).slice(0, 60) : null,
      entityId: data.entityId ? String(data.entityId).slice(0, 80) : null,
      details: data.details ?? {},
    };
  })
  .handler(async ({ data, context }): Promise<{ ok: boolean }> => {
    const { supabase, userId } = context;

    await requireServerAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await writeAdminAuditWarning(supabaseAdmin, {
      actorId: userId,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId,
      details: data.details,
    });
    return { ok: true };
  });

/** Fire-and-forget audit logging helper for client event handlers. */
export function audit(input: LogInput): void {
  void logAdminAction({ data: input }).catch(() => {
    /* never block the UI on audit logging */
  });
}

export const updateAdminMemberProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(cleanMemberPatch)
  .handler(async ({ data, context }): Promise<AdminActionResult> => {
    try {
      await requireServerAdmin(context.supabase, context.userId);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ ...data.patch, updated_at: new Date().toISOString() } as never)
        .eq("id", data.userId);
      if (error) return failure({ error, stage: "update_profile", userId: data.userId });
      await writeAdminAuditWarning(supabaseAdmin, {
        actorId: context.userId,
        action: "admin_member.profile_update",
        entityType: "profile",
        entityId: data.userId,
        details: data.patch,
      });
      return { ok: true, stage: "complete", userId: data.userId };
    } catch (error) {
      return failure({ error, stage: "authorize", userId: data.userId });
    }
  });

export const moderateAdminMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(cleanModerationInput)
  .handler(async ({ data, context }): Promise<AdminActionResult> => {
    try {
      await requireServerAdmin(context.supabase, context.userId);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const payload =
        data.action === "lift"
          ? { is_banned: false, banned_until: null, ban_reason: null }
          : data.action === "suspend7"
            ? {
                is_banned: true,
                banned_until: new Date(Date.now() + 7 * 86400000).toISOString(),
                ban_reason: "Suspended 7 days by admin",
              }
            : { is_banned: true, banned_until: null, ban_reason: "Banned by admin" };
      const { error } = await supabaseAdmin
        .from("user_moderation")
        .upsert({ user_id: data.userId, ...payload } as never, { onConflict: "user_id" });
      if (error) return failure({ error, stage: "upsert_moderation", userId: data.userId });
      await writeAdminAuditWarning(supabaseAdmin, {
        actorId: context.userId,
        action: `admin_member.${data.action}`,
        entityType: "profile",
        entityId: data.userId,
        details: payload,
      });
      return { ok: true, stage: "complete", userId: data.userId };
    } catch (error) {
      return failure({ error, stage: "authorize", userId: data.userId });
    }
  });

export const runAdminHealthCheck = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminHealthCheckRow[]> => {
    await requireServerAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const checks: Array<{
      name: string;
      stage: string;
      run: () => Promise<{ error: unknown } | { error: null }>;
    }> = [
      {
        name: "List auth users",
        stage: "auth.admin.listUsers",
        run: async () => {
          const { error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });
          return { error };
        },
      },
      {
        name: "Profiles table",
        stage: "profiles.select",
        run: async () => {
          const { error } = await supabaseAdmin
            .from("profiles")
            .select("id", { count: "exact", head: true });
          return { error };
        },
      },
      {
        name: "Profile photos table",
        stage: "profile_photos.select",
        run: async () => {
          const { error } = await supabaseAdmin
            .from("profile_photos")
            .select("id", { count: "exact", head: true });
          return { error };
        },
      },
      {
        name: "Moderation table",
        stage: "user_moderation.select",
        run: async () => {
          const { error } = await supabaseAdmin
            .from("user_moderation")
            .select("user_id", { count: "exact", head: true });
          return { error };
        },
      },
      {
        name: "Referrals table",
        stage: "referrals.select",
        run: async () => {
          const { error } = await supabaseAdmin
            .from("referrals" as never)
            .select("id", { count: "exact", head: true });
          return { error };
        },
      },
      {
        name: "Payments table",
        stage: "payments.select",
        run: async () => {
          const { error } = await supabaseAdmin
            .from("payments")
            .select("id", { count: "exact", head: true });
          return { error };
        },
      },
      {
        name: "App settings table",
        stage: "app_settings.select",
        run: async () => {
          const { error } = await supabaseAdmin
            .from("app_settings")
            .select("key", { count: "exact", head: true });
          return { error };
        },
      },
      {
        name: "Admin audit log table",
        stage: "admin_audit_log.select",
        run: async () => {
          const { error } = await supabaseAdmin
            .from("admin_audit_log")
            .select("id", { count: "exact", head: true });
          return { error };
        },
      },
      {
        name: "Profile photo storage bucket",
        stage: "storage.profile-photos.list",
        run: async () => {
          const { error } = await supabaseAdmin.storage
            .from("profile-photos")
            .list("", { limit: 1 });
          return { error };
        },
      },
    ];

    const results: AdminHealthCheckRow[] = [];
    for (const check of checks) {
      try {
        const result = await check.run();
        if (result.error) {
          const dbError = supabaseErrorDetails(result.error);
          results.push({
            name: check.name,
            passed: false,
            stage: check.stage,
            error: dbError.message,
            dbError,
          });
        } else {
          results.push({ name: check.name, passed: true, stage: check.stage });
        }
      } catch (error) {
        const dbError = supabaseErrorDetails(error);
        results.push({
          name: check.name,
          passed: false,
          stage: check.stage,
          error: dbError.message,
          dbError,
        });
      }
    }
    return results;
  });
