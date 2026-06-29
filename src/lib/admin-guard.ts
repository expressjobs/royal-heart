import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

const RANK: Record<AppRole, number> = {
  super_admin: 3,
  admin: 2,
  moderator: 1,
  user: 0,
};

/**
 * Route-level access gate for staff areas. Runs inside the `_authenticated`
 * subtree (ssr: false), so it executes on the client where the Supabase
 * session is available. It re-reads the caller's real roles from the
 * RLS-protected `user_roles` table — the role can never be spoofed because the
 * row is keyed to `auth.uid()`. Insufficient role → redirect away from the
 * admin URL entirely (defence in depth on top of the UI guard and the
 * server-side RLS that already gates every admin action).
 */
export async function requireMinRole(min: AppRole): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw redirect({ to: "/auth" });

  const { data: rows } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", auth.user.id);

  const highest = (rows ?? []).reduce((acc, r) => {
    const rank = RANK[r.role as AppRole] ?? 0;
    return rank > acc ? rank : acc;
  }, 0);

  if (highest < RANK[min]) {
    throw redirect({ to: "/discover" });
  }
}
