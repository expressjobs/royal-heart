import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { loadDiscoverAccessSettings } from "@/lib/discover-settings";
import { genderPreferenceValue } from "@/lib/gender";
import { isAtLeast18 } from "@/lib/registration";
import { requireServerAdmin } from "@/lib/server-auth";

type MembershipTier = Database["public"]["Enums"]["membership_tier"];
type ServerSupabase = Pick<SupabaseClient<Database>, "from">;

type TargetEligibilityProfile = {
  id: string;
  is_active: boolean | null;
  is_demo_profile: boolean | null;
  is_discoverable: boolean | null;
  onboarding_complete: boolean | null;
  discovery_blocked_reason: string | null;
  incognito: boolean | null;
  suspicious_signup_reason: string | null;
};

type DiscoverDiagnosticProfile = {
  id: string;
  display_name?: string | null;
  is_active: boolean | null;
  is_demo_profile: boolean | null;
  is_discoverable: boolean | null;
  onboarding_complete: boolean | null;
  discovery_blocked_reason: string | null;
  gender: string | null;
  interested_in: string[] | null;
  location_country: string | null;
  location_city: string | null;
  location_state: string | null;
  birth_date?: string | null;
  relationship_goal?: string | null;
  safety_agreement_accepted_at?: string | null;
  terms_accepted_at?: string | null;
  privacy_accepted_at?: string | null;
  incognito?: boolean | null;
  suspicious_signup_reason?: string | null;
};

type DiscoverViewerProfile = {
  gender: string | null;
  interested_in: string[] | null;
};

type BlockPair = { blocker_id: string; blocked_id: string };
type ModerationState = { is_banned: boolean | null; banned_until: string | null };

interface DiscoverReactionInput {
  targetId: string;
  reaction: "like" | "pass" | "superlike";
}

interface SendMessageInput {
  matchId: string;
  content: string;
}

export interface DiscoverReactionResult {
  ok: boolean;
  gated?: boolean;
  matchId?: string | null;
  error?: string;
  likeAllowance?: DiscoverLikeAllowance;
}

export interface DiscoverDiagnostics {
  total_real_users: number;
  total_active_users: number;
  total_discoverable_users: number;
  eligible_for_current_viewer: number;
  excluded_by_current_user: number;
  excluded_by_location_filter: number;
  excluded_by_blocks_reports: number;
  excluded_by_incomplete_profile: number;
  excluded_by_gender_preference_filter: number;
  profiles_returned_current_queue: number;
  profiles_with_photos: number;
  profiles_using_safe_avatar_fallback: number;
}

export interface AdminDiscoverDiagnostics {
  total_auth_users: number;
  total_profile_rows: number;
  active_users: number;
  discoverable_users: number;
  missing_required_fields: number;
  blocked_by_preference_gender_filters: number;
  blocked_by_reports_blocks: number;
  hidden_by_incomplete_profile: number;
  hidden_by_location_filters: number;
  users_with_no_photos_safe_avatar_fallback: number;
  missing_profile_rows: number;
}

export interface DiscoverLikeAllowance {
  tier: MembershipTier;
  limit: number | null;
  used: number;
  remaining: number | null;
  resetAt: string | null;
  unlimited: boolean;
}

const PAID_TIERS: MembershipTier[] = ["premium", "gold", "platinum"];

function paidTier(tier: MembershipTier | null | undefined) {
  return tier ? PAID_TIERS.includes(tier) : false;
}

async function getAccessSettings(supabase: ServerSupabase) {
  return loadDiscoverAccessSettings(supabase);
}

async function listAllAuthUsers(
  supabaseAdmin: Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"],
) {
  const users = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...(data.users ?? []));
    if (!data.users || data.users.length < 1000) break;
  }
  return users;
}

function authUserIsDemo(user: {
  email?: string | null;
  app_metadata?: unknown;
  user_metadata?: unknown;
}) {
  const appMetadata = (user.app_metadata ?? {}) as Record<string, unknown>;
  const userMetadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  return (
    appMetadata.is_demo_profile === true ||
    userMetadata.is_demo_profile === true ||
    user.email?.endsWith("@heartconnect.local") === true
  );
}

function requiredFieldsMissing(profile: DiscoverDiagnosticProfile | null) {
  if (!profile) return true;
  if (!profile.display_name || profile.display_name.trim().length < 2) return true;
  if (!profile.birth_date || !isAtLeast18(profile.birth_date)) return true;
  if (!profile.gender) return true;
  if (!profile.interested_in?.length) return true;
  if (!profile.relationship_goal) return true;
  if (!profile.location_city || !profile.location_country) return true;
  if (!profile.safety_agreement_accepted_at) return true;
  if (!profile.terms_accepted_at || !profile.privacy_accepted_at) return true;
  return false;
}

function isSuspended(moderation: ModerationState | undefined) {
  if (!moderation?.is_banned) return false;
  if (!moderation.banned_until) return true;
  return new Date(moderation.banned_until).getTime() > Date.now();
}

function baseDiscoverReady(
  profile: DiscoverDiagnosticProfile,
  moderation: ModerationState | undefined,
) {
  return (
    profile.is_active !== false &&
    profile.is_demo_profile !== true &&
    profile.is_discoverable === true &&
    profile.onboarding_complete === true &&
    profile.incognito !== true &&
    !profile.discovery_blocked_reason &&
    !profile.suspicious_signup_reason &&
    !requiredFieldsMissing(profile) &&
    !isSuspended(moderation)
  );
}

async function getMyTier(supabase: ServerSupabase, userId: string): Promise<MembershipTier> {
  const { data, error } = await supabase
    .from("profiles")
    .select("membership_tier")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data?.membership_tier ?? "free") as MembershipTier;
}

async function getLikeAllowanceFor(
  supabase: ServerSupabase,
  userId: string,
  tier?: MembershipTier,
): Promise<DiscoverLikeAllowance> {
  const nextTier = tier ?? (await getMyTier(supabase, userId));
  if (paidTier(nextTier)) {
    return {
      tier: nextTier,
      limit: null,
      used: 0,
      remaining: null,
      resetAt: null,
      unlimited: true,
    };
  }
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("likes")
    .select("liker_id", { count: "exact", head: true })
    .eq("liker_id", userId)
    .eq("is_like", true)
    .gte("created_at", since);
  if (error) throw error;
  const used = count ?? 0;
  return {
    tier: nextTier,
    limit: 10,
    used,
    remaining: Math.max(0, 10 - used),
    resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    unlimited: false,
  };
}

async function assertTargetEligible(userId: string, targetId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [
    { data: target, error: targetError },
    { data: blockRows },
    { data: reportRows },
    { data: moderationRows },
  ] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select(
        "id, is_active, is_demo_profile, is_discoverable, onboarding_complete, discovery_blocked_reason, incognito, suspicious_signup_reason",
      )
      .eq("id", targetId)
      .maybeSingle(),
    supabaseAdmin
      .from("blocks")
      .select("blocker_id, blocked_id")
      .or(
        `and(blocker_id.eq.${userId},blocked_id.eq.${targetId}),and(blocker_id.eq.${targetId},blocked_id.eq.${userId})`,
      ),
    supabaseAdmin
      .from("reports")
      .select("id")
      .eq("reporter_id", userId)
      .eq("reported_id", targetId),
    supabaseAdmin.from("user_moderation").select("is_banned, banned_until").eq("user_id", targetId),
  ]);
  if (targetError) throw targetError;
  const targetProfile = target as TargetEligibilityProfile | null;
  if (!targetProfile) return "Profile is no longer available.";
  if ((blockRows ?? []).length > 0 || (reportRows ?? []).length > 0) {
    return "Profile is blocked or reported.";
  }
  const banned = ((moderationRows ?? []) as ModerationState[]).some(
    (row) =>
      row.is_banned && (!row.banned_until || new Date(row.banned_until).getTime() > Date.now()),
  );
  if (banned) return "Profile is unavailable.";
  if (
    targetProfile.is_active === false ||
    targetProfile.is_discoverable !== true ||
    targetProfile.onboarding_complete !== true ||
    targetProfile.incognito === true ||
    targetProfile.discovery_blocked_reason ||
    targetProfile.suspicious_signup_reason
  ) {
    return "Profile is not currently discoverable.";
  }
  return null;
}

async function recordInteraction(
  supabase: ServerSupabase,
  userId: string,
  targetId: string | null,
  signal: string,
  context: Record<string, unknown> = {},
) {
  await supabase.from("interaction_events").insert({
    user_id: userId,
    target_id: targetId,
    signal_type: signal,
    context,
  } as never);
}

export const createDiscoverReaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: DiscoverReactionInput) => {
    if (!data || typeof data.targetId !== "string" || !data.targetId) {
      throw new Error("A target profile is required.");
    }
    if (!["like", "pass", "superlike"].includes(data.reaction)) {
      throw new Error("Unsupported Discover action.");
    }
    return data;
  })
  .handler(async ({ context, data }): Promise<DiscoverReactionResult> => {
    const userId = context.userId;
    if (data.targetId === userId) return { ok: false, error: "You cannot react to yourself." };

    const tier = await getMyTier(context.supabase, userId);
    const isLike = data.reaction === "like";

    if (data.reaction !== "pass") {
      const ineligibleReason = await assertTargetEligible(userId, data.targetId);
      if (ineligibleReason) return { ok: false, error: ineligibleReason };
    }

    if (data.reaction === "superlike" && !paidTier(tier)) {
      return { ok: false, gated: true, error: "Super Like requires Gold or Platinum." };
    }

    const allowance = await getLikeAllowanceFor(context.supabase, userId, tier);
    if (isLike && !allowance.unlimited && (allowance.remaining ?? 0) <= 0) {
      return {
        ok: false,
        gated: true,
        error: "You've used your 10 free likes today. Upgrade to keep connecting.",
        likeAllowance: allowance,
      };
    }

    if (data.reaction === "superlike") {
      await recordInteraction(context.supabase, userId, data.targetId, "superlike", {
        source: "discover",
        gated: false,
      });
      return { ok: true, matchId: null, likeAllowance: allowance };
    }

    const { error } = await context.supabase.from("likes").insert({
      liker_id: userId,
      liked_id: data.targetId,
      is_like: isLike,
    });
    let inserted = !error;
    if (error) {
      const duplicate = error.message?.toLowerCase().includes("duplicate");
      const limitReached =
        error.code === "42501" ||
        error.message?.toLowerCase().includes("10 free likes") ||
        error.message?.toLowerCase().includes("daily like limit");
      if (limitReached) {
        return {
          ok: false,
          gated: true,
          error: "You've used your 10 free likes today. Upgrade to keep connecting.",
          likeAllowance: await getLikeAllowanceFor(context.supabase, userId, tier),
        };
      }
      if (!duplicate) throw error;
      inserted = false;
    }

    await recordInteraction(context.supabase, userId, data.targetId, isLike ? "like" : "pass", {
      source: "discover",
    });

    const nextAllowance =
      isLike && inserted ? await getLikeAllowanceFor(context.supabase, userId, tier) : allowance;

    if (!isLike) return { ok: true, matchId: null, likeAllowance: nextAllowance };

    const user1 = userId < data.targetId ? userId : data.targetId;
    const user2 = userId < data.targetId ? data.targetId : userId;
    let matchId: string | null = null;
    for (let attempt = 0; attempt < 4 && !matchId; attempt++) {
      const { data: match } = await context.supabase
        .from("matches")
        .select("id")
        .eq("user1_id", user1)
        .eq("user2_id", user2)
        .maybeSingle();
      matchId = match?.id ?? null;
      if (!matchId) await new Promise((resolve) => setTimeout(resolve, 200));
    }
    if (matchId) {
      await recordInteraction(context.supabase, userId, data.targetId, "match", {
        source: "discover",
      });
    }
    return { ok: true, matchId, likeAllowance: nextAllowance };
  });

export const getDiscoverLikeAllowance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DiscoverLikeAllowance> => {
    return getLikeAllowanceFor(context.supabase, context.userId);
  });

export const sendMatchMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: SendMessageInput) => {
    if (!data || typeof data.matchId !== "string" || !data.matchId) {
      throw new Error("A match is required.");
    }
    const content = typeof data.content === "string" ? data.content.trim() : "";
    if (!content) throw new Error("Message content is required.");
    if (content.length > 1000) throw new Error("Message is too long.");
    return { matchId: data.matchId, content };
  })
  .handler(async ({ context, data }): Promise<{ ok: boolean; gated?: boolean; error?: string }> => {
    const [tier, settings] = await Promise.all([
      getMyTier(context.supabase, context.userId),
      getAccessSettings(context.supabase),
    ]);

    if (!paidTier(tier) && !settings.free_users_can_message) {
      return { ok: false, gated: true, error: "Upgrade required." };
    }

    const { error } = await context.supabase.from("messages").insert({
      match_id: data.matchId,
      sender_id: context.userId,
      content: data.content,
    });
    if (error) throw error;

    await recordInteraction(context.supabase, context.userId, null, "message_sent", {
      source: "chat",
      matchId: data.matchId,
    });
    return { ok: true };
  });

export const getDiscoverDiagnostics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      filters?: { country?: string | null; city?: string | null; state?: string | null };
      currentQueueIds?: string[];
    }) => ({
      filters: data?.filters ?? {},
      currentQueueIds: Array.from(
        new Set((data?.currentQueueIds ?? []).filter((id) => typeof id === "string" && id)),
      ),
    }),
  )
  .handler(async ({ context, data }): Promise<DiscoverDiagnostics> => {
    const userId = context.userId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: me } = await supabaseAdmin
      .from("profiles")
      .select("gender, interested_in")
      .eq("id", userId)
      .maybeSingle();

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select(
        "id, is_active, is_demo_profile, is_discoverable, onboarding_complete, discovery_blocked_reason, gender, interested_in, location_country, location_city, location_state",
      );
    const profileRows = (profiles ?? []) as unknown as DiscoverDiagnosticProfile[];
    const meProfile = me as unknown as DiscoverViewerProfile | null;
    const realIds = new Set(
      profileRows
        .filter((profile) => profile.is_demo_profile !== true)
        .map((profile) => profile.id),
    );
    const { data: blocks } = await supabaseAdmin
      .from("blocks")
      .select("blocker_id, blocked_id")
      .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);
    const { data: reports } = await supabaseAdmin
      .from("reports")
      .select("reported_id")
      .eq("reporter_id", userId)
      .not("reported_id", "is", null);

    const blockedOrReported = new Set<string>([
      ...(((blocks ?? []) as BlockPair[]).map((row) =>
        row.blocker_id === userId ? row.blocked_id : row.blocker_id,
      ) as string[]),
      ...((reports ?? []).map((row) => row.reported_id).filter(Boolean) as string[]),
    ]);
    const queueIds = data.currentQueueIds ?? [];
    const { data: queuePhotos } = queueIds.length
      ? await supabaseAdmin
          .from("profile_photos")
          .select("user_id")
          .in("user_id", queueIds)
          .eq("is_private", false)
      : { data: [] };
    const queueWithPhotos = new Set(
      ((queuePhotos ?? []) as Array<{ user_id: string }>).map((row) => row.user_id),
    );
    const active = profileRows.filter((p) => p.is_active !== false);
    const requiredComplete = (p: DiscoverDiagnosticProfile) =>
      p.is_discoverable === true && p.onboarding_complete === true && !p.discovery_blocked_reason;
    const prefMatches = (
      interested: string[] | null | undefined,
      gender: string | null | undefined,
    ) => {
      if (!interested || interested.length === 0 || interested.includes("everyone")) return true;
      const mapped = genderPreferenceValue(gender);
      return mapped ? interested.includes(mapped) : false;
    };
    const locationFilter = (p: DiscoverDiagnosticProfile) => {
      const f = data.filters ?? {};
      if (f.country && p.location_country?.toLowerCase() !== f.country.toLowerCase()) return false;
      if (f.city && p.location_city?.toLowerCase() !== f.city.toLowerCase()) return false;
      if (f.state && !p.location_state?.toLowerCase().includes(f.state.toLowerCase())) return false;
      return true;
    };

    const eligible = active.filter(
      (p) =>
        p.id !== userId &&
        requiredComplete(p) &&
        !blockedOrReported.has(p.id) &&
        locationFilter(p) &&
        prefMatches(meProfile?.interested_in, p.gender) &&
        prefMatches(p.interested_in, meProfile?.gender),
    );

    return {
      total_real_users: realIds.size,
      total_active_users: active.length,
      total_discoverable_users: active.filter((p) => requiredComplete(p)).length,
      eligible_for_current_viewer: eligible.length,
      excluded_by_current_user: active.filter((p) => p.id === userId).length,
      excluded_by_location_filter: active.filter((p) => requiredComplete(p) && !locationFilter(p))
        .length,
      excluded_by_blocks_reports: active.filter((p) => blockedOrReported.has(p.id)).length,
      excluded_by_incomplete_profile: active.filter((p) => !requiredComplete(p)).length,
      excluded_by_gender_preference_filter: active.filter(
        (p) =>
          p.id !== userId &&
          requiredComplete(p) &&
          !blockedOrReported.has(p.id) &&
          locationFilter(p) &&
          (!prefMatches(meProfile?.interested_in, p.gender) ||
            !prefMatches(p.interested_in, meProfile?.gender)),
      ).length,
      profiles_returned_current_queue: queueIds.length,
      profiles_with_photos: queueWithPhotos.size,
      profiles_using_safe_avatar_fallback: Math.max(0, queueIds.length - queueWithPhotos.size),
    };
  });

export const getAdminDiscoverDiagnostics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      filters?: { country?: string | null; city?: string | null; state?: string | null };
    }) => ({
      filters: data?.filters ?? {},
    }),
  )
  .handler(async ({ context, data }): Promise<AdminDiscoverDiagnostics> => {
    await requireServerAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [
      authUsers,
      { data: profileData },
      { data: photoData },
      { data: blockData },
      { data: reportData },
      { data: moderationData },
      { data: me },
    ] = await Promise.all([
      listAllAuthUsers(supabaseAdmin),
      supabaseAdmin
        .from("profiles")
        .select(
          [
            "id",
            "display_name",
            "is_active",
            "is_demo_profile",
            "is_discoverable",
            "onboarding_complete",
            "discovery_blocked_reason",
            "gender",
            "interested_in",
            "location_country",
            "location_city",
            "location_state",
            "birth_date",
            "relationship_goal",
            "safety_agreement_accepted_at",
            "terms_accepted_at",
            "privacy_accepted_at",
            "incognito",
            "suspicious_signup_reason",
          ].join(", "),
        ),
      supabaseAdmin.from("profile_photos").select("user_id").eq("is_private", false),
      supabaseAdmin.from("blocks").select("blocker_id, blocked_id"),
      supabaseAdmin
        .from("reports")
        .select("reported_id, reporter_id")
        .not("reported_id", "is", null),
      supabaseAdmin.from("user_moderation").select("user_id, is_banned, banned_until"),
      supabaseAdmin
        .from("profiles")
        .select("gender, interested_in")
        .eq("id", context.userId)
        .maybeSingle(),
    ]);

    const realAuthUsers = authUsers.filter((user) => !authUserIsDemo(user));
    const realAuthIds = new Set(realAuthUsers.map((user) => user.id));
    const profiles = ((profileData ?? []) as unknown as DiscoverDiagnosticProfile[]).filter(
      (profile) => realAuthIds.has(profile.id) && profile.is_demo_profile !== true,
    );
    const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
    const missingProfileRows = realAuthUsers.filter((user) => !profileById.has(user.id)).length;
    const photosByUser = new Set(
      ((photoData ?? []) as Array<{ user_id: string }>).map((photo) => photo.user_id),
    );
    const moderationById = new Map(
      ((moderationData ?? []) as Array<ModerationState & { user_id: string }>).map((row) => [
        row.user_id,
        { is_banned: row.is_banned, banned_until: row.banned_until },
      ]),
    );
    const blockedOrReportedIds = new Set<string>();
    for (const block of (blockData ?? []) as BlockPair[]) {
      if (realAuthIds.has(block.blocked_id)) blockedOrReportedIds.add(block.blocked_id);
      if (realAuthIds.has(block.blocker_id)) blockedOrReportedIds.add(block.blocker_id);
    }
    for (const report of (reportData ?? []) as Array<{ reported_id: string | null }>) {
      if (report.reported_id && realAuthIds.has(report.reported_id)) {
        blockedOrReportedIds.add(report.reported_id);
      }
    }

    const meProfile = me as unknown as DiscoverViewerProfile | null;
    const prefMatches = (
      interested: string[] | null | undefined,
      gender: string | null | undefined,
    ) => {
      if (!interested || interested.length === 0 || interested.includes("everyone")) return true;
      const mapped = genderPreferenceValue(gender);
      return mapped ? interested.includes(mapped) : false;
    };
    const locationFilter = (profile: DiscoverDiagnosticProfile) => {
      const f = data.filters ?? {};
      if (f.country && profile.location_country?.toLowerCase() !== f.country.toLowerCase()) {
        return false;
      }
      if (f.city && profile.location_city?.toLowerCase() !== f.city.toLowerCase()) return false;
      if (f.state && !profile.location_state?.toLowerCase().includes(f.state.toLowerCase())) {
        return false;
      }
      return true;
    };

    const activeProfiles = profiles.filter((profile) => profile.is_active !== false);
    const baseReadyProfiles = activeProfiles.filter((profile) =>
      baseDiscoverReady(profile, moderationById.get(profile.id)),
    );
    const filteredProfiles = baseReadyProfiles.filter(
      (profile) => !blockedOrReportedIds.has(profile.id) && locationFilter(profile),
    );
    const discoverableProfiles = filteredProfiles.filter(
      (profile) =>
        profile.id !== context.userId &&
        prefMatches(meProfile?.interested_in, profile.gender) &&
        prefMatches(profile.interested_in, meProfile?.gender),
    );

    return {
      total_auth_users: realAuthUsers.length,
      total_profile_rows: profiles.length,
      active_users: activeProfiles.length,
      discoverable_users: discoverableProfiles.length,
      missing_required_fields:
        missingProfileRows + profiles.filter((profile) => requiredFieldsMissing(profile)).length,
      blocked_by_preference_gender_filters: filteredProfiles.filter(
        (profile) =>
          profile.id !== context.userId &&
          (!prefMatches(meProfile?.interested_in, profile.gender) ||
            !prefMatches(profile.interested_in, meProfile?.gender)),
      ).length,
      blocked_by_reports_blocks: activeProfiles.filter((profile) =>
        blockedOrReportedIds.has(profile.id),
      ).length,
      hidden_by_incomplete_profile: activeProfiles.filter(
        (profile) => !baseDiscoverReady(profile, moderationById.get(profile.id)),
      ).length,
      hidden_by_location_filters: baseReadyProfiles.filter((profile) => !locationFilter(profile))
        .length,
      users_with_no_photos_safe_avatar_fallback: discoverableProfiles.filter(
        (profile) => !photosByUser.has(profile.id),
      ).length,
      missing_profile_rows: missingProfileRows,
    };
  });
