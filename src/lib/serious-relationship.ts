export type TrustLevel = "low" | "medium" | "high" | "verified";

export const MARRIAGE_INTENTION_OPTIONS = [
  { value: "marriage", label: "Marriage" },
  { value: "lifelong_partnership", label: "Lifelong partnership" },
  { value: "open_to_marriage", label: "Open to marriage" },
] as const;

export const MARRIAGE_TIMELINE_OPTIONS = [
  { value: "within_1_year", label: "Within 1 year" },
  { value: "1_to_2_years", label: "1-2 years" },
  { value: "3_to_5_years", label: "3-5 years" },
  { value: "when_right", label: "When the relationship is right" },
] as const;

export const WANTS_CHILDREN_OPTIONS = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "open", label: "Open to it" },
] as const;

export const HAS_CHILDREN_OPTIONS = [
  { value: "no", label: "No children" },
  { value: "yes_at_home", label: "Yes, living with me" },
  { value: "yes_not_at_home", label: "Yes, not living with me" },
] as const;

export const FAITH_VALUES_IMPORTANCE_OPTIONS = [
  { value: "essential", label: "Essential" },
  { value: "important", label: "Important" },
  { value: "somewhat", label: "Somewhat important" },
  { value: "not_important", label: "Not important" },
] as const;

export const FAMILY_VALUES_OPTIONS = [
  { value: "traditional", label: "Traditional" },
  { value: "balanced", label: "Balanced" },
  { value: "independent", label: "Independent" },
  { value: "community_centered", label: "Community-centered" },
] as const;

export const RELOCATION_OPENNESS_OPTIONS = [
  { value: "yes", label: "Open to relocating" },
  { value: "maybe", label: "Maybe, for the right relationship" },
  { value: "no", label: "Not open to relocating" },
] as const;

export const COMMUNICATION_STYLE_OPTIONS = [
  { value: "direct", label: "Direct and clear" },
  { value: "reflective", label: "Thoughtful and reflective" },
  { value: "expressive", label: "Open and expressive" },
  { value: "calm", label: "Calm and measured" },
] as const;

export const CONFLICT_RESOLUTION_STYLE_OPTIONS = [
  { value: "talk_it_through", label: "Talk it through directly" },
  { value: "pause_then_discuss", label: "Pause, reflect, then discuss" },
  { value: "mediated", label: "Use trusted guidance when needed" },
  { value: "solution_focused", label: "Focus on practical next steps" },
] as const;

export const LOVE_LANGUAGE_OPTIONS = [
  { value: "quality_time", label: "Quality time" },
  { value: "words", label: "Words of affirmation" },
  { value: "acts", label: "Acts of service" },
  { value: "gifts", label: "Thoughtful gifts" },
  { value: "touch", label: "Physical touch" },
] as const;

export const WORK_LIFE_BALANCE_OPTIONS = [
  { value: "career_focused", label: "Career-focused season" },
  { value: "balanced", label: "Balanced routine" },
  { value: "family_first", label: "Family-first rhythm" },
  { value: "flexible", label: "Flexible and adaptive" },
] as const;

export const EDUCATION_IMPORTANCE_OPTIONS = [
  { value: "essential", label: "Essential" },
  { value: "important", label: "Important" },
  { value: "flexible", label: "Flexible" },
  { value: "not_important", label: "Not important" },
] as const;

export const FAITH_IMPORTANCE_OPTIONS = FAITH_VALUES_IMPORTANCE_OPTIONS;

export const CULTURE_BACKGROUND_OPTIONS = [
  { value: "african", label: "African" },
  { value: "diaspora", label: "Diaspora" },
  { value: "multicultural", label: "Multicultural" },
  { value: "western", label: "Western" },
  { value: "asian", label: "Asian" },
  { value: "middle_eastern", label: "Middle Eastern" },
  { value: "latin", label: "Latin" },
  { value: "prefer_not", label: "Prefer not to say" },
] as const;

export const PERSONALITY_TYPE_OPTIONS = [
  { value: "introvert", label: "Introvert" },
  { value: "ambivert", label: "Ambivert" },
  { value: "extrovert", label: "Extrovert" },
  { value: "analytical", label: "Analytical" },
  { value: "empathetic", label: "Empathetic" },
  { value: "adventurous", label: "Adventurous" },
] as const;

export const PARTNER_EXPECTATIONS_OPTIONS = [
  { value: "intentional_courtship", label: "Intentional courtship" },
  { value: "shared_values", label: "Shared values" },
  { value: "family_alignment", label: "Family alignment" },
  { value: "emotional_maturity", label: "Emotional maturity" },
  { value: "financial_responsibility", label: "Financial responsibility" },
] as const;

export const FUTURE_PLANS_OPTIONS = [
  { value: "build_family", label: "Build a family" },
  { value: "career_and_family", label: "Grow career and family" },
  { value: "travel_together", label: "Travel and build together" },
  { value: "settle_locally", label: "Settle locally" },
  { value: "open_to_paths", label: "Open to the right path" },
] as const;

export const DEALBREAKER_OPTIONS = [
  { value: "dishonesty", label: "Dishonesty" },
  { value: "disrespect", label: "Disrespect" },
  { value: "substance_misuse", label: "Substance misuse" },
  { value: "financial_irresponsibility", label: "Financial irresponsibility" },
  { value: "different_children_goals", label: "Different goals about children" },
  { value: "different_faith_values", label: "Incompatible faith or values" },
  { value: "none_declared", label: "No fixed dealbreakers" },
] as const;

export const HOBBY_OPTIONS = [
  { value: "travel", label: "Travel" },
  { value: "fitness", label: "Fitness" },
  { value: "faith_community", label: "Faith community" },
  { value: "cooking", label: "Cooking" },
  { value: "music", label: "Music" },
  { value: "reading", label: "Reading" },
  { value: "volunteering", label: "Volunteering" },
  { value: "outdoors", label: "Outdoors" },
] as const;

export const LONG_DISTANCE_OPENNESS_OPTIONS = [
  { value: "yes", label: "Open to long distance" },
  { value: "maybe", label: "Open with a clear plan" },
  { value: "no", label: "Local relationship only" },
] as const;

export const SERIOUS_PRIVACY_OPTIONS = [
  { value: "public", label: "Public" },
  { value: "matches", label: "Matches only" },
  { value: "private", label: "Private" },
] as const;

export type SeriousPrivacy = (typeof SERIOUS_PRIVACY_OPTIONS)[number]["value"];

export const SERIOUS_RELATIONSHIP_FIELDS = [
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
] as const;

export const SERIOUS_MULTI_VALUE_FIELDS = ["dealbreakers", "hobbies"] as const;

export type SeriousRelationshipField = (typeof SERIOUS_RELATIONSHIP_FIELDS)[number];

export type SeriousRelationshipProfile = Partial<Record<SeriousRelationshipField, unknown>>;

export type SeriousVisibilitySettings = Partial<Record<SeriousRelationshipField, SeriousPrivacy>>;

function fieldIsAnswered(
  profile: SeriousRelationshipProfile,
  field: SeriousRelationshipField,
): boolean {
  return SERIOUS_MULTI_VALUE_FIELDS.includes(field as (typeof SERIOUS_MULTI_VALUE_FIELDS)[number])
    ? Array.isArray(profile[field]) && profile[field].length > 0
    : typeof profile[field] === "string" && Boolean(profile[field]);
}

export function isSeriousProfileComplete(profile: SeriousRelationshipProfile): boolean {
  return SERIOUS_RELATIONSHIP_FIELDS.every((field) => fieldIsAnswered(profile, field));
}

export function seriousProfileCompletion(profile: SeriousRelationshipProfile): number {
  const answered = SERIOUS_RELATIONSHIP_FIELDS.filter((field) =>
    fieldIsAnswered(profile, field),
  ).length;
  return Math.round((answered / SERIOUS_RELATIONSHIP_FIELDS.length) * 100);
}

export function trustLevelLabel(level: TrustLevel | string | null | undefined) {
  if (level === "verified") return "Verified trust";
  if (level === "high") return "High trust";
  if (level === "medium") return "Medium trust";
  return "Building trust";
}

export function optionLabel(
  options: readonly { value: string; label: string }[],
  value: string | null | undefined,
) {
  return options.find((option) => option.value === value)?.label ?? value ?? "";
}
