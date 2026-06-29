import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * GDPR-style data export: returns all data the signed-in user owns.
 * Runs as the user (RLS applies), so only their own records are returned.
 */
export const exportMyData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [
      profile,
      photos,
      likesSent,
      likesReceived,
      matches,
      messages,
      blocks,
      reports,
      roles,
      verifications,
    ] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("profile_photos").select("*").eq("user_id", userId),
      supabase.from("likes").select("*").eq("liker_id", userId),
      supabase.from("likes").select("*").eq("liked_id", userId),
      supabase.from("matches").select("*").or(`user1_id.eq.${userId},user2_id.eq.${userId}`),
      supabase.from("messages").select("*").eq("sender_id", userId),
      supabase.from("blocks").select("*").eq("blocker_id", userId),
      supabase.from("reports").select("*").eq("reporter_id", userId),
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("verification_requests").select("*").eq("user_id", userId),
    ]);

    // `location_geog` is a PostGIS geography value that isn't JSON-serializable
    // across the server-function boundary; strip it from the export.
    const profileData = profile.data
      ? (({ location_geog: _omit, ...rest }) => rest)(profile.data)
      : null;

    return {
      exported_at: new Date().toISOString(),
      user_id: userId,
      profile: profileData,
      photos: photos.data ?? [],
      likes_sent: likesSent.data ?? [],
      likes_received: likesReceived.data ?? [],
      matches: matches.data ?? [],
      messages_sent: messages.data ?? [],
      blocks: blocks.data ?? [],
      reports: reports.data ?? [],
      roles: (roles.data ?? []).map((r) => r.role),
      verification_requests: verifications.data ?? [],
    };
  });

/**
 * Permanently deletes the signed-in user's account: removes their stored photos
 * and deletes the auth user, which cascades to all of their database rows
 * (profile, likes, matches, messages, blocks, reports, verification requests).
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Best-effort cleanup of storage objects this user owns.
    const { data: photos } = await supabase
      .from("profile_photos")
      .select("url, storage_path")
      .eq("user_id", userId);
    const paths = (photos ?? []).map((p) => p.storage_path || p.url).filter(Boolean);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (paths.length > 0) {
      await supabaseAdmin.storage.from("profile-photos").remove(paths);
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });
