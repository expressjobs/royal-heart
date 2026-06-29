import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";

export interface AdminAuditEntry {
  actorId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  details?: Record<string, unknown>;
}

export async function writeAdminAuditWarning(
  supabaseAdmin: SupabaseClient<Database>,
  entries: AdminAuditEntry | AdminAuditEntry[],
) {
  const rows = (Array.isArray(entries) ? entries : [entries]).map((entry) => ({
    action: entry.action,
    entity_type: entry.entityType ?? null,
    entity_id: entry.entityId ?? null,
    details: {
      ...(entry.details ?? {}),
      ...(entry.actorId ? { admin_id: entry.actorId } : {}),
    } as Json,
  }));
  const { error } = await supabaseAdmin.from("admin_audit_log").insert(rows);
  if (error) {
    console.warn("[admin-audit] audit write failed; primary action completed", {
      code: error.code,
      message: error.message,
      actions: rows.map((row) => row.action),
    });
  }
  return error;
}
