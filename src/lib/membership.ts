import type { Database } from "@/integrations/supabase/types";

export type MembershipTier = Database["public"]["Enums"]["membership_tier"];
export type PublicMembershipTier = "free" | "gold" | "platinum";

export interface PlanFeature {
  label: string;
  free: boolean | string;
  gold: boolean | string;
  platinum: boolean | string;
}

export const FREE_DAILY_LIKE_LIMIT = 10;

export const TIER_LABELS: Record<MembershipTier, string> = {
  free: "Free",
  premium: "Gold",
  gold: "Gold",
  platinum: "Platinum",
};

export const TIER_RANK: Record<MembershipTier, number> = {
  free: 0,
  premium: 1,
  gold: 1,
  platinum: 2,
};

export const TIER_ORDER: PublicMembershipTier[] = ["free", "gold", "platinum"];

/** Fallback monthly price per tier (USD) used only before plans load from the DB. */
export const TIER_PRICE: Record<MembershipTier, number> = {
  free: 0,
  premium: 19.99,
  gold: 19.99,
  platinum: 34.99,
};

/** Display colors per tier, used across admin analytics and badges. */
export const TIER_COLORS: Record<MembershipTier, string> = {
  free: "hsl(220 9% 60%)",
  premium: "hsl(38 92% 50%)",
  gold: "hsl(38 92% 50%)",
  platinum: "hsl(262 83% 64%)",
};

export function normalizeMembershipTier(
  tier: MembershipTier | string | null | undefined,
): PublicMembershipTier {
  if (tier === "platinum") return "platinum";
  if (tier === "gold" || tier === "premium") return "gold";
  return "free";
}

export function tierAtLeast(
  tier: MembershipTier | null | undefined,
  min: PublicMembershipTier,
): boolean {
  return TIER_RANK[normalizeMembershipTier(tier)] >= TIER_RANK[min];
}

/** Capability flags derived from the public Free, Gold, and Platinum tiers. */
export function capabilities(tier: MembershipTier | null | undefined) {
  const gold = tierAtLeast(tier, "gold");
  const platinum = tierAtLeast(tier, "platinum");
  return {
    unlimitedLikes: gold,
    seeWhoLikedYou: gold,
    priorityPlacement: gold,
    unlimitedMessaging: gold,
    verificationBadge: platinum,
    advancedFilters: platinum,
    featuredProfile: platinum,
    readReceipts: platinum,
  };
}

export type Capability = keyof ReturnType<typeof capabilities>;

export function hasCapability(tier: MembershipTier | null | undefined, cap: Capability): boolean {
  return capabilities(tier)[cap];
}

const INTERVAL_SHORT: Record<string, string> = {
  day: "day",
  week: "week",
  month: "mo",
  quarter: "quarter",
  year: "yr",
};

export function formatPrice(cents: number, currency = "USD"): string {
  const amount = cents / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

export function formatCadence(billingInterval: string, intervalCount: number): string {
  const short = INTERVAL_SHORT[billingInterval] ?? billingInterval;
  if (intervalCount === 1)
    return billingInterval === "month" ? "per month" : `per ${billingInterval}`;
  return `every ${intervalCount} ${short}s`;
}

/** Static comparison table (4 tiers) shown on the plans page. */
export const COMPARISON: PlanFeature[] = [
  {
    label: "Create profile & upload photos",
    free: true,
    gold: true,
    platinum: true,
  },
  { label: "Browse & search profiles", free: true, gold: true, platinum: true },
  {
    label: "Daily likes",
    free: `${FREE_DAILY_LIKE_LIMIT}/day`,
    gold: "Unlimited",
    platinum: "Unlimited",
  },
  { label: "See who liked you", free: false, gold: true, platinum: true },
  { label: "Priority placement", free: false, gold: true, platinum: true },
  { label: "Unlimited messaging", free: false, gold: true, platinum: true },
  { label: "Verified badge", free: false, gold: false, platinum: true },
  { label: "Advanced search filters", free: false, gold: false, platinum: true },
  { label: "Featured profile", free: false, gold: false, platinum: true },
  { label: "Read receipts", free: false, gold: false, platinum: true },
];

export const INTEREST_OPTIONS = [
  "Travel",
  "Cooking",
  "Fitness",
  "Music",
  "Movies",
  "Reading",
  "Art",
  "Photography",
  "Hiking",
  "Gaming",
  "Coffee",
  "Wine",
  "Dancing",
  "Yoga",
  "Foodie",
  "Pets",
  "Fashion",
  "Tech",
  "Volunteering",
  "Live Music",
  "Camping",
  "Running",
  "Meditation",
  "Writing",
  "Theatre",
  "Football",
];
