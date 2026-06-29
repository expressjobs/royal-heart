import { seriousProfileCompletion } from "@/lib/serious-relationship";

export const COUNTRY_CODES = [
  { code: "+1", country: "US / CA" },
  { code: "+44", country: "UK" },
  { code: "+234", country: "NG" },
  { code: "+254", country: "KE" },
  { code: "+27", country: "ZA" },
  { code: "+233", country: "GH" },
  { code: "+91", country: "IN" },
  { code: "+61", country: "AU" },
  { code: "+49", country: "DE" },
  { code: "+33", country: "FR" },
];

const DISPOSABLE_DOMAINS = new Set([
  "10minutemail.com",
  "guerrillamail.com",
  "mailinator.com",
  "tempmail.com",
  "temp-mail.org",
  "yopmail.com",
  "throwawaymail.com",
  "getnada.com",
  "sharklasers.com",
  "trashmail.com",
]);

export function emailDomain(email: string): string {
  return email.trim().toLowerCase().split("@")[1] ?? "";
}

export function isDisposableEmail(email: string): boolean {
  const domain = emailDomain(email);
  return DISPOSABLE_DOMAINS.has(domain);
}

export function isAtLeast18(dateStr: string): boolean {
  const birth = new Date(dateStr);
  if (Number.isNaN(birth.getTime())) return false;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 18);
  return birth <= cutoff;
}

export function maxAdultBirthDate() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().split("T")[0];
}

export function passwordChecks(password: string) {
  return {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /\d/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };
}

export function passwordStrength(password: string) {
  const checks = passwordChecks(password);
  const passed = Object.values(checks).filter(Boolean).length;
  return {
    checks,
    score: passed,
    percent: (passed / 5) * 100,
    label: passed <= 2 ? "Weak" : passed === 3 || passed === 4 ? "Good" : "Strong",
    valid: passed === 5 && password.length <= 72,
  };
}

export function missingDiscoveryRequirements(input: {
  display_name?: string | null;
  birth_date?: string | null;
  gender?: string | null;
  interested_in?: string[] | null;
  relationship_goal?: string | null;
  location_city?: string | null;
  location_country?: string | null;
  safety_agreement_accepted_at?: string | null;
  terms_accepted_at?: string | null;
  privacy_accepted_at?: string | null;
  photoCount?: number;
}) {
  const missing: string[] = [];
  if (!input.display_name || input.display_name.trim().length < 2) missing.push("Name");
  if (!input.birth_date || !isAtLeast18(input.birth_date)) missing.push("Age 18+");
  if (!input.gender) missing.push("Gender");
  if (!input.interested_in?.length) missing.push("Interested in");
  if (!input.relationship_goal) missing.push("Relationship goal");
  if (!input.location_city || !input.location_country) missing.push("City and country");
  if (!input.safety_agreement_accepted_at) missing.push("Safety agreement");
  if (!input.terms_accepted_at || !input.privacy_accepted_at) missing.push("Terms and privacy");
  if (!input.photoCount) missing.push("Profile photo");
  return missing;
}

export function profileCompletion(
  input: Parameters<typeof missingDiscoveryRequirements>[0] & {
    bio?: string | null;
    interests?: string[] | null;
    marriage_intention?: string | null;
    marriage_timeline?: string | null;
    wants_children?: string | null;
    has_children?: string | null;
    faith_or_values_importance?: string | null;
    family_values?: string | null;
    relocation_openness?: string | null;
    communication_style?: string | null;
    dealbreakers?: string[] | null;
    long_distance_openness?: string | null;
    parenting_preferences?: string | null;
    conflict_resolution_style?: string | null;
    love_language?: string | null;
    work_life_balance?: string | null;
    education_importance?: string | null;
    faith_importance?: string | null;
    culture_background?: string | null;
    personality_type?: string | null;
    hobbies?: string[] | null;
    partner_expectations?: string | null;
    future_plans?: string | null;
  },
) {
  let score = 0;
  if (input.display_name && input.display_name.trim().length >= 2) score += 10;
  if (input.birth_date && isAtLeast18(input.birth_date)) score += 10;
  if (input.gender) score += 10;
  if (input.interested_in?.length) score += 10;
  if (input.relationship_goal) score += 10;
  if (input.location_city) score += 8;
  if (input.location_country) score += 8;
  if (input.photoCount) score += 12;
  if (input.bio && input.bio.trim().length >= 40) score += 10;
  if ((input.interests?.length ?? 0) >= 3) score += 7;
  if (input.safety_agreement_accepted_at) score += 5;
  const seriousScore = seriousProfileCompletion(input);
  if (seriousScore === 0) return Math.min(score, 100);
  return Math.min(Math.round(score * 0.6 + seriousScore * 0.4), 100);
}
