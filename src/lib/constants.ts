export { GENDER_OPTIONS } from "@/lib/gender";

export const INTERESTED_IN_OPTIONS = [
  { value: "women", label: "Women" },
  { value: "men", label: "Men" },
  { value: "nonbinary", label: "Non-binary people" },
  { value: "everyone", label: "Everyone" },
] as const;

export const LANGUAGE_OPTIONS = [
  "English",
  "Spanish",
  "French",
  "German",
  "Portuguese",
  "Italian",
  "Swahili",
  "Arabic",
  "Hindi",
  "Mandarin",
  "Japanese",
  "Korean",
  "Russian",
  "Dutch",
  "Turkish",
  "Yoruba",
  "Zulu",
  "Amharic",
] as const;

export const RELIGION_OPTIONS = [
  { value: "christian", label: "Christian" },
  { value: "muslim", label: "Muslim" },
  { value: "jewish", label: "Jewish" },
  { value: "hindu", label: "Hindu" },
  { value: "buddhist", label: "Buddhist" },
  { value: "spiritual", label: "Spiritual" },
  { value: "agnostic", label: "Agnostic" },
  { value: "atheist", label: "Atheist" },
  { value: "other", label: "Other" },
  { value: "prefer_not", label: "Prefer not to say" },
] as const;

export const EDUCATION_OPTIONS = [
  { value: "high_school", label: "High school" },
  { value: "in_college", label: "In college" },
  { value: "associate", label: "Associate degree" },
  { value: "bachelor", label: "Bachelor's degree" },
  { value: "master", label: "Master's degree" },
  { value: "doctorate", label: "Doctorate" },
  { value: "trade", label: "Trade school" },
  { value: "other", label: "Other" },
] as const;

export const RELATIONSHIP_GOAL_OPTIONS = [
  { value: "long_term", label: "Long-term partner" },
  { value: "long_term_open", label: "Long-term, open to short" },
  { value: "short_term", label: "Short-term fun" },
  { value: "short_term_open", label: "Short-term, open to long" },
  { value: "new_friends", label: "New friends" },
  { value: "still_figuring", label: "Still figuring it out" },
] as const;

export const SMOKING_OPTIONS = [
  { value: "never", label: "Never" },
  { value: "socially", label: "Socially" },
  { value: "regularly", label: "Regularly" },
  { value: "trying_to_quit", label: "Trying to quit" },
  { value: "prefer_not", label: "Prefer not to say" },
] as const;

export const DRINKING_OPTIONS = [
  { value: "never", label: "Never" },
  { value: "socially", label: "Socially" },
  { value: "regularly", label: "Regularly" },
  { value: "sober", label: "Sober" },
  { value: "prefer_not", label: "Prefer not to say" },
] as const;

export const WORKOUT_OPTIONS = [
  { value: "never", label: "Never" },
  { value: "sometimes", label: "Sometimes" },
  { value: "often", label: "Often" },
  { value: "daily", label: "Every day" },
] as const;

export const FAMILY_PLANS_OPTIONS = [
  { value: "want_kids", label: "Want kids" },
  { value: "dont_want", label: "Don't want kids" },
  { value: "have_kids", label: "Have kids" },
  { value: "open", label: "Open to kids" },
  { value: "not_sure", label: "Not sure yet" },
] as const;

export const PETS_OPTIONS = [
  { value: "dog", label: "Dog" },
  { value: "cat", label: "Cat" },
  { value: "both", label: "Dog & cat" },
  { value: "other", label: "Other pet" },
  { value: "none", label: "No pets" },
  { value: "want", label: "Want a pet" },
] as const;

export const PROFESSION_OPTIONS = [
  { value: "tech", label: "Technology" },
  { value: "healthcare", label: "Healthcare" },
  { value: "education", label: "Education" },
  { value: "finance", label: "Finance" },
  { value: "engineering", label: "Engineering" },
  { value: "arts", label: "Arts & Media" },
  { value: "business", label: "Business" },
  { value: "legal", label: "Legal" },
  { value: "hospitality", label: "Hospitality" },
  { value: "trades", label: "Skilled trades" },
  { value: "government", label: "Government" },
  { value: "student", label: "Student" },
  { value: "entrepreneur", label: "Entrepreneur" },
  { value: "other", label: "Other" },
] as const;

export function labelFor(
  options: readonly { value: string; label: string }[],
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  return options.find((o) => o.value === value)?.label ?? value;
}

export const REPORT_REASONS = [
  "Fake profile or scam",
  "Inappropriate photos",
  "Harassment or abuse",
  "Offensive messages",
  "Underage user",
  "Spam or solicitation",
  "Other",
] as const;
