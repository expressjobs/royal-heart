export const GENDER_VALUES = ["woman", "man", "nonbinary"] as const;

export type Gender = (typeof GENDER_VALUES)[number];

export const GENDER_OPTIONS: ReadonlyArray<{ value: Gender; label: string }> = [
  { value: "woman", label: "Woman" },
  { value: "man", label: "Man" },
  { value: "nonbinary", label: "Non-binary" },
];

const GENDER_ALIASES: Record<string, Gender> = {
  woman: "woman",
  women: "woman",
  female: "woman",
  man: "man",
  men: "man",
  male: "man",
  nonbinary: "nonbinary",
  "non-binary": "nonbinary",
  "non binary": "nonbinary",
};

export function normalizeGender(value: unknown): Gender | null {
  if (typeof value !== "string") return null;
  return GENDER_ALIASES[value.trim().toLowerCase()] ?? null;
}

export function genderPreferenceValue(value: unknown): string | null {
  const gender = normalizeGender(value);
  if (gender === "woman") return "women";
  if (gender === "man") return "men";
  return gender;
}
