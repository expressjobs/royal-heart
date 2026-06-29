import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { fetchProfilesWithPhotos, type ProfileWithPhotos } from "@/lib/profiles";

/** A single weighted dimension of the compatibility breakdown. */
export interface CompatFactor {
  key: string;
  label: string;
  weight: number;
  pct: number;
}

/** Full per-pair compatibility breakdown returned by the matching engine. */
export interface CompatBreakdown {
  score: number;
  shared_interests: string[];
  shared_goal: boolean;
  dealbreaker_conflict?: boolean;
  explanation?: string[];
  factors: CompatFactor[];
}

export interface CompatResult {
  score: number;
  breakdown: CompatBreakdown;
}

/** AI recommendation feeds backed by the compatibility scoring engine. */
export type RecommendationKind = "recommended" | "compatible" | "nearby_compatible";

/** Member activity signals stored for the ML feedback loop. */
export type InteractionSignal =
  | "view"
  | "like"
  | "pass"
  | "superlike"
  | "match"
  | "chat_open"
  | "message_sent"
  | "recommendation_shown"
  | "recommendation_clicked"
  | "recommendation_dismissed";

/** Tailwind text/bg classes for a compatibility tier. */
export function compatTone(score: number): {
  text: string;
  ring: string;
  bg: string;
  label: string;
} {
  if (score >= 80)
    return {
      text: "text-primary",
      ring: "ring-primary",
      bg: "bg-primary",
      label: "Excellent match",
    };
  if (score >= 60)
    return {
      text: "text-primary",
      ring: "ring-primary/70",
      bg: "bg-primary/80",
      label: "Great match",
    };
  if (score >= 40)
    return {
      text: "text-amber-600 dark:text-amber-400",
      ring: "ring-amber-500/60",
      bg: "bg-amber-500",
      label: "Good match",
    };
  return {
    text: "text-muted-foreground",
    ring: "ring-border",
    bg: "bg-muted-foreground",
    label: "Exploring",
  };
}

/** Fetches compatibility scores + breakdowns for a set of member ids. */
export async function fetchCompatibility(ids: string[]): Promise<Map<string, CompatResult>> {
  const out = new Map<string, CompatResult>();
  if (ids.length === 0) return out;
  const { data, error } = await supabase.rpc("compatibility_scores", { _ids: ids });
  if (error || !data) return out;
  for (const row of data as { id: string; score: number; breakdown: Json }[]) {
    out.set(row.id, {
      score: row.score,
      breakdown: row.breakdown as unknown as CompatBreakdown,
    });
  }
  return out;
}

/** Fetches the compatibility breakdown for a single member, or null. */
export async function fetchOneCompatibility(id: string): Promise<CompatResult | null> {
  const map = await fetchCompatibility([id]);
  return map.get(id) ?? null;
}

/** Hydrates a ranked recommendation list into ordered profiles carrying score + distance. */
async function hydrateScored(
  ranked: { id: string; distance_m: number | null; score: number }[],
): Promise<ProfileWithPhotos[]> {
  if (ranked.length === 0) return [];
  const ids = ranked.map((r) => r.id);
  const meta = new Map(ranked.map((r) => [r.id, r]));
  const profiles = await fetchProfilesWithPhotos(ids);
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const ordered: ProfileWithPhotos[] = [];
  for (const id of ids) {
    const p = byId.get(id);
    const m = meta.get(id);
    if (p && m) ordered.push({ ...p, distance_m: m.distance_m, score: m.score });
  }
  return ordered;
}

/** Fetches a ranked AI recommendation feed (recommended / highly compatible / nearby). */
export async function fetchRecommended(
  kind: RecommendationKind = "recommended",
  limit = 30,
): Promise<ProfileWithPhotos[]> {
  const { data, error } = await supabase.rpc("recommended_matches", { _kind: kind, _limit: limit });
  if (error || !data) return [];
  return hydrateScored(data as { id: string; distance_m: number | null; score: number }[]);
}

/** Fetches the cached daily recommended matches (generated once per day). */
export async function fetchDailyRecommendations(limit = 12): Promise<ProfileWithPhotos[]> {
  const { data, error } = await supabase.rpc("get_daily_recommendations", { _limit: limit });
  if (error || !data) return [];
  return hydrateScored(data as { id: string; distance_m: number | null; score: number }[]);
}

/**
 * Records a member interaction signal (fire-and-forget). These power the ML
 * feedback loop and the recommendation performance analytics.
 */
export function logInteraction(
  signal: InteractionSignal,
  targetId?: string | null,
  context: Record<string, unknown> = {},
  weight = 1,
): void {
  void (async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    await supabase.from("interaction_events").insert({
      user_id: auth.user.id,
      target_id: targetId ?? null,
      signal_type: signal,
      weight,
      context: JSON.parse(JSON.stringify(context)) as Json,
    });
  })();
}

/**
 * Generates one or more conversation starters from a compatibility breakdown.
 * Uses shared interests and goals so suggestions feel personal without an
 * external model call.
 */
export function conversationStarters(breakdown: CompatBreakdown, name: string): string[] {
  const first = name?.split(" ")[0] || "there";
  const out: string[] = [];
  const interests = breakdown.shared_interests ?? [];
  if (interests.length >= 2) {
    out.push(
      `Hey ${first}! I see we're both into ${interests[0]} and ${interests[1]} - what got you started?`,
    );
  } else if (interests.length === 1) {
    out.push(`Hi ${first}! Fellow ${interests[0]} fan here - how often do you get to enjoy it?`);
  }
  if (breakdown.shared_goal) {
    out.push(
      `We seem to be looking for the same kind of connection - what does an ideal first date look like for you?`,
    );
  }
  out.push(
    `Hi ${first}! Your profile caught my eye - what's something you're excited about lately?`,
  );
  return out.slice(0, 3);
}
