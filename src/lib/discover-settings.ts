import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireServerAdmin } from "@/lib/server-auth";
import { writeAdminAuditWarning } from "@/lib/admin-audit";
import type { Database } from "@/integrations/supabase/types";

export interface DiscoverAccessSettings {
  free_users_can_browse: boolean;
  free_users_can_like: boolean;
  free_users_can_message: boolean;
  discover_global_mode: boolean;
}

export interface DiscoverSettingsDatabaseError {
  message: string;
  code: string | null;
  details: string | null;
  hint: string | null;
}

export type SaveDiscoverAccessSettingsResult =
  | { ok: true; settings: DiscoverAccessSettings }
  | { ok: false; error: DiscoverSettingsDatabaseError };

export const DEFAULT_DISCOVER_ACCESS_SETTINGS: DiscoverAccessSettings = {
  free_users_can_browse: true,
  free_users_can_like: true,
  free_users_can_message: false,
  discover_global_mode: true,
};

const DISCOVER_ACCESS_KEYS = [
  "free_users_can_browse",
  "free_users_can_like",
  "free_users_can_message",
  "discover_global_mode",
] as const;

const DISCOVER_ACCESS_KEY_SET = new Set<string>(DISCOVER_ACCESS_KEYS);

type AppSettingsClient = Pick<SupabaseClient<Database>, "from">;

function appSettingSelect(supabase: AppSettingsClient) {
  return supabase.from("app_settings").select("key, value");
}

function toDatabaseError(error: unknown): DiscoverSettingsDatabaseError {
  const e = (error ?? {}) as {
    message?: unknown;
    code?: unknown;
    details?: unknown;
    hint?: unknown;
  };
  return {
    message: typeof e.message === "string" ? e.message : "Unknown database error",
    code: typeof e.code === "string" ? e.code : null,
    details: typeof e.details === "string" ? e.details : null,
    hint: typeof e.hint === "string" ? e.hint : null,
  };
}

export function normalizeDiscoverAccessSettings(value: unknown): DiscoverAccessSettings {
  const raw = value && typeof value === "object" ? (value as Partial<DiscoverAccessSettings>) : {};
  return {
    free_users_can_browse:
      typeof raw.free_users_can_browse === "boolean"
        ? raw.free_users_can_browse
        : DEFAULT_DISCOVER_ACCESS_SETTINGS.free_users_can_browse,
    free_users_can_like:
      typeof raw.free_users_can_like === "boolean"
        ? raw.free_users_can_like
        : DEFAULT_DISCOVER_ACCESS_SETTINGS.free_users_can_like,
    free_users_can_message:
      typeof raw.free_users_can_message === "boolean"
        ? raw.free_users_can_message
        : DEFAULT_DISCOVER_ACCESS_SETTINGS.free_users_can_message,
    discover_global_mode:
      typeof raw.discover_global_mode === "boolean"
        ? raw.discover_global_mode
        : DEFAULT_DISCOVER_ACCESS_SETTINGS.discover_global_mode,
  };
}

export function normalizeDiscoverAccessSettingRows(
  rows: Array<{ key: string; value: unknown }> | null | undefined,
): DiscoverAccessSettings {
  const raw: Partial<DiscoverAccessSettings> = {};
  for (const row of rows ?? []) {
    if (!DISCOVER_ACCESS_KEY_SET.has(row.key) || typeof row.value !== "boolean") continue;
    raw[row.key as keyof DiscoverAccessSettings] = row.value;
  }
  return normalizeDiscoverAccessSettings(raw);
}

export async function loadDiscoverAccessSettings(supabase: AppSettingsClient) {
  const { data, error } = await appSettingSelect(supabase).in("key", [...DISCOVER_ACCESS_KEYS]);
  if (error) throw error;
  return normalizeDiscoverAccessSettingRows(data as Array<{ key: string; value: unknown }> | null);
}

export const getDiscoverAccessSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DiscoverAccessSettings> => {
    return loadDiscoverAccessSettings(context.supabase);
  });

export const saveDiscoverAccessSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: DiscoverAccessSettings) => normalizeDiscoverAccessSettings(data))
  .handler(async ({ data, context }): Promise<SaveDiscoverAccessSettingsResult> => {
    try {
      await requireServerAdmin(context.supabase, context.userId);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const now = new Date().toISOString();
      const rows = DISCOVER_ACCESS_KEYS.map((key) => ({
        key,
        value: data[key],
        updated_at: now,
      }));
      const { error } = await supabaseAdmin
        .from("app_settings")
        .upsert(rows as never, { onConflict: "key" });
      if (error) {
        console.error("[discover-access-settings] save failed", toDatabaseError(error));
        return { ok: false, error: toDatabaseError(error) };
      }
      await writeAdminAuditWarning(supabaseAdmin, {
        actorId: context.userId,
        action: "discover_access_settings.update",
        entityType: "app_settings",
        entityId: "discover_access",
        details: data,
      });
      return { ok: true, settings: await loadDiscoverAccessSettings(supabaseAdmin) };
    } catch (error) {
      const dbError = toDatabaseError(error);
      console.error("[discover-access-settings] save failed", dbError);
      return { ok: false, error: dbError };
    }
  });
