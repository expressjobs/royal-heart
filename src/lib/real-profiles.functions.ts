import { createServerFn } from "@tanstack/react-start";
import type { User } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";
import { requireServerAdmin } from "@/lib/server-auth";
import { isAtLeast18, profileCompletion } from "@/lib/registration";
import { normalizeGender } from "@/lib/gender";
import { writeAdminAuditWarning } from "@/lib/admin-audit";

type MembershipTier = Database["public"]["Enums"]["membership_tier"];

interface RealProfileRow {
  id: string;
  display_name: string | null;
  username: string | null;
  membership_tier: MembershipTier;
  is_verified: boolean;
  email_verified: boolean;
  is_featured: boolean;
  location_city: string | null;
  location_country: string | null;
  location_state?: string | null;
  bio?: string | null;
  interests?: string[] | null;
  created_at: string;
  last_active: string;
  last_login_at: string | null;
  failed_login_attempts: number;
  account_locked_until: string | null;
  is_demo_profile: boolean;
  profile_source: string;
  is_discoverable: boolean;
  onboarding_complete: boolean;
  discovery_blocked_reason: string | null;
  profile_completion_status?: string | null;
  birth_date: string | null;
  gender: string | null;
  interested_in: string[] | null;
  relationship_goal: string | null;
  marriage_intention: string | null;
  marriage_timeline: string | null;
  wants_children: string | null;
  has_children: string | null;
  faith_or_values_importance: string | null;
  family_values: string | null;
  relocation_openness: string | null;
  communication_style: string | null;
  dealbreakers: string[];
  long_distance_openness: string | null;
  parenting_preferences: string | null;
  conflict_resolution_style: string | null;
  love_language: string | null;
  work_life_balance: string | null;
  education_importance: string | null;
  faith_importance: string | null;
  culture_background: string | null;
  personality_type: string | null;
  hobbies: string[];
  partner_expectations: string | null;
  future_plans: string | null;
  trust_score: number;
  trust_level: string;
  safety_agreement_accepted_at?: string | null;
  terms_accepted_at?: string | null;
  privacy_accepted_at?: string | null;
  suspicious_signup_reason?: string | null;
  incognito: boolean;
  is_active?: boolean;
  primary_photo: string | null;
  photo_count: number;
}

export type RealProfileStatus =
  | "complete"
  | "incomplete"
  | "not_discoverable"
  | "missing_required_fields";

export interface AdminRealUserRow extends RealProfileRow {
  auth_email: string | null;
  auth_display_name: string | null;
  auth_created_at: string;
  has_profile: boolean;
  missing_fields: string[];
  profile_status: RealProfileStatus;
  profile_completion_score: number;
}

export interface AdminRealProfileStats {
  totalRealUsers: number;
  missingProfileRows: number;
  incompleteProfiles: number;
  discoverableRealUsers: number;
  completeProfiles: number;
  notDiscoverableProfiles: number;
  eligibleButHiddenRealUsers: number;
}

export interface AdminRealUsersResult {
  rows: AdminRealUserRow[];
  stats: AdminRealProfileStats;
}

export interface AdminRealProfileRepairResult extends AdminRealUsersResult {
  before: AdminRealProfileStats;
  after: AdminRealProfileStats;
  created?: number;
  repaired?: number;
  skipped?: number;
  skippedRows?: AdminRealProfileBulkSkipped[];
  processed?: number;
  updated?: number;
  madeDiscoverable?: number;
  stillIncomplete?: number;
  failed?: number;
  failures?: AdminRealProfileBulkFailure[];
  blockedReasonCounts?: Record<string, number>;
  realUsersProcessed?: number;
  managedProfilesSkipped?: number;
  managedProfilesConverted?: number;
  stillBlockedByField?: Record<string, number>;
}

export interface AdminRealProfileRepairFailure {
  ok: false;
  error: string;
  dbError?: {
    message?: string;
    code?: string;
    details?: string;
    hint?: string;
  };
  stage: "load" | "update" | "audit" | "reload";
  file: string;
  rowId?: string;
  failingQuery?: string;
  attemptedColumns?: string[];
  repairedBeforeFailure?: number;
}

export interface AdminActionDatabaseError {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}

export interface AdminActionFailure {
  ok: false;
  error: string;
  stage: string;
  userId?: string;
  dbError?: AdminActionDatabaseError;
}

export type AdminRealProfileRepairResponse =
  | (AdminRealProfileRepairResult & { ok: true })
  | AdminRealProfileRepairFailure;

export type RealProfileBulkAction =
  | "make_discoverable"
  | "hide_from_discover"
  | "mark_active"
  | "mark_inactive"
  | "repair_system_fields"
  | "admin_assisted_complete"
  | "auto_complete_missing_required_fields"
  | "force_complete_profile"
  | "convert_placeholder_to_managed"
  | "accept_agreements";

export interface AdminAutoCompleteOptions {
  fillSafeFieldsOnly?: boolean;
  generateAge18Plus?: boolean;
  inferGender?: boolean;
  generateLocationFromAvailable?: boolean;
  acceptAgreements?: boolean;
  makeDiscoverableAfterCompletion?: boolean;
  dryRun?: boolean;
  overwriteInvalidOnly?: boolean;
  confirmManagedProfileConversion?: boolean;
  defaultCity?: string;
  defaultCountry?: string;
  defaultGenderFallback?: string;
  defaultInterestedInFallback?: string;
  generateAdultAge?: number;
}

export interface AdminRealProfileBulkSkipped {
  id: string;
  name: string | null;
  reason: string;
  remainingFields?: string[];
}

export type RealProfileRepairStage =
  | "auto_complete_safe_fields"
  | "accept_agreements"
  | "auto_complete_missing_required_fields"
  | "recalculate_profile_completion"
  | "recalculate_trust_score"
  | "recalculate_discoverability"
  | "make_discoverable";

export interface AdminRealProfileBulkFailure {
  id: string;
  name: string | null;
  stage: string;
  query: string;
  error: string;
  dbError: AdminActionDatabaseError;
}

export interface AdminRealProfileBulkResult extends AdminRealUsersResult {
  ok: true;
  action: RealProfileBulkAction | "make_all_eligible_discoverable";
  updated: number;
  skipped: number;
  skippedRows: AdminRealProfileBulkSkipped[];
  processed?: number;
  madeDiscoverable?: number;
  stillIncomplete?: number;
  failed?: number;
  failures?: AdminRealProfileBulkFailure[];
  blockedReasonCounts?: Record<string, number>;
  selectedIds?: string[];
  stillMissingAgeGender?: number;
  nowDiscoverable?: number;
  notDiscoverable?: number;
  auditWarning?: string;
  realUsersProcessed?: number;
  managedProfilesSkipped?: number;
  managedProfilesConverted?: number;
  stillBlockedByField?: Record<string, number>;
}

export interface AdminFullProfileEditorData {
  profile: {
    id: string;
    display_name: string | null;
    username: string | null;
    birth_date: string | null;
    gender: string | null;
    interested_in: string[];
    relationship_goal: string | null;
    marriage_intention: string | null;
    marriage_timeline: string | null;
    wants_children: string | null;
    has_children: string | null;
    faith_or_values_importance: string | null;
    family_values: string | null;
    relocation_openness: string | null;
    communication_style: string | null;
    dealbreakers: string[];
    long_distance_openness: string | null;
    parenting_preferences: string | null;
    conflict_resolution_style: string | null;
    love_language: string | null;
    work_life_balance: string | null;
    education_importance: string | null;
    faith_importance: string | null;
    culture_background: string | null;
    personality_type: string | null;
    hobbies: string[];
    partner_expectations: string | null;
    future_plans: string | null;
    trust_score: number;
    trust_level: string;
    location_city: string | null;
    location_country: string | null;
    location_state: string | null;
    bio: string | null;
    interests: string[];
    profession: string | null;
    education: string | null;
    is_verified: boolean;
    membership_tier: MembershipTier;
    is_active: boolean;
    is_discoverable: boolean;
    is_featured: boolean;
    profile_completion_status: RealProfileStatus;
    safety_agreement_accepted_at: string | null;
    terms_accepted_at: string | null;
    privacy_accepted_at: string | null;
    profile_completion_score: number;
    photo_count: number;
    missing_fields: string[];
  };
}

export type AdminFullProfileEditorLoadResult =
  | (AdminFullProfileEditorData & { ok: true })
  | AdminActionFailure;

export interface AdminFullProfileSaveInput {
  userId: string;
  profile: AdminFullProfileEditorData["profile"];
}

export type AdminFullProfileSaveResult =
  | (AdminFullProfileEditorData & {
      ok: true;
      rows: AdminRealUserRow[];
      stats: AdminRealProfileStats;
    })
  | {
      ok: false;
      error: string;
      dbError?: { message?: string; code?: string; details?: string; hint?: string };
      missingFields?: string[];
    };

export interface AdminProfileAuditHistoryRow {
  id: string;
  actor_id?: string | null;
  action: string;
  entity_id: string | null;
  details: Json;
  created_at: string;
}

const PROFILE_SELECT = [
  "id",
  "display_name",
  "username",
  "membership_tier",
  "is_verified",
  "email_verified",
  "is_featured",
  "location_city",
  "location_country",
  "location_state",
  "bio",
  "interests",
  "created_at",
  "last_active",
  "last_login_at",
  "failed_login_attempts",
  "account_locked_until",
  "is_demo_profile",
  "profile_source",
  "is_discoverable",
  "onboarding_complete",
  "discovery_blocked_reason",
  "profile_completion_status",
  "birth_date",
  "gender",
  "interested_in",
  "relationship_goal",
  "marriage_intention",
  "marriage_timeline",
  "wants_children",
  "has_children",
  "faith_or_values_importance",
  "family_values",
  "relocation_openness",
  "communication_style",
  "dealbreakers",
  "long_distance_openness",
  "parenting_preferences",
  "conflict_resolution_style",
  "love_language",
  "work_life_balance",
  "education_importance",
  "faith_importance",
  "culture_background",
  "personality_type",
  "hobbies",
  "partner_expectations",
  "future_plans",
  "trust_score",
  "trust_level",
  "safety_agreement_accepted_at",
  "terms_accepted_at",
  "privacy_accepted_at",
  "suspicious_signup_reason",
  "incognito",
  "is_active",
].join(", ");

const REPAIR_PROFILE_UPDATE_COLUMNS = [
  "is_active",
  "is_discoverable",
  "onboarding_complete",
  "discovery_blocked_reason",
  "profile_completion_status",
  "profile_completion_score",
  "updated_at",
  "display_name",
  "username",
  "safety_agreement_accepted_at",
  "terms_accepted_at",
  "privacy_accepted_at",
  "relationship_goal",
  "location_city",
  "location_country",
  "bio",
  "interests",
] as const;

const REAL_PROFILE_FUNCTION_FILE = "src/lib/real-profiles.functions.ts";
const PROFILE_COMPLETION_STATUSES: RealProfileStatus[] = [
  "complete",
  "incomplete",
  "not_discoverable",
  "missing_required_fields",
];

function supabaseErrorDetails(error: unknown) {
  if (!error || typeof error !== "object") return { message: String(error) };
  const maybe = error as { message?: string; code?: string; details?: string; hint?: string };
  return {
    message: maybe.message,
    code: maybe.code,
    details: maybe.details,
    hint: maybe.hint,
  };
}

function adminActionFailure(input: {
  error: unknown;
  stage: string;
  userId?: string;
  fallback?: string;
}): AdminActionFailure {
  const dbError = supabaseErrorDetails(input.error);
  return {
    ok: false,
    error: dbError.message ?? input.fallback ?? "Admin action failed.",
    stage: input.stage,
    userId: input.userId,
    dbError,
  };
}

function repairFailure(input: {
  error: unknown;
  stage: AdminRealProfileRepairFailure["stage"];
  rowId?: string;
  failingQuery?: string;
  repairedBeforeFailure?: number;
}): AdminRealProfileRepairFailure {
  const dbError = supabaseErrorDetails(input.error);
  return {
    ok: false,
    error: dbError.message ?? "Real profile repair failed.",
    dbError,
    stage: input.stage,
    file: REAL_PROFILE_FUNCTION_FILE,
    rowId: input.rowId,
    failingQuery: input.failingQuery,
    attemptedColumns: [...REPAIR_PROFILE_UPDATE_COLUMNS],
    repairedBeforeFailure: input.repairedBeforeFailure,
  };
}

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function cleanText(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanNullableText(value: unknown, max = 500) {
  const text = cleanText(value, max);
  return text || null;
}

function cleanStringArray(value: unknown, max = 20) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanText(item, 80))
    .filter(Boolean)
    .slice(0, max);
}

function cleanMembershipTier(value: unknown): MembershipTier {
  return value === "gold" || value === "platinum" ? value : "free";
}

function cleanProfileStatus(value: unknown): RealProfileStatus {
  return PROFILE_COMPLETION_STATUSES.includes(value as RealProfileStatus)
    ? (value as RealProfileStatus)
    : "incomplete";
}

function cleanDate(value: unknown) {
  const text = cleanText(value, 20);
  return text && /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function cleanTimestamp(value: unknown) {
  if (!value) return null;
  const text = cleanText(value, 40);
  const time = Date.parse(text);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function normalizeFullProfileInput(data: AdminFullProfileSaveInput): AdminFullProfileSaveInput {
  if (!data || typeof data.userId !== "string" || !data.userId) {
    throw new Error("Choose a member profile.");
  }
  const profile = data.profile ?? ({} as AdminFullProfileEditorData["profile"]);
  return {
    userId: data.userId,
    profile: {
      id: data.userId,
      display_name: cleanNullableText(profile.display_name, 80),
      username: cleanNullableText(profile.username, 32),
      birth_date: cleanDate(profile.birth_date),
      gender: normalizeGender(profile.gender),
      interested_in: cleanStringArray(profile.interested_in, 6),
      relationship_goal: cleanNullableText(profile.relationship_goal, 80),
      marriage_intention: cleanNullableText(profile.marriage_intention, 40),
      marriage_timeline: cleanNullableText(profile.marriage_timeline, 40),
      wants_children: cleanNullableText(profile.wants_children, 20),
      has_children: cleanNullableText(profile.has_children, 30),
      faith_or_values_importance: cleanNullableText(profile.faith_or_values_importance, 30),
      family_values: cleanNullableText(profile.family_values, 40),
      relocation_openness: cleanNullableText(profile.relocation_openness, 20),
      communication_style: cleanNullableText(profile.communication_style, 30),
      dealbreakers: cleanStringArray(profile.dealbreakers, 10),
      long_distance_openness: cleanNullableText(profile.long_distance_openness, 20),
      parenting_preferences: cleanNullableText(profile.parenting_preferences, 300),
      conflict_resolution_style: cleanNullableText(profile.conflict_resolution_style, 40),
      love_language: cleanNullableText(profile.love_language, 40),
      work_life_balance: cleanNullableText(profile.work_life_balance, 40),
      education_importance: cleanNullableText(profile.education_importance, 40),
      faith_importance: cleanNullableText(profile.faith_importance, 40),
      culture_background: cleanNullableText(profile.culture_background, 40),
      personality_type: cleanNullableText(profile.personality_type, 40),
      hobbies: cleanStringArray(profile.hobbies, 10),
      partner_expectations: cleanNullableText(profile.partner_expectations, 40),
      future_plans: cleanNullableText(profile.future_plans, 40),
      trust_score: Number(profile.trust_score) || 0,
      trust_level: cleanNullableText(profile.trust_level, 20) ?? "low",
      location_city: cleanNullableText(profile.location_city, 120),
      location_country: cleanNullableText(profile.location_country, 120),
      location_state: cleanNullableText(profile.location_state, 120),
      bio: cleanNullableText(profile.bio, 1000),
      interests: cleanStringArray(profile.interests, 20),
      profession: cleanNullableText(profile.profession, 120),
      education: cleanNullableText(profile.education, 120),
      is_verified: Boolean(profile.is_verified),
      membership_tier: cleanMembershipTier(profile.membership_tier),
      is_active: Boolean(profile.is_active),
      is_discoverable: Boolean(profile.is_discoverable),
      is_featured: Boolean(profile.is_featured),
      profile_completion_status: cleanProfileStatus(profile.profile_completion_status),
      safety_agreement_accepted_at: cleanTimestamp(profile.safety_agreement_accepted_at),
      terms_accepted_at: cleanTimestamp(profile.terms_accepted_at),
      privacy_accepted_at: cleanTimestamp(profile.privacy_accepted_at),
      profile_completion_score: 0,
      photo_count: 0,
      missing_fields: [],
    },
  };
}

function photoPath(photo: { storage_path: string | null; url: string | null } | null | undefined) {
  return photo?.storage_path || photo?.url || null;
}

function metadataName(user: User): string | null {
  const meta = user.user_metadata ?? {};
  const raw =
    typeof meta.display_name === "string"
      ? meta.display_name
      : typeof meta.full_name === "string"
        ? meta.full_name
        : typeof meta.name === "string"
          ? meta.name
          : null;
  const name = raw?.trim();
  return name && name.length >= 2 ? name.slice(0, 80) : null;
}

function missingFields(profile: RealProfileRow | null): string[] {
  if (!profile) return ["Profile row"];
  const missing: string[] = [];
  if (!profile.display_name || profile.display_name.trim().length < 2) missing.push("Name");
  if (!profile.birth_date || !isAtLeast18(profile.birth_date)) missing.push("Age 18+");
  if (!profile.gender) missing.push("Gender");
  if (!profile.interested_in?.length) missing.push("Interested in");
  if (!profile.relationship_goal) missing.push("Relationship goal");
  if (!profile.location_city || !profile.location_country) missing.push("City and country");
  if (!profile.safety_agreement_accepted_at) missing.push("Safety agreement");
  if (!profile.terms_accepted_at || !profile.privacy_accepted_at) missing.push("Terms and privacy");
  return missing;
}

function isDiscoverable(profile: RealProfileRow | null, missing: string[]) {
  if (!profile || missing.length > 0) return false;
  return (
    profile.is_active !== false &&
    profile.is_demo_profile === false &&
    profile.is_discoverable === true &&
    profile.onboarding_complete === true &&
    profile.incognito === false &&
    !profile.discovery_blocked_reason &&
    !profile.suspicious_signup_reason
  );
}

function isSuspended(
  moderation: { is_banned: boolean | null; banned_until: string | null } | undefined,
) {
  if (!moderation?.is_banned) return false;
  if (!moderation.banned_until) return true;
  return new Date(moderation.banned_until).getTime() > Date.now();
}

function discoverabilityBlockers(
  profile: RealProfileRow | null,
  moderation?: { is_banned: boolean | null; banned_until: string | null },
) {
  if (!profile) {
    return [{ field: "profiles.id", reason: "profile row is missing" }];
  }

  const blockers: Array<{ field: string; reason: string }> = [];
  if (
    isPlaceholderUuid(profile.id) &&
    profile.profile_source !== "managed_profile" &&
    profile.profile_source !== "admin_created"
  ) {
    blockers.push({ field: "profiles.id", reason: "placeholder UUID was ignored" });
  }
  if (profile.is_demo_profile !== false) {
    blockers.push({ field: "profiles.is_demo_profile", reason: "profile is marked as demo" });
  }
  if (profile.is_active !== true) {
    blockers.push({ field: "profiles.is_active", reason: "profile is inactive" });
  }
  if (profile.is_discoverable !== true) {
    blockers.push({ field: "profiles.is_discoverable", reason: "discover opt-in is not true" });
  }
  if (profile.onboarding_complete !== true) {
    blockers.push({
      field: "profiles.onboarding_complete",
      reason: "onboarding completion flag is not true",
    });
  }
  if (profile.incognito !== false) {
    blockers.push({ field: "profiles.incognito", reason: "profile is incognito" });
  }
  if (profile.discovery_blocked_reason) {
    blockers.push({
      field: "profiles.discovery_blocked_reason",
      reason: profile.discovery_blocked_reason,
    });
  }
  if (profile.suspicious_signup_reason) {
    blockers.push({
      field: "profiles.suspicious_signup_reason",
      reason: profile.suspicious_signup_reason,
    });
  }
  if (!profile.display_name || profile.display_name.trim().length < 2) {
    blockers.push({ field: "profiles.display_name", reason: "display name is missing" });
  }
  if (!profile.birth_date || !isAtLeast18(profile.birth_date)) {
    blockers.push({ field: "profiles.birth_date", reason: "adult birth date is missing" });
  }
  if (!profile.gender) {
    blockers.push({ field: "profiles.gender", reason: "gender is missing" });
  }
  if (!profile.interested_in?.length) {
    blockers.push({ field: "profiles.interested_in", reason: "dating preference is missing" });
  }
  if (!profile.relationship_goal) {
    blockers.push({
      field: "profiles.relationship_goal",
      reason: "relationship goal is missing",
    });
  }
  if (!profile.location_city) {
    blockers.push({ field: "profiles.location_city", reason: "city is missing" });
  }
  if (!profile.location_country) {
    blockers.push({ field: "profiles.location_country", reason: "country is missing" });
  }
  if (!profile.safety_agreement_accepted_at) {
    blockers.push({
      field: "profiles.safety_agreement_accepted_at",
      reason: "safety agreement is missing",
    });
  }
  if (!profile.terms_accepted_at) {
    blockers.push({
      field: "profiles.terms_accepted_at",
      reason: "terms acceptance is missing",
    });
  }
  if (!profile.privacy_accepted_at) {
    blockers.push({
      field: "profiles.privacy_accepted_at",
      reason: "privacy acceptance is missing",
    });
  }
  if (isSuspended(moderation)) {
    blockers.push({
      field: "user_moderation.is_banned",
      reason: "user is banned or suspended",
    });
  }
  return blockers;
}

function requiredFieldReason(row: AdminRealUserRow) {
  if (!row.has_profile) return "profile row is missing";
  if (row.missing_fields.length > 0) {
    return `required fields are missing: ${row.missing_fields.join(", ")}`;
  }
  return null;
}

function safeDisplayNameFor(row: AdminRealUserRow) {
  const fallback = row.auth_display_name?.trim();
  if (row.display_name?.trim()) return null;
  return fallback && fallback.length >= 2 ? fallback.slice(0, 80) : null;
}

function forceDisplayNameFor(row: AdminRealUserRow) {
  if (row.display_name?.trim() && row.display_name.trim().length >= 2) return null;
  const candidates = [
    row.auth_display_name,
    row.username,
    row.auth_email?.split("@")[0],
    "HeartConnect Member",
  ];
  const fallback = candidates
    .map((candidate) =>
      candidate
        ?.trim()
        .replace(/[._-]+/g, " ")
        .replace(/\s+/g, " "),
    )
    .find((candidate) => candidate && candidate.length >= 2);
  return fallback?.slice(0, 80) ?? "HeartConnect Member";
}

function safeUsernameFor(row: AdminRealUserRow) {
  if (row.username?.trim()) return null;
  const emailLocal = row.auth_email?.split("@")[0]?.trim().toLowerCase();
  if (!emailLocal) return null;
  const username = emailLocal
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return username.length >= 3 ? username.slice(0, 32) : null;
}

const SAFE_GENERIC_BIO = "I'm here to meet someone genuine and build a meaningful connection.";
const SAFE_GENERIC_INTERESTS = ["family", "travel", "music", "faith", "fitness", "cooking"];
const DEFAULT_FORCE_COMPLETE_CITY = "Nairobi";
const DEFAULT_FORCE_COMPLETE_COUNTRY = "Kenya";
const DEFAULT_FORCE_COMPLETE_GENDER = "nonbinary";
const DEFAULT_FORCE_COMPLETE_INTERESTED_IN = "everyone";
const VALID_INTERESTED_IN = new Set(["women", "men", "nonbinary", "everyone"]);
const SERIOUS_RELATIONSHIP_ENUMS = {
  communication_style: {
    allowed: ["direct", "reflective", "expressive", "calm"],
    fallback: "direct",
  },
  conflict_resolution_style: {
    allowed: ["talk_it_through", "pause_then_discuss", "mediated", "solution_focused"],
    fallback: "pause_then_discuss",
  },
  love_language: {
    allowed: ["quality_time", "words", "acts", "gifts", "touch"],
    fallback: "quality_time",
  },
  work_life_balance: {
    allowed: ["career_focused", "balanced", "family_first", "flexible"],
    fallback: "balanced",
  },
  education_importance: {
    allowed: ["essential", "important", "flexible", "not_important"],
    fallback: "important",
  },
  marriage_intention: {
    allowed: ["marriage", "lifelong_partnership", "open_to_marriage"],
    fallback: "open_to_marriage",
  },
  marriage_timeline: {
    allowed: ["within_1_year", "1_to_2_years", "3_to_5_years", "when_right"],
    fallback: "when_right",
  },
  wants_children: { allowed: ["yes", "no", "open"], fallback: "open" },
  has_children: {
    allowed: ["no", "yes_at_home", "yes_not_at_home"],
    fallback: "no",
  },
  faith_or_values_importance: {
    allowed: ["essential", "important", "somewhat", "not_important"],
    fallback: "important",
  },
  family_values: {
    allowed: ["traditional", "balanced", "independent", "community_centered"],
    fallback: "balanced",
  },
  relocation_openness: { allowed: ["yes", "maybe", "no"], fallback: "maybe" },
  long_distance_openness: { allowed: ["yes", "maybe", "no"], fallback: "maybe" },
  faith_importance: {
    allowed: ["essential", "important", "somewhat", "not_important"],
    fallback: "somewhat",
  },
  culture_background: {
    allowed: [
      "african",
      "diaspora",
      "multicultural",
      "western",
      "asian",
      "middle_eastern",
      "latin",
      "prefer_not",
    ],
    fallback: "multicultural",
  },
  personality_type: {
    allowed: ["introvert", "ambivert", "extrovert", "analytical", "empathetic", "adventurous"],
    fallback: "ambivert",
  },
  partner_expectations: {
    allowed: [
      "intentional_courtship",
      "shared_values",
      "family_alignment",
      "emotional_maturity",
      "financial_responsibility",
    ],
    fallback: "shared_values",
  },
  future_plans: {
    allowed: [
      "build_family",
      "career_and_family",
      "travel_together",
      "settle_locally",
      "open_to_paths",
    ],
    fallback: "open_to_paths",
  },
} as const;
const PLACEHOLDER_UUID_RE = /^00000000-0000-(?:0000|4000)-8000-[0-9a-f]{12}$/i;
const COMMON_WOMAN_NAMES = new Set([
  "amanda",
  "ann",
  "anna",
  "annette",
  "ashley",
  "betty",
  "brenda",
  "carol",
  "caroline",
  "cynthia",
  "deborah",
  "diana",
  "donna",
  "elizabeth",
  "emily",
  "esther",
  "eunice",
  "faith",
  "grace",
  "jane",
  "janet",
  "jennifer",
  "jessica",
  "joy",
  "karen",
  "kimberly",
  "laura",
  "linda",
  "lisa",
  "lucy",
  "lydia",
  "margaret",
  "mary",
  "melissa",
  "mercy",
  "michelle",
  "miriam",
  "nancy",
  "patricia",
  "rebecca",
  "rose",
  "ruth",
  "sandra",
  "sarah",
  "sharon",
  "stephanie",
  "susan",
  "vivian",
]);
const COMMON_MAN_NAMES = new Set([
  "andrew",
  "anthony",
  "brian",
  "charles",
  "christopher",
  "dan",
  "daniel",
  "david",
  "dennis",
  "donald",
  "edward",
  "eric",
  "evans",
  "felix",
  "francis",
  "geoffrey",
  "george",
  "isaac",
  "jacob",
  "james",
  "jason",
  "jeffrey",
  "john",
  "joseph",
  "joshua",
  "kevin",
  "kenneth",
  "mark",
  "martin",
  "matthew",
  "michael",
  "moses",
  "patrick",
  "paul",
  "peter",
  "richard",
  "robert",
  "ronald",
  "ryan",
  "samson",
  "samuel",
  "simon",
  "steven",
  "thomas",
  "timothy",
  "vincent",
  "william",
]);

function parseLocationText(row: AdminRealUserRow) {
  const text = row.location_state?.trim();
  if (!text) {
    return {};
  }
  const parts = text
    .split(/[,|/-]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) {
    const compactParts = text.split(/\s+/).filter(Boolean);
    if (compactParts.length < 2) return {};
    return {
      location_city: row.location_city ?? compactParts.slice(0, -1).join(" "),
      location_country: row.location_country ?? compactParts[compactParts.length - 1],
    };
  }
  return {
    location_city: row.location_city ?? parts[0],
    location_country: row.location_country ?? parts[parts.length - 1],
  };
}

function cleanFallbackText(value: unknown, fallback: string, maxLength = 120) {
  if (typeof value !== "string") return fallback;
  const cleaned = value.trim().replace(/\s+/g, " ");
  return cleaned ? cleaned.slice(0, maxLength) : fallback;
}

export function normalizeGeneratedSeriousRelationshipValues(generated: Record<string, unknown>) {
  const normalized = { ...generated };
  for (const [field, config] of Object.entries(SERIOUS_RELATIONSHIP_ENUMS)) {
    if (!(field in normalized)) continue;
    const value = normalized[field];
    if (typeof value !== "string" || !(config.allowed as readonly string[]).includes(value)) {
      normalized[field] = config.fallback;
    }
  }
  return normalized;
}

function forceCompleteDefaults(options?: AdminAutoCompleteOptions) {
  const requestedAge = Number(options?.generateAdultAge);
  const defaultInterestedIn =
    typeof options?.defaultInterestedInFallback === "string" &&
    VALID_INTERESTED_IN.has(options.defaultInterestedInFallback)
      ? options.defaultInterestedInFallback
      : DEFAULT_FORCE_COMPLETE_INTERESTED_IN;

  return {
    defaultCity: cleanFallbackText(options?.defaultCity, DEFAULT_FORCE_COMPLETE_CITY),
    defaultCountry: cleanFallbackText(options?.defaultCountry, DEFAULT_FORCE_COMPLETE_COUNTRY),
    defaultGenderFallback:
      normalizeGender(options?.defaultGenderFallback) ?? DEFAULT_FORCE_COMPLETE_GENDER,
    defaultInterestedInFallback: defaultInterestedIn,
    generateAdultAge: Number.isFinite(requestedAge)
      ? Math.min(60, Math.max(18, Math.round(requestedAge)))
      : 30,
    acceptAgreements: options?.acceptAgreements !== false,
    makeDiscoverableAfterCompletion: options?.makeDiscoverableAfterCompletion !== false,
  };
}

function isPlaceholderUuid(id: string) {
  return PLACEHOLDER_UUID_RE.test(id);
}

async function usernameIsAvailable(
  supabaseAdmin: Awaited<ReturnType<typeof assertAdmin>>,
  userId: string,
  username: string,
) {
  const { count, error } = await supabaseAdmin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .ilike("username", username)
    .neq("id", userId);
  if (error) throw error;
  return (count ?? 0) === 0;
}

function remainingMissingFieldsAfterSafeRepair(row: AdminRealUserRow) {
  const safeDisplayName = safeDisplayNameFor(row);
  return row.missing_fields.filter((field) => field !== "Name" || !safeDisplayName);
}

function discoverEligibilitySkipReason(
  row: AdminRealUserRow,
  moderation: { is_banned: boolean | null; banned_until: string | null } | undefined,
) {
  const required = requiredFieldReason(row);
  if (required) return required;
  if (row.is_demo_profile) return "profile is marked as demo";
  if (row.is_active === false) return "profile is inactive";
  if (row.incognito) return "profile is incognito";
  if (row.suspicious_signup_reason) return row.suspicious_signup_reason;
  if (isSuspended(moderation)) return "user is banned or suspended";
  return null;
}

function repairSkipReason(
  row: AdminRealUserRow,
  moderation: { is_banned: boolean | null; banned_until: string | null } | undefined,
) {
  if (!row.has_profile) return "profile row is missing";
  const remainingMissing = remainingMissingFieldsAfterSafeRepair(row);
  if (remainingMissing.length > 0)
    return `required fields are missing: ${remainingMissing.join(", ")}`;
  if (row.is_demo_profile) return "profile is marked as demo";
  if (row.incognito) return "profile is incognito";
  if (row.suspicious_signup_reason) return row.suspicious_signup_reason;
  if (isSuspended(moderation)) return "user is banned or suspended";
  return null;
}

function repairSystemPatchFor(row: AdminRealUserRow, updatedAt: string) {
  const patch: Record<string, unknown> = {
    is_active: true,
    is_discoverable: true,
    profile_completion_status: "complete",
    updated_at: updatedAt,
  };
  const safeDisplayName = safeDisplayNameFor(row);
  if (safeDisplayName) patch.display_name = safeDisplayName;
  return patch;
}

function profileCompletionPatch(
  row: AdminRealUserRow,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const projected = {
    ...row,
    ...patch,
  } as AdminRealUserRow;
  const missing = missingFields(projected);
  const canDiscover = missing.length === 0 && projected.is_active !== false;
  return {
    ...patch,
    is_discoverable: canDiscover,
    onboarding_complete: canDiscover,
    discovery_blocked_reason: canDiscover ? null : "Required fields are missing",
    profile_completion_status: canDiscover ? "complete" : "missing_required_fields",
    profile_completion_score: profileCompletion({
      display_name: projected.display_name,
      birth_date: projected.birth_date,
      gender: projected.gender,
      interested_in: projected.interested_in,
      relationship_goal: projected.relationship_goal,
      location_city: projected.location_city,
      location_country: projected.location_country,
      safety_agreement_accepted_at: projected.safety_agreement_accepted_at,
      terms_accepted_at: projected.terms_accepted_at,
      privacy_accepted_at: projected.privacy_accepted_at,
      photoCount: projected.photo_count,
      bio: projected.bio,
      interests: projected.interests,
    }),
  };
}

function acceptAgreementsPatchFor(row: AdminRealUserRow, updatedAt: string) {
  const patch: Record<string, unknown> = { updated_at: updatedAt };
  if (!row.safety_agreement_accepted_at) patch.safety_agreement_accepted_at = updatedAt;
  if (!row.terms_accepted_at) patch.terms_accepted_at = updatedAt;
  if (!row.privacy_accepted_at) patch.privacy_accepted_at = updatedAt;
  return Object.keys(patch).length > 1 ? profileCompletionPatch(row, patch) : null;
}

function agreementFieldsPatchFor(row: AdminRealUserRow, updatedAt: string) {
  const patch: Record<string, unknown> = { updated_at: updatedAt };
  if (!row.safety_agreement_accepted_at) patch.safety_agreement_accepted_at = updatedAt;
  if (!row.terms_accepted_at) patch.terms_accepted_at = updatedAt;
  if (!row.privacy_accepted_at) patch.privacy_accepted_at = updatedAt;
  return patch;
}

function adminAssistedCompletionPatchFor(row: AdminRealUserRow, updatedAt: string) {
  const patch: Record<string, unknown> = {
    is_active: true,
    updated_at: updatedAt,
  };
  if (!row.safety_agreement_accepted_at) patch.safety_agreement_accepted_at = updatedAt;
  if (!row.terms_accepted_at) patch.terms_accepted_at = updatedAt;
  if (!row.privacy_accepted_at) patch.privacy_accepted_at = updatedAt;
  if (!row.relationship_goal) patch.relationship_goal = "serious_relationship";
  if (!row.bio?.trim()) patch.bio = SAFE_GENERIC_BIO;
  if (!row.interests?.length) patch.interests = SAFE_GENERIC_INTERESTS;
  const locationPatch = parseLocationText(row);
  if (!row.location_city && locationPatch.location_city) {
    patch.location_city = locationPatch.location_city;
  }
  if (!row.location_country && locationPatch.location_country) {
    patch.location_country = locationPatch.location_country;
  }
  return profileCompletionPatch(row, patch);
}

function safeFieldsPatchFor(row: AdminRealUserRow, updatedAt: string) {
  const patch: Record<string, unknown> = {
    is_active: true,
    updated_at: updatedAt,
  };
  const safeDisplayName = safeDisplayNameFor(row);
  if (safeDisplayName) patch.display_name = safeDisplayName;
  if (!row.relationship_goal) patch.relationship_goal = "serious_relationship";
  if (!row.bio?.trim()) patch.bio = SAFE_GENERIC_BIO;
  if (!row.interests?.length) patch.interests = SAFE_GENERIC_INTERESTS;
  const locationPatch = parseLocationText(row);
  if (!row.location_city && locationPatch.location_city) {
    patch.location_city = locationPatch.location_city;
  }
  if (!row.location_country && locationPatch.location_country) {
    patch.location_country = locationPatch.location_country;
  }
  return patch;
}

function generatedAdultBirthDate(userId = "", preferredAge?: number) {
  const seed = Array.from(userId).reduce((total, char) => total + char.charCodeAt(0), 0);
  const age =
    typeof preferredAge === "number" && Number.isFinite(preferredAge)
      ? Math.min(60, Math.max(18, Math.round(preferredAge)))
      : 18 + (seed % 43);
  const date = new Date();
  date.setFullYear(date.getFullYear() - age);
  date.setMonth(seed % 12, (seed % 27) + 1);
  return date.toISOString().slice(0, 10);
}

function interestedInFor(row: AdminRealUserRow, fallback = DEFAULT_FORCE_COMPLETE_INTERESTED_IN) {
  if (row.interested_in?.some((value) => VALID_INTERESTED_IN.has(value))) return null;
  if (VALID_INTERESTED_IN.has(fallback)) return [fallback];
  const gender = normalizeGender(row.gender);
  if (gender === "woman") return ["men"];
  if (gender === "man") return ["women"];
  return ["everyone"];
}

function inferGenderFor(row: AdminRealUserRow, fallback?: string) {
  if (row.gender) return null;
  const profileText = [row.bio, row.auth_display_name, row.display_name]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (/\b(woman|female|she\/her|mother|mum|mom)\b/.test(profileText)) return "woman";
  if (/\b(man|male|he\/him|father|dad)\b/.test(profileText)) return "man";
  if (/\b(nonbinary|non-binary|they\/them)\b/.test(profileText)) return "nonbinary";
  const firstName = [
    row.display_name,
    row.auth_display_name,
    row.username,
    row.auth_email?.split("@")[0],
  ]
    .filter(Boolean)
    .map(
      (value) =>
        value
          ?.trim()
          .toLowerCase()
          .split(/[\s._-]+/)[0],
    )
    .find(Boolean);
  if (firstName && COMMON_WOMAN_NAMES.has(firstName)) return "woman";
  if (firstName && COMMON_MAN_NAMES.has(firstName)) return "man";
  return normalizeGender(fallback);
}

function autoCompleteMissingRequiredPatchFor(
  row: AdminRealUserRow,
  updatedAt: string,
  options: AdminAutoCompleteOptions,
) {
  const patch = safeFieldsPatchFor(row, updatedAt);
  if (!options.generateLocationFromAvailable) {
    delete patch.location_city;
    delete patch.location_country;
  }
  const interestedIn = interestedInFor(row, options.defaultInterestedInFallback);
  if (interestedIn) patch.interested_in = interestedIn;
  if (options.acceptAgreements) {
    Object.assign(patch, agreementFieldsPatchFor(row, updatedAt));
  }
  if (options.generateAge18Plus && (!row.birth_date || !isAtLeast18(row.birth_date))) {
    patch.birth_date = generatedAdultBirthDate(row.id, options.generateAdultAge);
  }
  const inferredGender = options.inferGender
    ? inferGenderFor(row, options.defaultGenderFallback)
    : null;
  if (inferredGender) patch.gender = inferredGender;
  return patch;
}

function auditFieldRowsForPatch(input: {
  actorId: string;
  row: AdminRealUserRow;
  patch: Record<string, unknown>;
  reason: string;
  timestamp: string;
}) {
  return Object.entries(input.patch)
    .filter(
      ([field, value]) =>
        field !== "updated_at" && (input.row as never as Record<string, unknown>)[field] !== value,
    )
    .map(([field, value]) => ({
      action: "profile.admin_auto_complete_field",
      entityType: "profile",
      entityId: input.row.id,
      actorId: input.actorId,
      details: {
        admin_id: input.actorId,
        user_id: input.row.id,
        field,
        old_value: (input.row as never as Record<string, unknown>)[field] ?? null,
        new_value: value,
        reason: input.reason,
        timestamp: input.timestamp,
      },
    }));
}

function forceCompleteProfilePatchFor(
  row: AdminRealUserRow,
  updatedAt: string,
  options?: AdminAutoCompleteOptions,
) {
  const defaults = forceCompleteDefaults(options);
  const patch = autoCompleteMissingRequiredPatchFor(row, updatedAt, {
    generateAge18Plus: options?.generateAge18Plus === true,
    inferGender: options?.inferGender === true,
    generateLocationFromAvailable: true,
    acceptAgreements: defaults.acceptAgreements,
    makeDiscoverableAfterCompletion: defaults.makeDiscoverableAfterCompletion,
    defaultGenderFallback: defaults.defaultGenderFallback,
    defaultInterestedInFallback: defaults.defaultInterestedInFallback,
    generateAdultAge: defaults.generateAdultAge,
  });
  const displayName = forceDisplayNameFor(row);
  if (displayName) patch.display_name = displayName;
  if (!row.location_city) patch.location_city = defaults.defaultCity;
  if (!row.location_country) patch.location_country = defaults.defaultCountry;
  if (options?.generateAge18Plus === true && (!row.birth_date || !isAtLeast18(row.birth_date))) {
    patch.birth_date = generatedAdultBirthDate(row.id, defaults.generateAdultAge);
  }
  if (options?.inferGender === true && !row.gender) {
    patch.gender = defaults.defaultGenderFallback;
  }
  if (!row.interested_in?.some((value) => VALID_INTERESTED_IN.has(value))) {
    const projectedWithGender = projectRow(row, patch);
    patch.interested_in = interestedInFor(
      projectedWithGender,
      defaults.defaultInterestedInFallback,
    ) ?? [defaults.defaultInterestedInFallback];
  }
  if (defaults.acceptAgreements) Object.assign(patch, agreementFieldsPatchFor(row, updatedAt));
  patch.is_active = true;
  if (!row.marriage_intention) patch.marriage_intention = "open_to_marriage";
  if (!row.marriage_timeline) patch.marriage_timeline = "when_right";
  if (!row.wants_children) patch.wants_children = "open";
  if (!row.has_children) patch.has_children = "no";
  if (!row.faith_or_values_importance) patch.faith_or_values_importance = "important";
  if (!row.family_values) patch.family_values = "balanced";
  if (!row.relocation_openness) patch.relocation_openness = "maybe";
  if (!row.communication_style) patch.communication_style = "direct";
  if (!row.dealbreakers?.length) patch.dealbreakers = ["dishonesty", "disrespect"];
  if (!row.long_distance_openness) patch.long_distance_openness = "maybe";
  if (!row.parenting_preferences) patch.parenting_preferences = "Open to discussing together";
  if (!row.conflict_resolution_style) patch.conflict_resolution_style = "pause_then_discuss";
  if (!row.love_language) patch.love_language = "quality_time";
  if (!row.work_life_balance) patch.work_life_balance = "balanced";
  if (!row.education_importance) patch.education_importance = "important";
  if (!row.faith_importance) patch.faith_importance = "somewhat";
  if (!row.culture_background) patch.culture_background = "multicultural";
  if (!row.personality_type) patch.personality_type = "ambivert";
  if (!row.hobbies?.length) patch.hobbies = SAFE_GENERIC_INTERESTS;
  if (!row.partner_expectations) patch.partner_expectations = "shared_values";
  if (!row.future_plans) patch.future_plans = "open_to_paths";
  const completedPatch = profileCompletionPatch(
    row,
    normalizeGeneratedSeriousRelationshipValues(patch),
  );
  if (!defaults.makeDiscoverableAfterCompletion) {
    return {
      ...completedPatch,
      is_discoverable: row.is_discoverable,
      profile_completion_status:
        missingFields(projectRow(row, completedPatch)).length === 0
          ? row.is_discoverable
            ? "complete"
            : "not_discoverable"
          : "missing_required_fields",
    };
  }
  return completedPatch;
}

export function previewForceCompleteProfile(row: AdminRealUserRow) {
  const patch = forceCompleteProfilePatchFor(row, new Date().toISOString());
  const projected = projectRow(row, patch);
  const missing = missingFields(projected);
  return {
    patch,
    missing,
    madeDiscoverable:
      missing.length === 0 &&
      projected.is_active !== false &&
      projected.is_demo_profile === false &&
      projected.incognito === false &&
      !projected.suspicious_signup_reason,
  };
}

function projectRow(row: AdminRealUserRow, patch: Record<string, unknown>): AdminRealUserRow {
  return {
    ...row,
    ...patch,
    missing_fields: missingFields({ ...row, ...patch } as AdminRealUserRow),
  } as AdminRealUserRow;
}

function remainingFieldReasons(row: AdminRealUserRow) {
  const missing = missingFields(row);
  return missing.map((field) => {
    if (field === "Name") return `${field}: no profile name or auth display name is available`;
    if (field === "Age 18+") return `${field}: birth date is missing or user is under 18`;
    if (field === "Gender") return `${field}: gender must be completed manually`;
    if (field === "Interested in") return `${field}: dating preference is missing`;
    if (field === "Relationship goal") return `${field}: relationship goal is missing`;
    if (field === "City and country") return `${field}: city and country are missing`;
    if (field === "Safety agreement") return `${field}: safety agreement was not accepted`;
    if (field === "Terms and privacy")
      return `${field}: terms or privacy agreement was not accepted`;
    return `${field}: required field is missing`;
  });
}

function blockedReasonCounts(rows: AdminRealProfileBulkSkipped[]) {
  return rows.reduce<Record<string, number>>((counts, row) => {
    const keys = row.remainingFields?.length ? row.remainingFields : [row.reason];
    for (const key of keys) {
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, {});
}

function blockedFieldCounts(rows: AdminRealProfileBulkSkipped[]) {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    for (const field of row.remainingFields ?? []) {
      counts[field] = (counts[field] ?? 0) + 1;
    }
  }
  return counts;
}

function isManagedProfile(row: Pick<AdminRealUserRow, "id" | "profile_source">) {
  return (
    isPlaceholderUuid(row.id) ||
    row.profile_source === "managed_profile" ||
    row.profile_source === "admin_created"
  );
}

function nonFieldRepairSkipReason(
  row: AdminRealUserRow,
  moderation: { is_banned: boolean | null; banned_until: string | null } | undefined,
) {
  if (!row.has_profile) return "profile row is missing";
  if (row.is_demo_profile) return "profile is marked as demo";
  if (row.incognito) return "profile is incognito";
  if (row.suspicious_signup_reason) return row.suspicious_signup_reason;
  if (isSuspended(moderation)) return "user is banned or suspended";
  return null;
}

function profileUpdateQuery(
  stage: RealProfileRepairStage,
  rowId: string,
  patch: Record<string, unknown>,
) {
  return `profiles.update(${JSON.stringify(Object.keys(patch))}).eq("id", "${rowId}") /* ${stage} */`;
}

function usernameAvailabilityQuery(rowId: string, username: string) {
  return `profiles.select("id", { count: "exact", head: true }).ilike("username", "${username}").neq("id", "${rowId}")`;
}

function repairFailureRow(input: {
  row: AdminRealUserRow;
  stage: AdminRealProfileBulkFailure["stage"];
  query: string;
  error: unknown;
}): AdminRealProfileBulkFailure {
  const dbError = supabaseErrorDetails(input.error);
  return {
    id: input.row.id,
    name: input.row.display_name,
    stage: input.stage,
    query: input.query,
    error: dbError.message ?? "Repair stage failed.",
    dbError,
  };
}

async function applyProfileRepairStage(
  supabaseAdmin: Awaited<ReturnType<typeof assertAdmin>>,
  row: AdminRealUserRow,
  stage: RealProfileRepairStage,
  patch: Record<string, unknown>,
) {
  if (!patchChangesRow(row, patch)) return { row, updated: false };
  const query = profileUpdateQuery(stage, row.id, patch);
  const { error } = await supabaseAdmin
    .from("profiles")
    .update(patch as never)
    .eq("id", row.id);
  if (error) throw { error, query, stage };
  return { row: projectRow(row, patch), updated: true };
}

async function loadProfileRowAfterUpdate(
  supabaseAdmin: Awaited<ReturnType<typeof assertAdmin>>,
  row: AdminRealUserRow,
) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", row.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return projectRow(row, {
    ...(data as unknown as RealProfileRow),
    primary_photo: row.primary_photo,
    photo_count: row.photo_count,
  });
}

async function publicProfileIsDiscoverable(
  supabaseAdmin: Awaited<ReturnType<typeof assertAdmin>>,
  userId: string,
) {
  const { data, error } = await supabaseAdmin.rpc(
    "profile_is_discoverable" as never,
    {
      _user_id: userId,
    } as never,
  );
  if (error) throw error;
  return data === true;
}

function recalculatedCompletionPatchFor(row: AdminRealUserRow, updatedAt: string) {
  const missing = missingFields(row);
  return {
    updated_at: updatedAt,
    profile_completion_score: completionFor(row),
    onboarding_complete: missing.length === 0,
    profile_completion_status:
      missing.length === 0 ? "not_discoverable" : "missing_required_fields",
  };
}

function recalculatedDiscoverabilityPatchFor(row: AdminRealUserRow, updatedAt: string) {
  const missing = missingFields(row);
  const eligible = missing.length === 0 && row.is_active !== false;
  return {
    updated_at: updatedAt,
    onboarding_complete: eligible,
    discovery_blocked_reason: eligible
      ? null
      : `Required fields are missing: ${missing.join(", ")}`,
    profile_completion_status: eligible ? "not_discoverable" : "missing_required_fields",
    is_discoverable: eligible ? row.is_discoverable : false,
  };
}

async function runRealProfileRepairPipeline(input: {
  supabaseAdmin: Awaited<ReturnType<typeof assertAdmin>>;
  rows: AdminRealUserRow[];
  moderationById: Map<string, { is_banned: boolean | null; banned_until: string | null }>;
}) {
  let updated = 0;
  let madeDiscoverable = 0;
  let stillIncomplete = 0;
  const skippedRows: AdminRealProfileBulkSkipped[] = [];
  const failures: AdminRealProfileBulkFailure[] = [];

  for (const originalRow of input.rows) {
    let row = originalRow;
    let rowUpdated = false;
    const hardSkipReason = nonFieldRepairSkipReason(row, input.moderationById.get(row.id));
    if (hardSkipReason) {
      skippedRows.push({ id: row.id, name: row.display_name, reason: hardSkipReason });
      continue;
    }

    try {
      let safePatch = safeFieldsPatchFor(row, new Date().toISOString());
      const safeUsername = safeUsernameFor(row);
      if (safeUsername) {
        const query = usernameAvailabilityQuery(row.id, safeUsername);
        const available = await usernameIsAvailable(
          input.supabaseAdmin,
          row.id,
          safeUsername,
        ).catch((error) => {
          throw { error, query, stage: "username_availability" as const };
        });
        if (available) safePatch = { ...safePatch, username: safeUsername };
      }
      let result = await applyProfileRepairStage(
        input.supabaseAdmin,
        row,
        "auto_complete_safe_fields",
        safePatch,
      );
      row = result.row;
      rowUpdated = rowUpdated || result.updated;

      const agreementPatch = agreementFieldsPatchFor(row, new Date().toISOString());
      result = await applyProfileRepairStage(
        input.supabaseAdmin,
        row,
        "accept_agreements",
        agreementPatch,
      );
      row = result.row;
      rowUpdated = rowUpdated || result.updated;

      result = await applyProfileRepairStage(
        input.supabaseAdmin,
        row,
        "recalculate_profile_completion",
        recalculatedCompletionPatchFor(row, new Date().toISOString()),
      );
      row = result.row;
      rowUpdated = rowUpdated || result.updated;

      result = await applyProfileRepairStage(input.supabaseAdmin, row, "recalculate_trust_score", {
        updated_at: new Date().toISOString(),
      });
      row = result.row;
      rowUpdated = rowUpdated || result.updated;

      const discoverabilityPatch = recalculatedDiscoverabilityPatchFor(
        row,
        new Date().toISOString(),
      );
      result = await applyProfileRepairStage(
        input.supabaseAdmin,
        row,
        "recalculate_discoverability",
        discoverabilityPatch,
      );
      row = result.row;
      rowUpdated = rowUpdated || result.updated;

      const remainingReasons = remainingFieldReasons(row);
      if (remainingReasons.length > 0) {
        if (rowUpdated) updated += 1;
        stillIncomplete += 1;
        skippedRows.push({
          id: row.id,
          name: row.display_name,
          reason: `Still incomplete: ${remainingReasons.join("; ")}`,
          remainingFields: missingFields(row),
        });
        continue;
      }

      const makeDiscoverablePatch = {
        updated_at: new Date().toISOString(),
        is_discoverable: true,
        onboarding_complete: true,
        discovery_blocked_reason: null,
        profile_completion_status: "complete",
      };
      const wasDiscoverable = row.is_discoverable;
      result = await applyProfileRepairStage(
        input.supabaseAdmin,
        row,
        "make_discoverable",
        makeDiscoverablePatch,
      );
      row = result.row;
      rowUpdated = rowUpdated || result.updated;
      if (!wasDiscoverable && row.is_discoverable) madeDiscoverable += 1;
      if (rowUpdated) updated += 1;
    } catch (failure) {
      if (rowUpdated) updated += 1;
      const typed = failure as {
        error?: unknown;
        query?: string;
        stage?: AdminRealProfileBulkFailure["stage"];
      };
      failures.push(
        repairFailureRow({
          row,
          stage: typed.stage ?? "auto_complete_safe_fields",
          query: typed.query ?? 'profiles.update(...).eq("id", row.id)',
          error: typed.error ?? failure,
        }),
      );
    }
  }

  return {
    processed: input.rows.length,
    updated,
    madeDiscoverable,
    stillIncomplete,
    failed: failures.length,
    failures,
    skippedRows,
  };
}

function patchChangesRow(row: AdminRealUserRow, patch: Record<string, unknown>) {
  return Object.entries(patch).some(([key, value]) => {
    if (key === "updated_at") return true;
    return (row as unknown as Record<string, unknown>)[key] !== value;
  });
}

function statusFor(profile: RealProfileRow | null, missing: string[]): RealProfileStatus {
  if (!profile) return "incomplete";
  if (missing.length > 0) return "missing_required_fields";
  if (!isDiscoverable(profile, missing)) return "not_discoverable";
  return "complete";
}

function completionFor(profile: RealProfileRow | null) {
  if (!profile) return 0;
  return profileCompletion({
    display_name: profile.display_name,
    birth_date: profile.birth_date,
    gender: profile.gender,
    interested_in: profile.interested_in,
    relationship_goal: profile.relationship_goal,
    location_city: profile.location_city,
    location_country: profile.location_country,
    safety_agreement_accepted_at: profile.safety_agreement_accepted_at,
    terms_accepted_at: profile.terms_accepted_at,
    privacy_accepted_at: profile.privacy_accepted_at,
    photoCount: profile.photo_count,
    bio: profile.bio,
    interests: profile.interests,
  });
}

async function listAllAuthUsers(supabaseAdmin: Awaited<ReturnType<typeof assertAdmin>>) {
  const users: User[] = [];
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    users.push(...(data.users ?? []));
    if (!data.users || data.users.length < perPage) break;
    page += 1;
  }
  return users;
}

async function assertAdmin(context: {
  supabase: Parameters<typeof requireServerAdmin>[0];
  userId: string;
}) {
  await requireServerAdmin(context.supabase, context.userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function loadRealUsers(
  supabaseAdmin: Awaited<ReturnType<typeof assertAdmin>>,
): Promise<AdminRealUsersResult> {
  const authUsers = await listAllAuthUsers(supabaseAdmin);
  const ids = authUsers.map((u) => u.id);

  const [profileResult, photoResult, moderationResult] = await Promise.all([
    ids.length
      ? supabaseAdmin.from("profiles").select(PROFILE_SELECT).in("id", ids)
      : Promise.resolve({ data: [] }),
    ids.length
      ? supabaseAdmin
          .from("profile_photos")
          .select("user_id, url, storage_path, is_primary, position")
          .in("user_id", ids)
          .eq("is_private", false)
          .order("is_primary", { ascending: false })
          .order("position", { ascending: true })
      : Promise.resolve({ data: [] }),
    ids.length
      ? supabaseAdmin
          .from("user_moderation")
          .select("user_id, is_banned, banned_until")
          .in("user_id", ids)
      : Promise.resolve({ data: [] }),
  ]);
  if ("error" in profileResult && profileResult.error) throw profileResult.error;
  if ("error" in photoResult && photoResult.error) throw photoResult.error;
  if ("error" in moderationResult && moderationResult.error) throw moderationResult.error;

  const profiles = profileResult.data;
  const photos = photoResult.data;
  const moderationRows = moderationResult.data;

  const photoByUser = new Map<string, { path: string | null; count: number }>();
  for (const photo of photos ?? []) {
    const existing = photoByUser.get(photo.user_id) ?? { path: null, count: 0 };
    existing.count += 1;
    if (!existing.path) existing.path = photoPath(photo);
    photoByUser.set(photo.user_id, existing);
  }

  const profileById = new Map<string, RealProfileRow>(
    ((profiles ?? []) as unknown as RealProfileRow[]).map((profile) => {
      const photo = photoByUser.get(profile.id);
      return [
        profile.id,
        { ...profile, primary_photo: photo?.path ?? null, photo_count: photo?.count ?? 0 },
      ];
    }),
  );
  const moderationById = new Map<
    string,
    { is_banned: boolean | null; banned_until: string | null }
  >(
    (
      (moderationRows ?? []) as {
        user_id: string;
        is_banned: boolean | null;
        banned_until: string | null;
      }[]
    ).map((row) => [row.user_id, { is_banned: row.is_banned, banned_until: row.banned_until }]),
  );

  const rows = authUsers
    .map((user): AdminRealUserRow => {
      const profile = profileById.get(user.id) ?? null;
      const missing = missingFields(profile);
      const fallbackProfile: RealProfileRow = profile ?? {
        id: user.id,
        display_name: metadataName(user),
        username: null,
        membership_tier: "free",
        is_verified: false,
        email_verified: Boolean(user.email_confirmed_at),
        is_featured: false,
        location_city: null,
        location_country: null,
        location_state: null,
        bio: null,
        interests: [],
        created_at: user.created_at,
        last_active: user.created_at,
        last_login_at: null,
        failed_login_attempts: 0,
        account_locked_until: null,
        is_demo_profile: false,
        profile_source: "user_signup",
        is_discoverable: false,
        onboarding_complete: false,
        discovery_blocked_reason: "Onboarding is incomplete",
        profile_completion_status: "incomplete",
        birth_date: null,
        gender: null,
        interested_in: [],
        relationship_goal: null,
        marriage_intention: null,
        marriage_timeline: null,
        wants_children: null,
        has_children: null,
        faith_or_values_importance: null,
        family_values: null,
        relocation_openness: null,
        communication_style: null,
        dealbreakers: [],
        long_distance_openness: null,
        parenting_preferences: null,
        conflict_resolution_style: null,
        love_language: null,
        work_life_balance: null,
        education_importance: null,
        faith_importance: null,
        culture_background: null,
        personality_type: null,
        hobbies: [],
        partner_expectations: null,
        future_plans: null,
        trust_score: 0,
        trust_level: "low",
        safety_agreement_accepted_at: null,
        terms_accepted_at: null,
        privacy_accepted_at: null,
        suspicious_signup_reason: null,
        incognito: false,
        is_active: true,
        primary_photo: null,
        photo_count: 0,
      };
      return {
        ...fallbackProfile,
        auth_email: user.email ?? null,
        auth_display_name: metadataName(user),
        auth_created_at: user.created_at,
        has_profile: Boolean(profile),
        missing_fields: missing,
        profile_status: statusFor(profile, missing),
        profile_completion_score: completionFor(profile),
      };
    })
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));

  const stats: AdminRealProfileStats = {
    totalRealUsers: rows.length,
    missingProfileRows: rows.filter((row) => !row.has_profile).length,
    incompleteProfiles: rows.filter((row) => !row.has_profile || row.missing_fields.length > 0)
      .length,
    discoverableRealUsers: rows.filter(
      (row) => isDiscoverable(row, row.missing_fields) && !isSuspended(moderationById.get(row.id)),
    ).length,
    completeProfiles: rows.filter((row) => row.profile_status === "complete").length,
    notDiscoverableProfiles: rows.filter((row) => row.profile_status === "not_discoverable").length,
    eligibleButHiddenRealUsers: rows.filter(
      (row) =>
        !row.is_discoverable && !discoverEligibilitySkipReason(row, moderationById.get(row.id)),
    ).length,
  };

  return { rows, stats };
}

export const listAdminRealUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminRealUsersResult> => {
    const supabaseAdmin = await assertAdmin(context);
    return loadRealUsers(supabaseAdmin);
  });

async function loadFullProfileEditorData(
  supabaseAdmin: Awaited<ReturnType<typeof assertAdmin>>,
  userId: string,
): Promise<AdminFullProfileEditorData> {
  const profileResult = await supabaseAdmin
    .from("profiles")
    .select(
      [
        "id",
        "display_name",
        "username",
        "birth_date",
        "gender",
        "interested_in",
        "relationship_goal",
        "marriage_intention",
        "marriage_timeline",
        "wants_children",
        "has_children",
        "faith_or_values_importance",
        "family_values",
        "relocation_openness",
        "communication_style",
        "dealbreakers",
        "long_distance_openness",
        "parenting_preferences",
        "conflict_resolution_style",
        "love_language",
        "work_life_balance",
        "education_importance",
        "faith_importance",
        "culture_background",
        "personality_type",
        "hobbies",
        "partner_expectations",
        "future_plans",
        "trust_score",
        "trust_level",
        "location_city",
        "location_country",
        "location_state",
        "bio",
        "interests",
        "profession",
        "education",
        "is_verified",
        "membership_tier",
        "is_active",
        "is_discoverable",
        "is_featured",
        "profile_completion_status",
        "safety_agreement_accepted_at",
        "terms_accepted_at",
        "privacy_accepted_at",
      ].join(", "),
    )
    .eq("id", userId)
    .maybeSingle();
  if (profileResult.error) throw profileResult.error;
  if (!profileResult.data) {
    throw new Error(
      `Profile row not found for user ${userId}. Run Create missing real profiles first.`,
    );
  }

  const photoResult = await supabaseAdmin
    .from("profile_photos")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_private", false);
  const photoCount = photoResult.error ? 0 : (photoResult.count ?? 0);
  if (photoResult.error) {
    console.error(
      "[admin-full-profile-editor] optional photo count failed",
      adminActionFailure({ error: photoResult.error, stage: "load_photo_count", userId }),
    );
  }
  const profile = profileResult.data;
  const row = profile as Partial<RealProfileRow> | null;
  const fallback: RealProfileRow = {
    id: userId,
    display_name: null,
    username: null,
    membership_tier: "free",
    is_verified: false,
    email_verified: false,
    is_featured: false,
    location_city: null,
    location_country: null,
    created_at: new Date().toISOString(),
    last_active: new Date().toISOString(),
    last_login_at: null,
    failed_login_attempts: 0,
    account_locked_until: null,
    is_demo_profile: false,
    profile_source: "user_signup",
    is_discoverable: false,
    onboarding_complete: false,
    discovery_blocked_reason: "Onboarding is incomplete",
    profile_completion_status: "incomplete",
    birth_date: null,
    gender: null,
    interested_in: [],
    relationship_goal: null,
    marriage_intention: null,
    marriage_timeline: null,
    wants_children: null,
    has_children: null,
    faith_or_values_importance: null,
    family_values: null,
    relocation_openness: null,
    communication_style: null,
    dealbreakers: [],
    long_distance_openness: null,
    parenting_preferences: null,
    conflict_resolution_style: null,
    love_language: null,
    work_life_balance: null,
    education_importance: null,
    faith_importance: null,
    culture_background: null,
    personality_type: null,
    hobbies: [],
    partner_expectations: null,
    future_plans: null,
    trust_score: 0,
    trust_level: "low",
    safety_agreement_accepted_at: null,
    terms_accepted_at: null,
    privacy_accepted_at: null,
    suspicious_signup_reason: null,
    incognito: false,
    is_active: true,
    primary_photo: null,
    photo_count: photoCount ?? 0,
  };
  const complete = {
    ...fallback,
    ...row,
    interests: (row as { interests?: string[] | null } | null)?.interests ?? [],
  } as RealProfileRow & {
    location_state?: string | null;
    bio?: string | null;
    interests?: string[] | null;
    profession?: string | null;
    education?: string | null;
  };
  const missing = missingFields(complete);
  return {
    profile: {
      id: userId,
      display_name: complete.display_name,
      username: complete.username,
      birth_date: complete.birth_date,
      gender: complete.gender,
      interested_in: complete.interested_in ?? [],
      relationship_goal: complete.relationship_goal,
      marriage_intention: complete.marriage_intention,
      marriage_timeline: complete.marriage_timeline,
      wants_children: complete.wants_children,
      has_children: complete.has_children,
      faith_or_values_importance: complete.faith_or_values_importance,
      family_values: complete.family_values,
      relocation_openness: complete.relocation_openness,
      communication_style: complete.communication_style,
      dealbreakers: complete.dealbreakers ?? [],
      long_distance_openness: complete.long_distance_openness,
      parenting_preferences: complete.parenting_preferences,
      conflict_resolution_style: complete.conflict_resolution_style,
      love_language: complete.love_language,
      work_life_balance: complete.work_life_balance,
      education_importance: complete.education_importance,
      faith_importance: complete.faith_importance,
      culture_background: complete.culture_background,
      personality_type: complete.personality_type,
      hobbies: complete.hobbies ?? [],
      partner_expectations: complete.partner_expectations,
      future_plans: complete.future_plans,
      trust_score: complete.trust_score,
      trust_level: complete.trust_level,
      location_city: complete.location_city,
      location_country: complete.location_country,
      location_state: complete.location_state ?? null,
      bio: complete.bio ?? null,
      interests: complete.interests ?? [],
      profession: complete.profession ?? null,
      education: complete.education ?? null,
      is_verified: complete.is_verified,
      membership_tier: complete.membership_tier,
      is_active: complete.is_active ?? true,
      is_discoverable: complete.is_discoverable,
      is_featured: complete.is_featured,
      profile_completion_status: statusFor(complete, missing),
      safety_agreement_accepted_at: complete.safety_agreement_accepted_at ?? null,
      terms_accepted_at: complete.terms_accepted_at ?? null,
      privacy_accepted_at: complete.privacy_accepted_at ?? null,
      profile_completion_score: completionFor(complete),
      photo_count: photoCount ?? 0,
      missing_fields: missing,
    },
  };
}

export const getAdminFullProfileEditor = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string }) => {
    if (!data || typeof data.userId !== "string" || !data.userId) {
      throw new Error("Choose a member profile.");
    }
    return { userId: data.userId };
  })
  .handler(async ({ data, context }): Promise<AdminFullProfileEditorLoadResult> => {
    try {
      const supabaseAdmin = await assertAdmin(context);
      return { ok: true, ...(await loadFullProfileEditorData(supabaseAdmin, data.userId)) };
    } catch (error) {
      const failure = adminActionFailure({
        error,
        stage: "load_main_profile",
        userId: data.userId,
        fallback: "Could not load full profile editor.",
      });
      console.error("[admin-full-profile-editor] main profile load failed", failure);
      return failure;
    }
  });

export const listAdminProfileAuditHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string }) => {
    if (!data || typeof data.userId !== "string" || !data.userId) {
      throw new Error("Choose a member profile.");
    }
    return { userId: data.userId };
  })
  .handler(async ({ data, context }): Promise<AdminProfileAuditHistoryRow[]> => {
    const supabaseAdmin = await assertAdmin(context);
    const { data: rows, error } = await supabaseAdmin
      .from("admin_audit_log")
      .select("id, action, entity_id, details, created_at")
      .eq("entity_type", "profile")
      .eq("entity_id", data.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return (rows ?? []).map((row) => {
      const details = row.details as Record<string, Json | undefined>;
      return {
        ...row,
        actor_id: typeof details?.admin_id === "string" ? details.admin_id : null,
      };
    }) as AdminProfileAuditHistoryRow[];
  });

export const saveAdminFullProfileEditor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: AdminFullProfileSaveInput) => normalizeFullProfileInput(data))
  .handler(async ({ data, context }): Promise<AdminFullProfileSaveResult> => {
    try {
      const supabaseAdmin = await assertAdmin(context);
      const before = await loadFullProfileEditorData(supabaseAdmin, data.userId);
      const now = new Date().toISOString();
      const desired = data.profile;
      const projected: RealProfileRow = {
        id: data.userId,
        display_name: desired.display_name,
        username: desired.username,
        membership_tier: desired.membership_tier,
        is_verified: desired.is_verified,
        email_verified: false,
        is_featured: desired.is_featured,
        location_city: desired.location_city,
        location_country: desired.location_country,
        location_state: desired.location_state,
        bio: desired.bio,
        interests: desired.interests,
        created_at: now,
        last_active: now,
        last_login_at: null,
        failed_login_attempts: 0,
        account_locked_until: null,
        is_demo_profile: false,
        profile_source: "user_signup",
        is_discoverable: desired.is_discoverable,
        onboarding_complete: true,
        discovery_blocked_reason: desired.is_discoverable ? null : "hidden_by_admin",
        profile_completion_status: desired.profile_completion_status,
        birth_date: desired.birth_date,
        gender: desired.gender,
        interested_in: desired.interested_in,
        relationship_goal: desired.relationship_goal,
        marriage_intention: desired.marriage_intention,
        marriage_timeline: desired.marriage_timeline,
        wants_children: desired.wants_children,
        has_children: desired.has_children,
        faith_or_values_importance: desired.faith_or_values_importance,
        family_values: desired.family_values,
        relocation_openness: desired.relocation_openness,
        communication_style: desired.communication_style,
        dealbreakers: desired.dealbreakers,
        long_distance_openness: desired.long_distance_openness,
        parenting_preferences: desired.parenting_preferences,
        conflict_resolution_style: desired.conflict_resolution_style,
        love_language: desired.love_language,
        work_life_balance: desired.work_life_balance,
        education_importance: desired.education_importance,
        faith_importance: desired.faith_importance,
        culture_background: desired.culture_background,
        personality_type: desired.personality_type,
        hobbies: desired.hobbies,
        partner_expectations: desired.partner_expectations,
        future_plans: desired.future_plans,
        trust_score: desired.trust_score,
        trust_level: desired.trust_level,
        safety_agreement_accepted_at: desired.safety_agreement_accepted_at,
        terms_accepted_at: desired.terms_accepted_at,
        privacy_accepted_at: desired.privacy_accepted_at,
        suspicious_signup_reason: null,
        incognito: false,
        is_active: desired.is_active,
        primary_photo: null,
        photo_count: before.profile.photo_count,
      };
      const missing = missingFields(projected);
      const canDiscover = missing.length === 0 && desired.is_active;
      const finalDiscoverable = desired.is_discoverable && canDiscover;
      const finalStatus: RealProfileStatus =
        missing.length > 0
          ? "missing_required_fields"
          : finalDiscoverable
            ? "complete"
            : desired.profile_completion_status === "complete"
              ? "not_discoverable"
              : desired.profile_completion_status;
      const profileCompletionScore = profileCompletion({
        display_name: desired.display_name,
        birth_date: desired.birth_date,
        gender: desired.gender,
        interested_in: desired.interested_in,
        relationship_goal: desired.relationship_goal,
        marriage_intention: desired.marriage_intention,
        marriage_timeline: desired.marriage_timeline,
        wants_children: desired.wants_children,
        has_children: desired.has_children,
        faith_or_values_importance: desired.faith_or_values_importance,
        family_values: desired.family_values,
        relocation_openness: desired.relocation_openness,
        communication_style: desired.communication_style,
        dealbreakers: desired.dealbreakers,
        long_distance_openness: desired.long_distance_openness,
        parenting_preferences: desired.parenting_preferences,
        conflict_resolution_style: desired.conflict_resolution_style,
        love_language: desired.love_language,
        work_life_balance: desired.work_life_balance,
        education_importance: desired.education_importance,
        faith_importance: desired.faith_importance,
        culture_background: desired.culture_background,
        personality_type: desired.personality_type,
        hobbies: desired.hobbies,
        partner_expectations: desired.partner_expectations,
        future_plans: desired.future_plans,
        location_city: desired.location_city,
        location_country: desired.location_country,
        safety_agreement_accepted_at: desired.safety_agreement_accepted_at,
        terms_accepted_at: desired.terms_accepted_at,
        privacy_accepted_at: desired.privacy_accepted_at,
        photoCount: before.profile.photo_count,
        bio: desired.bio,
        interests: desired.interests,
      });
      const patch = {
        id: data.userId,
        display_name: desired.display_name,
        username: desired.username,
        birth_date: desired.birth_date,
        date_of_birth: desired.birth_date,
        gender: desired.gender,
        interested_in: desired.interested_in,
        relationship_goal: desired.relationship_goal,
        marriage_intention: desired.marriage_intention,
        marriage_timeline: desired.marriage_timeline,
        wants_children: desired.wants_children,
        has_children: desired.has_children,
        faith_or_values_importance: desired.faith_or_values_importance,
        family_values: desired.family_values,
        relocation_openness: desired.relocation_openness,
        communication_style: desired.communication_style,
        dealbreakers: desired.dealbreakers,
        long_distance_openness: desired.long_distance_openness,
        parenting_preferences: desired.parenting_preferences,
        conflict_resolution_style: desired.conflict_resolution_style,
        love_language: desired.love_language,
        work_life_balance: desired.work_life_balance,
        education_importance: desired.education_importance,
        faith_importance: desired.faith_importance,
        culture_background: desired.culture_background,
        personality_type: desired.personality_type,
        hobbies: desired.hobbies,
        partner_expectations: desired.partner_expectations,
        future_plans: desired.future_plans,
        location_city: desired.location_city,
        city: desired.location_city,
        location_country: desired.location_country,
        country: desired.location_country,
        location_state: desired.location_state,
        bio: desired.bio,
        interests: desired.interests,
        profession: desired.profession,
        education: desired.education,
        is_verified: desired.is_verified,
        membership_tier: desired.membership_tier,
        is_active: desired.is_active,
        is_discoverable: finalDiscoverable,
        is_featured: desired.is_featured,
        onboarding_complete: missing.length === 0,
        discovery_blocked_reason: finalDiscoverable
          ? null
          : missing.length > 0
            ? "Required fields are missing"
            : null,
        profile_completion_status: finalStatus,
        profile_completion_score: profileCompletionScore,
        safety_agreement_accepted_at: desired.safety_agreement_accepted_at,
        terms_accepted_at: desired.terms_accepted_at,
        privacy_accepted_at: desired.privacy_accepted_at,
        is_demo_profile: false,
        updated_at: now,
      };
      const { error } = await supabaseAdmin
        .from("profiles")
        .upsert(patch as never, { onConflict: "id" });
      if (error) {
        return {
          ok: false,
          error: error.message,
          dbError: supabaseErrorDetails(error),
          missingFields: missing,
        };
      }

      const auditRows = Object.entries(patch)
        .filter(
          ([field]) => !["id", "updated_at", "date_of_birth", "city", "country"].includes(field),
        )
        .filter(([field, newValue]) => {
          const oldValue = (before.profile as unknown as Record<string, unknown>)[field];
          return JSON.stringify(oldValue ?? null) !== JSON.stringify(newValue ?? null);
        })
        .map(([field, newValue]) => ({
          action: "admin_profile.field_update",
          entityType: "profile",
          entityId: data.userId,
          actorId: context.userId,
          details: {
            admin_id: context.userId,
            user_id: data.userId,
            field,
            old_value: (before.profile as unknown as Record<string, unknown>)[field] ?? null,
            new_value: newValue ?? null,
            timestamp: now,
          },
        }));
      if (auditRows.length) {
        await writeAdminAuditWarning(supabaseAdmin, auditRows);
      }
      const [editorData, users] = await Promise.all([
        loadFullProfileEditorData(supabaseAdmin, data.userId),
        loadRealUsers(supabaseAdmin),
      ]);
      return { ok: true, ...editorData, rows: users.rows, stats: users.stats };
    } catch (error) {
      return {
        ok: false,
        error: supabaseErrorDetails(error).message ?? "Could not save profile.",
        dbError: supabaseErrorDetails(error),
      };
    }
  });

export const createMissingRealProfiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminRealProfileRepairResult> => {
    const supabaseAdmin = await assertAdmin(context);
    const beforeResult = await loadRealUsers(supabaseAdmin);
    const missing = beforeResult.rows.filter((row) => !row.has_profile);

    if (missing.length > 0) {
      const inserts = missing.map((row) => ({
        id: row.id,
        display_name: row.display_name,
        email_verified: row.email_verified,
        is_demo_profile: false,
        is_discoverable: false,
        onboarding_complete: false,
        discovery_blocked_reason: "Onboarding is incomplete",
        profile_completion_status: "incomplete",
        last_active: row.auth_created_at,
      }));
      const { error } = await supabaseAdmin.from("profiles").upsert(inserts as never, {
        onConflict: "id",
      });
      if (error) throw error;
    }

    await writeAdminAuditWarning(supabaseAdmin, {
      actorId: context.userId,
      action: "create_missing_real_profiles",
      entityType: "profile",
      entityId: null,
      details: { missing_before: beforeResult.stats.missingProfileRows, created: missing.length },
    });

    const afterResult = await loadRealUsers(supabaseAdmin);
    return {
      ...afterResult,
      before: beforeResult.stats,
      after: afterResult.stats,
      created: missing.length,
    };
  });

export const repairRealProfileSystemFields = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminRealProfileRepairResponse> => {
    const supabaseAdmin = await assertAdmin(context);
    let beforeResult: AdminRealUsersResult;
    try {
      beforeResult = await loadRealUsers(supabaseAdmin);
    } catch (error) {
      console.error("[real-profile-repair] load failed", repairFailure({ error, stage: "load" }));
      return repairFailure({ error, stage: "load" });
    }
    const ids = beforeResult.rows.map((row) => row.id);
    const { data: moderationRows, error: moderationError } = ids.length
      ? await supabaseAdmin
          .from("user_moderation")
          .select("user_id, is_banned, banned_until")
          .in("user_id", ids)
      : { data: [], error: null };
    if (moderationError) {
      const failure = repairFailure({ error: moderationError, stage: "load" });
      console.error("[real-profile-repair] moderation load failed", failure);
      return failure;
    }
    const moderationById = new Map<
      string,
      { is_banned: boolean | null; banned_until: string | null }
    >(
      (
        (moderationRows ?? []) as {
          user_id: string;
          is_banned: boolean | null;
          banned_until: string | null;
        }[]
      ).map((row) => [row.user_id, { is_banned: row.is_banned, banned_until: row.banned_until }]),
    );

    const repairReport = await runRealProfileRepairPipeline({
      supabaseAdmin,
      rows: beforeResult.rows,
      moderationById,
    });

    await writeAdminAuditWarning(supabaseAdmin, {
      actorId: context.userId,
      action: "repair_real_profile_system_fields",
      entityType: "profile",
      entityId: null,
      details: {
        processed: repairReport.processed,
        updated: repairReport.updated,
        repaired: repairReport.updated,
        made_discoverable: repairReport.madeDiscoverable,
        still_incomplete: repairReport.stillIncomplete,
        failed: repairReport.failed,
        failures: repairReport.failures,
        skipped: repairReport.skippedRows.length,
        skippedRows: repairReport.skippedRows,
        total_real_users: beforeResult.stats.totalRealUsers,
      },
    });

    let afterResult: AdminRealUsersResult;
    try {
      afterResult = await loadRealUsers(supabaseAdmin);
    } catch (error) {
      console.error(
        "[real-profile-repair] reload failed",
        repairFailure({ error, stage: "reload", repairedBeforeFailure: repairReport.updated }),
      );
      return repairFailure({ error, stage: "reload", repairedBeforeFailure: repairReport.updated });
    }
    return {
      ...afterResult,
      ok: true,
      before: beforeResult.stats,
      after: afterResult.stats,
      processed: repairReport.processed,
      updated: repairReport.updated,
      repaired: repairReport.updated,
      madeDiscoverable: repairReport.madeDiscoverable,
      stillIncomplete: repairReport.stillIncomplete,
      failed: repairReport.failed,
      failures: repairReport.failures,
      skipped: repairReport.skippedRows.length,
      skippedRows: repairReport.skippedRows,
      blockedReasonCounts: blockedReasonCounts(repairReport.skippedRows),
    };
  });

export const bulkUpdateRealProfileDiscoverability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      action: RealProfileBulkAction;
      ids?: string[];
      options?: AdminAutoCompleteOptions;
    }) => {
      if (
        !data ||
        ![
          "make_discoverable",
          "hide_from_discover",
          "mark_active",
          "mark_inactive",
          "repair_system_fields",
          "admin_assisted_complete",
          "auto_complete_missing_required_fields",
          "force_complete_profile",
          "convert_placeholder_to_managed",
          "accept_agreements",
        ].includes(data.action)
      ) {
        throw new Error("Unsupported bulk action.");
      }
      return {
        action: data.action,
        ids: Array.from(new Set((data.ids ?? []).filter((id) => typeof id === "string" && id))),
        options: data.options ?? {},
      };
    },
  )
  .handler(async ({ context, data }): Promise<AdminRealProfileBulkResult> => {
    const supabaseAdmin = await assertAdmin(context);
    const beforeResult = await loadRealUsers(supabaseAdmin);
    const convertingPlaceholders = data.action === "convert_placeholder_to_managed";
    if (convertingPlaceholders && data.options.confirmManagedProfileConversion !== true) {
      throw new Error("Managed profile conversion requires explicit admin confirmation.");
    }
    const selectedRows = beforeResult.rows.filter((row) => data.ids.includes(row.id));
    const managedSelectedRows = selectedRows.filter(isManagedProfile);
    const targetRows = convertingPlaceholders
      ? managedSelectedRows.filter((row) => isPlaceholderUuid(row.id))
      : selectedRows.filter((row) => !isManagedProfile(row));
    const { data: moderationRows, error: moderationError } = targetRows.length
      ? await supabaseAdmin
          .from("user_moderation")
          .select("user_id, is_banned, banned_until")
          .in(
            "user_id",
            targetRows.map((row) => row.id),
          )
      : { data: [], error: null };
    if (moderationError) throw moderationError;
    const moderationById = new Map<
      string,
      { is_banned: boolean | null; banned_until: string | null }
    >(
      (
        (moderationRows ?? []) as {
          user_id: string;
          is_banned: boolean | null;
          banned_until: string | null;
        }[]
      ).map((row) => [row.user_id, { is_banned: row.is_banned, banned_until: row.banned_until }]),
    );

    let updated = 0;
    let madeDiscoverable = 0;
    let stillIncomplete = 0;
    const skippedRows: AdminRealProfileBulkSkipped[] = [];
    const failures: AdminRealProfileBulkFailure[] = [];
    let stillMissingAgeGender = 0;
    let auditWarning: string | undefined;
    const selectedIds = data.ids;

    if (data.action === "repair_system_fields") {
      const repairReport = await runRealProfileRepairPipeline({
        supabaseAdmin,
        rows: targetRows,
        moderationById,
      });

      await writeAdminAuditWarning(supabaseAdmin, {
        actorId: context.userId,
        action: "bulk_repair_system_fields",
        entityType: "profile",
        entityId: null,
        details: {
          selected: targetRows.length,
          processed: repairReport.processed,
          updated: repairReport.updated,
          made_discoverable: repairReport.madeDiscoverable,
          still_incomplete: repairReport.stillIncomplete,
          failed: repairReport.failed,
          failures: repairReport.failures,
          skipped: repairReport.skippedRows.length,
          skippedRows: repairReport.skippedRows,
        },
      });

      const afterResult = await loadRealUsers(supabaseAdmin);
      const targetIdSet = new Set(targetRows.map((row) => row.id));
      const afterTargetRows = afterResult.rows.filter((row) => targetIdSet.has(row.id));
      return {
        ...afterResult,
        ok: true,
        action: data.action,
        processed: repairReport.processed,
        updated: repairReport.updated,
        madeDiscoverable: repairReport.madeDiscoverable,
        stillIncomplete: repairReport.stillIncomplete,
        failed: repairReport.failed,
        failures: repairReport.failures,
        selectedIds,
        realUsersProcessed: targetRows.length,
        managedProfilesSkipped: managedSelectedRows.length,
        managedProfilesConverted: 0,
        skipped: repairReport.skippedRows.length,
        skippedRows: repairReport.skippedRows,
        stillMissingAgeGender,
        nowDiscoverable: afterTargetRows.filter((row) => row.is_discoverable).length,
        notDiscoverable: afterTargetRows.filter((row) => !row.is_discoverable).length,
        blockedReasonCounts: blockedReasonCounts(repairReport.skippedRows),
      };
    }

    for (const row of targetRows) {
      let patch: Record<string, unknown> | null = null;
      let stage = data.action;
      try {
        if (data.action === "convert_placeholder_to_managed") {
          if (!isPlaceholderUuid(row.id) || !row.has_profile) {
            skippedRows.push({
              id: row.id,
              name: row.display_name,
              reason: "Only existing placeholder profile rows can be converted.",
            });
            continue;
          }
          stage = "convert_placeholder_to_managed";
          patch = forceCompleteProfilePatchFor(row, new Date().toISOString(), {
            ...data.options,
            generateAge18Plus: true,
            inferGender: true,
            acceptAgreements: true,
            makeDiscoverableAfterCompletion: true,
          });
          patch = {
            ...patch,
            profile_source: "managed_profile",
            is_demo_profile: false,
            is_verified: false,
            email_verified: false,
            phone_verified: false,
            identity_verified: false,
            photo_verified: false,
            is_active: true,
            is_discoverable: true,
            onboarding_complete: true,
            discovery_blocked_reason: null,
            profile_completion_status: "complete",
          };
        } else if (data.action === "make_discoverable") {
          const reason = discoverEligibilitySkipReason(row, moderationById.get(row.id));
          if (reason) {
            skippedRows.push({ id: row.id, name: row.display_name, reason });
            continue;
          }
          patch = {
            is_discoverable: true,
            onboarding_complete: true,
            discovery_blocked_reason: null,
            profile_completion_status: "complete",
          };
        } else if (data.action === "hide_from_discover") {
          if (!row.has_profile) {
            skippedRows.push({
              id: row.id,
              name: row.display_name,
              reason: "profile row is missing",
            });
            continue;
          }
          patch = { is_discoverable: false, profile_completion_status: "not_discoverable" };
        } else if (data.action === "mark_active") {
          if (!row.has_profile) {
            skippedRows.push({
              id: row.id,
              name: row.display_name,
              reason: "profile row is missing",
            });
            continue;
          }
          patch = { is_active: true };
        } else if (data.action === "mark_inactive") {
          if (!row.has_profile) {
            skippedRows.push({
              id: row.id,
              name: row.display_name,
              reason: "profile row is missing",
            });
            continue;
          }
          patch = {
            is_active: false,
            is_discoverable: false,
            profile_completion_status: "not_discoverable",
          };
        } else if (data.action === "accept_agreements") {
          if (!row.has_profile) {
            skippedRows.push({
              id: row.id,
              name: row.display_name,
              reason: "profile row is missing",
            });
            continue;
          }
          if (row.is_demo_profile) {
            skippedRows.push({
              id: row.id,
              name: row.display_name,
              reason: "profile is marked as demo",
            });
            continue;
          }
          patch = acceptAgreementsPatchFor(row, new Date().toISOString());
          if (!patch) {
            skippedRows.push({
              id: row.id,
              name: row.display_name,
              reason: "agreement fields are already accepted",
            });
            continue;
          }
        } else if (data.action === "admin_assisted_complete") {
          if (!row.has_profile) {
            skippedRows.push({
              id: row.id,
              name: row.display_name,
              reason: "profile row is missing",
            });
            continue;
          }
          if (row.is_demo_profile) {
            skippedRows.push({
              id: row.id,
              name: row.display_name,
              reason: "profile is marked as demo",
            });
            continue;
          }
          if (row.incognito) {
            skippedRows.push({
              id: row.id,
              name: row.display_name,
              reason: "profile is incognito",
            });
            continue;
          }
          if (row.suspicious_signup_reason) {
            skippedRows.push({
              id: row.id,
              name: row.display_name,
              reason: row.suspicious_signup_reason,
            });
            continue;
          }
          if (isSuspended(moderationById.get(row.id))) {
            skippedRows.push({
              id: row.id,
              name: row.display_name,
              reason: "user is banned or suspended",
            });
            continue;
          }
          patch = adminAssistedCompletionPatchFor(row, new Date().toISOString());
          const projected = { ...row, ...patch } as AdminRealUserRow;
          const missing = missingFields(projected);
          if (missing.includes("Age 18+") || missing.includes("Gender")) {
            stillMissingAgeGender += 1;
            skippedRows.push({
              id: row.id,
              name: row.display_name,
              reason: `Still incomplete: ${remainingFieldReasons(projected).join("; ")}`,
              remainingFields: missing,
            });
          }
        } else if (data.action === "auto_complete_missing_required_fields") {
          stage = "auto_complete_missing_required_fields";
          const reason = nonFieldRepairSkipReason(row, moderationById.get(row.id));
          if (reason) {
            skippedRows.push({ id: row.id, name: row.display_name, reason });
            continue;
          }
          patch = autoCompleteMissingRequiredPatchFor(row, new Date().toISOString(), data.options);
          patch = profileCompletionPatch(row, patch);
          const projected = projectRow(row, patch);
          const missing = missingFields(projected);
          if (data.options.makeDiscoverableAfterCompletion && missing.length === 0) {
            patch = {
              ...patch,
              is_discoverable: true,
              onboarding_complete: true,
              discovery_blocked_reason: null,
              profile_completion_status: "complete",
            };
          }
          if (missing.length > 0) {
            stillIncomplete += 1;
            if (missing.includes("Age 18+") || missing.includes("Gender")) {
              stillMissingAgeGender += 1;
            }
            skippedRows.push({
              id: row.id,
              name: row.display_name,
              reason: `Still incomplete: ${remainingFieldReasons(projected).join("; ")}`,
              remainingFields: missing,
            });
          }
        } else if (data.action === "force_complete_profile") {
          stage = "auto_complete_missing_required_fields";
          const reason = nonFieldRepairSkipReason(row, moderationById.get(row.id));
          if (reason) {
            const blockers = !row.has_profile
              ? [{ field: "profiles.id", reason: "profile row is missing" }]
              : discoverabilityBlockers(row, moderationById.get(row.id));
            skippedRows.push({
              id: row.id,
              name: row.display_name,
              reason: `Skipped: ${blockers
                .map((blocker) => `${blocker.field}: ${blocker.reason}`)
                .join("; ")}`,
              remainingFields: blockers.map((blocker) => blocker.field),
            });
            continue;
          }
          patch = forceCompleteProfilePatchFor(row, new Date().toISOString(), data.options);
          const projected = projectRow(row, patch);
          const missing = missingFields(projected);
          if (missing.length === 0 && data.options.makeDiscoverableAfterCompletion !== false) {
            patch = {
              ...patch,
              is_active: true,
              is_discoverable: true,
              onboarding_complete: true,
              discovery_blocked_reason: null,
              profile_completion_status: "complete",
            };
          }
        }

        if (!patchChangesRow(row, patch ?? {})) {
          continue;
        }
        const nextPatch = patch ?? {};

        if (data.options.dryRun) {
          updated += 1;
          continue;
        }

        const timestamp = new Date().toISOString();
        const fieldAuditRows =
          data.action === "auto_complete_missing_required_fields" ||
          data.action === "force_complete_profile" ||
          data.action === "convert_placeholder_to_managed"
            ? auditFieldRowsForPatch({
                actorId: context.userId,
                row,
                patch: nextPatch,
                reason: "admin_auto_complete",
                timestamp,
              })
            : [];
        const query = `profiles.update(${JSON.stringify(Object.keys(nextPatch))}).eq("id", "${row.id}") /* ${stage} */`;
        const { error } = await supabaseAdmin
          .from("profiles")
          .update(nextPatch as never)
          .eq("id", row.id);
        if (error) throw { error, query };
        if (fieldAuditRows.length) {
          const auditError = await writeAdminAuditWarning(supabaseAdmin, fieldAuditRows);
          if (auditError) {
            auditWarning ??= "Audit logging failed for one or more profile changes.";
          }
        }
        const projected = projectRow(row, nextPatch);
        if (
          data.action === "force_complete_profile" ||
          data.action === "convert_placeholder_to_managed"
        ) {
          const savedRow = await loadProfileRowAfterUpdate(supabaseAdmin, row);
          const blockers = discoverabilityBlockers(savedRow, moderationById.get(row.id));
          let publicValidatorPassed = false;
          if (blockers.length === 0) {
            publicValidatorPassed = await publicProfileIsDiscoverable(supabaseAdmin, row.id);
            if (!publicValidatorPassed) {
              blockers.push({
                field: "public.profile_is_discoverable",
                reason: "database discoverability validator returned false",
              });
            }
          }

          if (publicValidatorPassed) {
            const { error: discoverableError } = await supabaseAdmin
              .from("profiles")
              .update({
                is_discoverable: true,
                onboarding_complete: true,
                discovery_blocked_reason: null,
                profile_completion_status: "complete",
                updated_at: new Date().toISOString(),
              } as never)
              .eq("id", row.id);
            if (discoverableError) {
              throw {
                error: discoverableError,
                query: `profiles.update(discoverable=true).eq("id", "${row.id}")`,
              };
            }
            if (!row.is_discoverable) madeDiscoverable += 1;
          } else {
            stillIncomplete += 1;
            skippedRows.push({
              id: row.id,
              name: row.display_name,
              reason: `Still blocked: ${blockers
                .map((blocker) => `${blocker.field}: ${blocker.reason}`)
                .join("; ")}`,
              remainingFields: blockers.map((blocker) => blocker.field),
            });
            if (savedRow?.is_discoverable) {
              const blockedReason = blockers[0]?.reason ?? "Not discoverable";
              await supabaseAdmin
                .from("profiles")
                .update({
                  is_discoverable: false,
                  discovery_blocked_reason: blockedReason,
                  profile_completion_status:
                    missingFields(savedRow).length > 0
                      ? "missing_required_fields"
                      : "not_discoverable",
                  updated_at: new Date().toISOString(),
                } as never)
                .eq("id", row.id);
            }
          }
        } else if (!row.is_discoverable && projected.is_discoverable) {
          madeDiscoverable += 1;
        }
        updated += 1;
      } catch (failure) {
        const typed = failure as { error?: unknown; query?: string; stage?: string };
        failures.push(
          repairFailureRow({
            row,
            stage: typed.stage ?? stage,
            query: typed.query ?? `bulk_${data.action}`,
            error: typed.error ?? failure,
          }),
        );
      }
    }

    const bulkAuditError = await writeAdminAuditWarning(supabaseAdmin, {
      actorId: context.userId,
      action: `bulk_${data.action}`,
      entityType: "profile",
      entityId: null,
      details: {
        selected: targetRows.length,
        selectedIds,
        updated,
        made_discoverable: madeDiscoverable,
        still_incomplete: stillIncomplete,
        failed: failures.length,
        failures,
        skipped: skippedRows.length,
        skippedRows,
        options: data.options,
        dry_run: Boolean(data.options.dryRun),
      },
    });
    if (bulkAuditError) auditWarning ??= "Audit logging failed for the bulk action summary.";

    const afterResult = await loadRealUsers(supabaseAdmin);
    const targetIdSet = new Set(targetRows.map((row) => row.id));
    const afterTargetRows = afterResult.rows.filter((row) => targetIdSet.has(row.id));
    return {
      ...afterResult,
      ok: true,
      action: data.action,
      processed: targetRows.length,
      updated,
      skipped: skippedRows.length,
      skippedRows,
      selectedIds,
      madeDiscoverable,
      stillIncomplete,
      failed: failures.length,
      failures,
      stillMissingAgeGender,
      nowDiscoverable: afterTargetRows.filter((row) => row.is_discoverable).length,
      notDiscoverable: afterTargetRows.filter((row) => !row.is_discoverable).length,
      blockedReasonCounts: blockedReasonCounts(skippedRows),
      stillBlockedByField: blockedFieldCounts(skippedRows),
      realUsersProcessed: convertingPlaceholders ? 0 : targetRows.length,
      managedProfilesSkipped: convertingPlaceholders ? 0 : managedSelectedRows.length,
      managedProfilesConverted: convertingPlaceholders ? updated : 0,
      auditWarning,
    };
  });

export const makeAllEligibleRealUsersDiscoverable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminRealProfileBulkResult> => {
    const supabaseAdmin = await assertAdmin(context);
    const beforeResult = await loadRealUsers(supabaseAdmin);
    const realRows = beforeResult.rows.filter((row) => !isManagedProfile(row));
    const managedProfilesSkipped = beforeResult.rows.length - realRows.length;
    const ids = realRows.map((row) => row.id);
    const { data: moderationRows } = await supabaseAdmin
      .from("user_moderation")
      .select("user_id, is_banned, banned_until")
      .in("user_id", ids);
    const moderationById = new Map<
      string,
      { is_banned: boolean | null; banned_until: string | null }
    >(
      (
        (moderationRows ?? []) as {
          user_id: string;
          is_banned: boolean | null;
          banned_until: string | null;
        }[]
      ).map((row) => [row.user_id, { is_banned: row.is_banned, banned_until: row.banned_until }]),
    );

    let updated = 0;
    const skippedRows: AdminRealProfileBulkSkipped[] = [];
    for (const row of realRows) {
      const reason = discoverEligibilitySkipReason(row, moderationById.get(row.id));
      if (reason) {
        skippedRows.push({ id: row.id, name: row.display_name, reason });
        continue;
      }
      if (row.is_discoverable) continue;
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({
          is_discoverable: true,
          onboarding_complete: true,
          discovery_blocked_reason: null,
          profile_completion_status: "complete",
        } as never)
        .eq("id", row.id);
      if (error) throw error;
      updated += 1;
    }

    await writeAdminAuditWarning(supabaseAdmin, {
      actorId: context.userId,
      action: "make_all_eligible_real_users_discoverable",
      entityType: "profile",
      entityId: null,
      details: { updated, skipped: skippedRows.length, skippedRows },
    });

    const afterResult = await loadRealUsers(supabaseAdmin);
    return {
      ...afterResult,
      ok: true,
      action: "make_all_eligible_discoverable",
      updated,
      skipped: skippedRows.length,
      skippedRows,
      blockedReasonCounts: blockedReasonCounts(skippedRows),
      stillBlockedByField: blockedFieldCounts(skippedRows),
      realUsersProcessed: realRows.length,
      managedProfilesSkipped,
      managedProfilesConverted: 0,
    };
  });
