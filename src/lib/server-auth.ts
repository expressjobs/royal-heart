import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

const RANK: Record<AppRole, number> = {
  super_admin: 3,
  admin: 2,
  moderator: 1,
  user: 0,
};

export function hasMinRole(roles: AppRole[], min: AppRole): boolean {
  return roles.some((role) => (RANK[role] ?? 0) >= RANK[min]);
}

export async function requireServerRole(
  supabase: Pick<SupabaseClient<Database>, "from">,
  userId: string,
  min: AppRole,
): Promise<AppRole[]> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);

  const roles = (data ?? []).map((r: { role: AppRole }) => r.role as AppRole);
  if (!hasMinRole(roles, min)) throw new Error("Forbidden");
  return roles;
}

export async function requireServerAdmin(
  supabase: Pick<SupabaseClient<Database>, "from">,
  userId: string,
): Promise<AppRole[]> {
  return requireServerRole(supabase, userId, "admin");
}
