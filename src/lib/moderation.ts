import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { audit } from "@/lib/admin.functions";

export type ReportCategory = Database["public"]["Enums"]["report_category"];
export type ReportSeverity = Database["public"]["Enums"]["report_severity"];
export type ReportStatus = Database["public"]["Enums"]["report_status"];

/** Enriched moderation queue row returned by the `moderation_reports` RPC. */
export type ModerationReport =
  Database["public"]["Functions"]["moderation_reports"]["Returns"][number];

export type ModerationActivity =
  Database["public"]["Functions"]["moderation_activity"]["Returns"][number];

export interface ModerationStats {
  pending: number;
  reviewing: number;
  resolved: number;
  dismissed: number;
  critical: number;
  resolved_today: number;
  suspended: number;
  banned: number;
  warnings_7d: number;
  by_category: Record<string, number>;
}

export const CATEGORY_LABELS: Record<ReportCategory, string> = {
  profile: "Profile",
  photo: "Photo",
  message: "Message",
  scam: "Scam / Fraud",
  fake_profile: "Fake profile",
  harassment: "Harassment",
  abuse: "Abuse",
  spam: "Spam",
  underage: "Underage",
  other: "Other",
};

export const CATEGORY_ORDER: ReportCategory[] = [
  "scam",
  "fake_profile",
  "harassment",
  "abuse",
  "message",
  "photo",
  "profile",
  "spam",
  "underage",
  "other",
];

export const SEVERITY_LABELS: Record<ReportSeverity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const SEVERITY_ORDER: ReportSeverity[] = ["low", "medium", "high", "critical"];

/** Tailwind classes for severity badges (semantic tokens / safe palette utilities). */
export const SEVERITY_BADGE: Record<ReportSeverity, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  high: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  critical: "bg-destructive/10 text-destructive",
};

export const STATUS_LABELS: Record<ReportStatus, string> = {
  pending: "Pending",
  reviewed: "Reviewing",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

export const STATUS_ORDER: ReportStatus[] = ["pending", "reviewed", "resolved", "dismissed"];

/**
 * Maps the free-text reason picked in the report dialog to a structured
 * category + default severity so reports arrive pre-classified.
 */
export function classifyReason(reason: string): {
  category: ReportCategory;
  severity: ReportSeverity;
} {
  const r = reason.toLowerCase();
  if (r.includes("underage")) return { category: "underage", severity: "critical" };
  if (r.includes("scam") || r.includes("fake")) return { category: "scam", severity: "high" };
  if (r.includes("harass") || r.includes("abuse"))
    return { category: "harassment", severity: "high" };
  if (r.includes("photo")) return { category: "photo", severity: "medium" };
  if (r.includes("message") || r.includes("offensive"))
    return { category: "message", severity: "medium" };
  if (r.includes("spam") || r.includes("solicit")) return { category: "spam", severity: "low" };
  return { category: "other", severity: "medium" };
}

/** Keywords that flag a message for moderator attention. */
const ABUSIVE_KEYWORDS = [
  "kill",
  "die",
  "rape",
  "whore",
  "slut",
  "bitch",
  "retard",
  "nazi",
  "faggot",
  "kys",
  "idiot",
  "stupid",
  "ugly",
];

const SCAM_KEYWORDS = [
  "western union",
  "bitcoin",
  "btc",
  "crypto",
  "gift card",
  "itunes",
  "wire transfer",
  "investment",
  "telegram",
  "whatsapp",
  "cashapp",
  "venmo",
  "paypal me",
  "send money",
  "bank account",
  "inheritance",
];

const LINK_RE = /\b(?:https?:\/\/|www\.)\S+|\b[\w.-]+\.(?:com|net|org|io|ru|xyz|info)\b/i;

export type MessageFlag = "abusive" | "scam" | "link";

/** Returns the set of safety flags raised for a single message body. */
export function scanMessage(text: string): MessageFlag[] {
  const t = (text ?? "").toLowerCase();
  const flags: MessageFlag[] = [];
  if (ABUSIVE_KEYWORDS.some((k) => t.includes(k))) flags.push("abusive");
  if (SCAM_KEYWORDS.some((k) => t.includes(k))) flags.push("scam");
  if (LINK_RE.test(text ?? "")) flags.push("link");
  return flags;
}

export const FLAG_LABELS: Record<MessageFlag, string> = {
  abusive: "Abusive language",
  scam: "Possible scam",
  link: "External link",
};

/** Short safety guidance shown to the user for each flag type. */
export const FLAG_HINTS: Record<MessageFlag, string> = {
  abusive: "This message may contain abusive or hateful language.",
  scam: "This looks like it could be a scam. Never send money or share financial details.",
  link: "This message contains an external link. Be cautious opening links from new matches.",
};

/** Maps a detected safety flag to the report reason that best matches it. */
export const FLAG_REPORT_REASON: Record<MessageFlag, string> = {
  abusive: "Harassment or abuse",
  scam: "Fake profile or scam",
  link: "Spam or solicitation",
};

// ---------------------------------------------------------------------------
// Link & image safety analysis (client-side heuristics)
// ---------------------------------------------------------------------------

/** URL extractor — captures bare domains and full http(s)/www links. */
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s]+|\b[\w-]+(?:\.[\w-]+)+(?:\/[^\s]*)?/gi;

const IMAGE_EXT_RE = /\.(?:jpe?g|png|gif|webp|bmp|svg|avif|heic|tiff?)(?:[?#]|$)/i;

/** Common URL shorteners — links here hide their true destination. */
const SHORTENERS = [
  "bit.ly",
  "tinyurl.com",
  "goo.gl",
  "t.co",
  "ow.ly",
  "is.gd",
  "buff.ly",
  "rebrand.ly",
  "cutt.ly",
  "shorturl.at",
  "rb.gy",
  "t.me",
  "tiny.cc",
];

/** TLDs disproportionately used for spam, scams, and malware. */
const SUSPICIOUS_TLDS = [
  "ru",
  "xyz",
  "top",
  "click",
  "link",
  "gq",
  "tk",
  "ml",
  "cf",
  "ga",
  "work",
  "zip",
  "mov",
  "country",
  "kim",
  "loan",
  "men",
  "date",
];

/** Words that, inside a URL, strongly suggest a phishing/scam destination. */
const RISKY_URL_KEYWORDS = [
  "login",
  "verify",
  "wallet",
  "crypto",
  "bitcoin",
  "gift",
  "free",
  "bonus",
  "prize",
  "winner",
  "account-",
  "secure-",
  "paypal",
  "bank",
];

export type LinkRisk = "safe" | "caution" | "blocked";

export interface LinkAnalysis {
  url: string;
  href: string;
  host: string;
  isImage: boolean;
  risk: LinkRisk;
  reasons: string[];
}

/** Pulls every distinct URL-like token out of a message body. */
export function extractUrls(text: string): string[] {
  const matches = (text ?? "").match(URL_RE) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of matches) {
    const cleaned = raw.replace(/[.,!?;:)\]]+$/, "");
    const key = cleaned.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(cleaned);
    }
  }
  return out;
}

function toHref(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url.replace(/^\/\//, "")}`;
}

/**
 * Heuristically classifies a single URL for safety. Pure and synchronous —
 * deep image-content scanning is handled separately by `scanImageContent`.
 */
export function analyzeUrl(url: string): LinkAnalysis {
  const href = toHref(url);
  const reasons: string[] = [];
  let host = "";
  let pathname = "";
  let usesTls = true;
  try {
    const u = new URL(href);
    host = u.hostname.toLowerCase();
    pathname = u.pathname.toLowerCase();
    usesTls = u.protocol === "https:";
  } catch {
    host = url.toLowerCase();
  }

  const isImage = IMAGE_EXT_RE.test(pathname) || IMAGE_EXT_RE.test(url);
  const bareHost = host.replace(/^www\./, "");
  const tld = bareHost.split(".").pop() ?? "";
  let risk: LinkRisk = "safe";

  const escalate = (next: LinkRisk) => {
    const rank: Record<LinkRisk, number> = { safe: 0, caution: 1, blocked: 2 };
    if (rank[next] > rank[risk]) risk = next;
  };

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(bareHost)) {
    reasons.push("Links to a raw IP address");
    escalate("blocked");
  }
  if (host.includes("xn--")) {
    reasons.push("Uses a disguised (punycode) domain");
    escalate("blocked");
  }
  if (href.includes("@")) {
    reasons.push("Hides the real destination with embedded credentials");
    escalate("blocked");
  }
  if (SHORTENERS.includes(bareHost)) {
    reasons.push("Shortened link hides its true destination");
    escalate("caution");
  }
  if (SUSPICIOUS_TLDS.includes(tld)) {
    reasons.push(`Uses a high-risk “.${tld}” domain`);
    escalate("caution");
  }
  if (RISKY_URL_KEYWORDS.some((k) => href.toLowerCase().includes(k))) {
    reasons.push("Contains phishing-style keywords");
    escalate("caution");
  }
  if (!usesTls) {
    reasons.push("Not a secure (https) link");
    escalate("caution");
  }

  return { url, href, host: bareHost || host, isImage, risk, reasons };
}

/** True when a message contains at least one URL classified as risky. */
export function hasRiskyLink(text: string): boolean {
  return extractUrls(text).some((u) => analyzeUrl(u).risk !== "safe");
}

export const LINK_RISK_LABELS: Record<LinkRisk, string> = {
  safe: "Link",
  caution: "Risky link",
  blocked: "Dangerous link",
};

// ---------------------------------------------------------------------------
// Image content moderation verdicts (returned by the scanImageContent server fn)
// ---------------------------------------------------------------------------

export type ImageVerdict = "safe" | "flagged" | "prohibited";

export interface ImageScanResult {
  verdict: ImageVerdict;
  categories: string[];
  reason: string;
}

/** Whether a moderation row currently counts as an active suspension/ban. */
export function isActiveBan(isBanned: boolean, until: string | null): boolean {
  if (!isBanned) return false;
  return !until || new Date(until) > new Date();
}

// ---------------------------------------------------------------------------
// Data access
// ---------------------------------------------------------------------------

export async function fetchModerationReports(): Promise<ModerationReport[]> {
  const { data, error } = await supabase.rpc("moderation_reports");
  if (error) throw error;
  return data ?? [];
}

export async function fetchModerationStats(): Promise<ModerationStats> {
  const { data, error } = await supabase.rpc("moderation_stats");
  if (error) throw error;
  const json = (data ?? {}) as Partial<ModerationStats>;
  return {
    pending: json.pending ?? 0,
    reviewing: json.reviewing ?? 0,
    resolved: json.resolved ?? 0,
    dismissed: json.dismissed ?? 0,
    critical: json.critical ?? 0,
    resolved_today: json.resolved_today ?? 0,
    suspended: json.suspended ?? 0,
    banned: json.banned ?? 0,
    warnings_7d: json.warnings_7d ?? 0,
    by_category: (json.by_category ?? {}) as Record<string, number>,
  };
}

export async function fetchModerationActivity(limit = 60): Promise<ModerationActivity[]> {
  const { data, error } = await supabase.rpc("moderation_activity", { _limit: limit });
  if (error) throw error;
  return data ?? [];
}

export type ModerationAction = "suspend7" | "suspend30" | "ban" | "restore";

const BAN_PAYLOAD: Record<
  ModerationAction,
  { is_banned: boolean; banned_until: string | null; ban_reason: string | null }
> = {
  suspend7: {
    is_banned: true,
    banned_until: new Date(Date.now() + 7 * 86400000).toISOString(),
    ban_reason: "Suspended 7 days by moderation",
  },
  suspend30: {
    is_banned: true,
    banned_until: new Date(Date.now() + 30 * 86400000).toISOString(),
    ban_reason: "Suspended 30 days by moderation",
  },
  ban: { is_banned: true, banned_until: null, ban_reason: "Permanently banned by moderation" },
  restore: { is_banned: false, banned_until: null, ban_reason: null },
};

export async function moderateUser(userId: string, action: ModerationAction): Promise<void> {
  const payload = BAN_PAYLOAD[action];
  const { error } = await supabase
    .from("user_moderation")
    .upsert({ user_id: userId, ...payload }, { onConflict: "user_id" });
  if (error) throw error;
  audit({ action: `moderation.${action}`, entityType: "user", entityId: userId });
}

export async function warnUser(
  userId: string,
  issuedBy: string,
  reason: string,
  severity: ReportSeverity,
  reportId?: string | null,
): Promise<void> {
  const { error } = await supabase.from("user_warnings").insert({
    user_id: userId,
    issued_by: issuedBy,
    reason: reason.slice(0, 500),
    severity,
    report_id: reportId ?? null,
  });
  if (error) throw error;
  audit({ action: "moderation.warn", entityType: "user", entityId: userId, details: { severity } });
}

export async function updateReport(
  id: string,
  patch: Partial<{
    status: ReportStatus;
    severity: ReportSeverity;
    category: ReportCategory;
    assigned_to: string | null;
    resolution_note: string | null;
    resolved_by: string | null;
    resolved_at: string | null;
  }>,
): Promise<void> {
  const { error } = await supabase.from("reports").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteReportedContent(
  contentType: string,
  contentId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("moderation_delete_content", {
    _content_type: contentType,
    _content_id: contentId,
  });
  if (error) throw error;
  return Boolean(data);
}
