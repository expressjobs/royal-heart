import { supabase } from "@/integrations/supabase/client";

/**
 * Ensures a freshly authenticated user has a profile row.
 * The default "user" role is assigned by the database auth.users trigger.
 * Safe to call multiple times.
 */
export async function ensureUserSetup(userId: string) {
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (!existing) {
    await supabase.from("profiles").insert({ id: userId });
  }
}
