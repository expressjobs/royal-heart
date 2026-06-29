import { createServerFn } from "@tanstack/react-start";
import JSZip from "jszip";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { requireServerAdmin } from "@/lib/server-auth";
import { writeAdminAuditWarning } from "@/lib/admin-audit";
import { getImageInfo, type ImageFormat } from "./image-validation";
import { DEMO_CITY_LIBRARY, DEMO_NAME_LIBRARY, generateDemoProfile } from "@/lib/demo-profile-data";

type MembershipTier = Database["public"]["Enums"]["membership_tier"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"] & {
  is_active?: boolean;
  is_discoverable?: boolean;
  discovery_blocked_reason?: string | null;
  profile_completion_score?: number;
};

const BUCKET = "profile-photos";
const ACCEPTED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_IMPORT_FILE_BYTES = 200 * 1024 * 1024;
const MAX_IMPORT_ITEMS = 100000;
const MAX_PHOTO_IMPORT_ITEMS = 20000;
const EXT_BY_FORMAT: Record<ImageFormat, string> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
};
const DATASET_TYPES = [
  "photo_library",
  "names",
  "male_names",
  "female_names",
  "countries",
  "cities",
  "occupations",
  "education",
  "universities",
  "companies",
  "interests",
  "bio_templates",
  "languages",
  "religions",
] as const;

type DatasetType = (typeof DATASET_TYPES)[number];
type SerializableSummary = Record<string, string | number | boolean | null | string[] | undefined>;
type DatasetImportLogLevel = "log" | "warn" | "error";
type NormalizedDatasetItem = {
  dataset_type: DatasetType;
  country: string | null;
  gender: "male" | "female" | null;
  value: string;
  label: string | null;
  metadata: Record<string, unknown>;
  enabled: boolean;
};

export interface DemoPhotoRow {
  id: string;
  url: string;
  storage_path: string | null;
  is_primary: boolean;
  position: number;
}

type DemoPhotoPool = "male" | "female" | "neutral";

export interface DemoLibraryPhoto {
  name: string;
  path: string;
  gender: DemoPhotoPool;
  used: boolean;
}

export interface DemoUserRow {
  id: string;
  is_demo_profile: boolean;
  display_name: string | null;
  birth_date: string | null;
  gender: string | null;
  interested_in: string[];
  location_country: string | null;
  location_city: string | null;
  bio: string | null;
  profession: string | null;
  religion: string | null;
  education: string | null;
  relationship_goal: string | null;
  interests: string[];
  languages: string[];
  latitude: number | null;
  longitude: number | null;
  last_active: string;
  is_verified: boolean;
  membership_tier: MembershipTier;
  is_active: boolean;
  is_discoverable?: boolean;
  incognito: boolean;
  discovery_blocked_reason: string | null;
  onboarding_complete: boolean;
  profile_completion_score: number;
  photos: DemoPhotoRow[];
}

export interface SaveDemoUserInput {
  id?: string | null;
  displayName: string;
  age: number;
  gender: string;
  interestedIn: string[];
  country: string;
  city: string;
  bio: string;
  occupation: string;
  religion: string;
  education: string;
  relationshipGoal: string;
  interests: string[];
  languages: string[];
  latitude: number | null;
  longitude: number | null;
  lastActive: string;
  isVerified: boolean;
  membershipTier: MembershipTier;
  isActive: boolean;
}

export interface BulkDemoGeneratorInput {
  gender: "Male" | "Female" | "Mixed";
  country: string;
  count: number;
  allowPhotoReuse: boolean;
  verified: boolean;
  premium: boolean;
  active: boolean;
  discoverVisible?: boolean;
  locationMode?: "all" | "countries" | "cities" | "region";
  countries?: string[];
  cities?: string[];
  region?: string;
  coordinatesOnly?: boolean;
  minAge?: number;
  maxAge?: number;
  verificationPercent?: number;
  premiumPercent?: number;
  freePercent?: number;
  goldPercent?: number;
  platinumPercent?: number;
  batchName?: string;
  photoSource?: "library" | "zip" | "placeholder" | "mixed";
  useImportedOnly?: boolean;
}

export type DemoBulkAction =
  | "show"
  | "hide"
  | "delete"
  | "convert"
  | "tier"
  | "verified"
  | "fill_photos"
  | "repair_discover_fields";

export interface DemoBulkActionInput {
  ids: string[];
  action: DemoBulkAction;
  tier?: MembershipTier;
  verified?: boolean;
}

export interface DemoDatasetImportRow {
  id: string;
  dataset_type: DatasetType;
  name: string;
  status: string;
  enabled: boolean;
  total_rows: number;
  valid_rows: number;
  error_count: number;
  summary: SerializableSummary;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
}

export interface DemoDatasetItemRow {
  id: string;
  import_id: string | null;
  dataset_type: DatasetType;
  country: string | null;
  gender: "male" | "female" | null;
  value: string;
  label: string | null;
  metadata?: SerializableSummary;
  enabled: boolean;
  created_at: string;
  last_used_at: string | null;
}

export interface DemoDatasetStats {
  photosTotal: number;
  malePhotos: number;
  femalePhotos: number;
  totalRecords: number;
  countries: number;
  cities: number;
  names: number;
  occupations: number;
  education: number;
  universities: number;
  companies: number;
  interests: number;
  bioTemplates: number;
  languages: number;
  religions: number;
  estimatedUniqueProfiles: number;
}

export interface DemoBatchRow {
  id: string;
  name: string;
  status: string;
  requested_count: number;
  created_count: number;
  visible_count: number;
  hidden_count: number;
  without_photos: number;
  duplicate_count: number;
  error_count: number;
  source_datasets: SerializableSummary;
  generation_settings: SerializableSummary;
  created_at: string;
  updated_at: string;
}

export interface DemoDatasetOverview {
  imports: DemoDatasetImportRow[];
  preview: DemoDatasetItemRow[];
  stats: DemoDatasetStats;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function datasetImportLog(
  level: DatasetImportLogLevel,
  event: string,
  details: Record<string, unknown> = {},
) {
  const payload = {
    event,
    ...details,
  };
  const message = `[demo-dataset-import] ${event}`;
  if (level === "error") console.error(message, payload);
  else if (level === "warn") console.warn(message, payload);
  else console.log(message, payload);
}

function cleanText(value: unknown, max = 500): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanStringArray(value: unknown, max = 20): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanText(item, 60))
    .filter(Boolean)
    .slice(0, max);
}

function cleanTier(value: unknown): MembershipTier {
  if (value === "premium" || value === "gold") return "gold";
  return value === "platinum" ? "platinum" : "free";
}

function normalizeColumnName(value: string): string {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

const FIELD_ALIASES = {
  city: ["city", "name", "place_name", "ascii_name", "value"],
  country: ["country", "country_name", "country_code", "country_iso2", "iso2"],
  latitude: ["lat", "latitude"],
  longitude: ["lng", "lon", "longitude"],
  name: ["full_name", "name", "first_name", "value"],
  occupation: ["occupation", "profession", "title", "name", "job", "value"],
  interest: ["interest", "name", "hobby", "value"],
  bioTemplate: ["bio_template", "bio", "template", "text", "value"],
  language: ["language", "name", "value"],
  religion: ["religion", "name", "value"],
  university: ["university", "name", "school", "education", "value"],
  company: ["company", "name", "employer", "value"],
} as const;

type GeneratedDatasetMapping = {
  headers: readonly string[];
  value: readonly string[];
  country: readonly string[];
};

const GENERATED_DATASET_MAPPINGS: Partial<Record<DatasetType, GeneratedDatasetMapping>> = {
  countries: {
    headers: [
      "iso2",
      "iso3",
      "name",
      "official_name",
      "region",
      "subregion",
      "capital",
      "latitude",
      "longitude",
      "population",
      "languages",
      "priority_market",
      "source",
    ],
    value: ["name"],
    country: ["iso2"],
  },
  cities: {
    headers: [
      "geoname_id",
      "name",
      "ascii_name",
      "country_iso2",
      "state_province",
      "latitude",
      "longitude",
      "population",
      "timezone",
      "source",
    ],
    value: ["name", "ascii_name"],
    country: ["country_iso2"],
  },
  male_names: {
    headers: ["name", "country_iso2", "popularity_count", "source_item", "source"],
    value: ["name"],
    country: ["country_iso2"],
  },
  female_names: {
    headers: ["name", "country_iso2", "popularity_count", "source_item", "source"],
    value: ["name"],
    country: ["country_iso2"],
  },
  occupations: {
    headers: ["name", "source_item", "source"],
    value: ["name"],
    country: [],
  },
  interests: {
    headers: ["name", "category", "source_item", "source"],
    value: ["name"],
    country: [],
  },
  bio_templates: {
    headers: ["template_id", "template", "variables", "tone", "source"],
    value: ["template"],
    country: [],
  },
  languages: {
    headers: ["name", "iso6391", "iso6392", "source_item", "source"],
    value: ["name"],
    country: [],
  },
  religions: {
    headers: ["name", "source_item", "source"],
    value: ["name"],
    country: [],
  },
  universities: {
    headers: ["name", "country_iso2", "domains", "web_pages", "source_item", "source"],
    value: ["name"],
    country: ["country_iso2"],
  },
  companies: {
    headers: ["name", "country_iso2", "ticker", "source_item", "source"],
    value: ["name"],
    country: ["country_iso2"],
  },
} as const;

function headersForRows(rows: Record<string, unknown>[]) {
  return Object.keys(rows[0] ?? {}).map((key) => normalizeColumnName(key));
}

function cleanDatasetType(value: unknown): DatasetType | "auto" {
  if (DATASET_TYPES.includes(value as DatasetType)) return value as DatasetType;
  if (value === "auto") return "auto";
  throw new Error("Choose a supported dataset type.");
}

function detectDatasetType(
  fileName: string,
  requested: DatasetType | "auto",
  rows: Record<string, unknown>[] = [],
): DatasetType {
  if (requested !== "auto") return requested;
  const normalized = fileName.toLowerCase().replace(/\\/g, "/").split("/").pop() ?? fileName;
  if (normalized.endsWith(".zip")) return "photo_library";
  const base = normalized.replace(/\.(csv|json)$/i, "");
  const singularBase = base.endsWith("s") ? base.slice(0, -1) : base;
  const byFile: Record<string, DatasetType> = {
    countries: "countries",
    country: "countries",
    cities: "cities",
    city: "cities",
    male_names: "male_names",
    male_name: "male_names",
    female_names: "female_names",
    female_name: "female_names",
    occupations: "occupations",
    occupation: "occupations",
    interests: "interests",
    interest: "interests",
    bio_templates: "bio_templates",
    bio_template: "bio_templates",
    languages: "languages",
    language: "languages",
    religions: "religions",
    religion: "religions",
    universities: "universities",
    university: "universities",
    companies: "companies",
    company: "companies",
  };
  if (byFile[base]) return byFile[base];
  if (byFile[singularBase]) return byFile[singularBase];

  const columns = new Set(Object.keys(rows[0] ?? {}).map((key) => normalizeColumnName(key)));
  if (
    columns.has("bio_template") ||
    columns.has("template") ||
    columns.has("template_id") ||
    columns.has("tone") ||
    columns.has("text")
  ) {
    return "bio_templates";
  }
  if (
    columns.has("geoname_id") ||
    columns.has("ascii_name") ||
    columns.has("timezone") ||
    columns.has("place_name")
  ) {
    return "cities";
  }
  if (columns.has("official_name") || columns.has("iso3") || columns.has("capital")) {
    return "countries";
  }
  if (columns.has("iso6391") || columns.has("iso6392")) return "languages";
  if (columns.has("ticker")) return "companies";
  if (columns.has("domains") || columns.has("web_pages")) return "universities";
  if (columns.has("category")) return "interests";
  if (columns.has("religion")) return "religions";
  if (
    columns.has("occupation") ||
    columns.has("profession") ||
    columns.has("title") ||
    columns.has("job")
  ) {
    return "occupations";
  }
  if (columns.has("gender") || columns.has("sex")) return "names";
  if (base.includes("female")) return "female_names";
  if (base.includes("male")) return "male_names";
  throw new Error("Could not detect the dataset type. Choose a type and try again.");
}

function cleanBulkInput(data: BulkDemoGeneratorInput): BulkDemoGeneratorInput {
  const count = Number(data.count);
  const minAge = Number(data.minAge ?? 18);
  const maxAge = Number(data.maxAge ?? 60);
  const verificationPercent = Number(data.verificationPercent ?? (data.verified ? 35 : 0));
  const premiumPercent = Number(data.premiumPercent ?? (data.premium ? 25 : 0));
  const goldPercent = Number(data.goldPercent ?? 0);
  const platinumPercent = Number(data.platinumPercent ?? 0);
  return {
    gender: data.gender === "Male" || data.gender === "Female" ? data.gender : "Mixed",
    country: cleanText(data.country, 80) || "Any supported country",
    count: Number.isFinite(count) ? Math.min(Math.max(Math.trunc(count), 1), 1000) : 50,
    allowPhotoReuse: Boolean(data.allowPhotoReuse),
    verified: Boolean(data.verified),
    premium: Boolean(data.premium),
    active: Boolean(data.active),
    discoverVisible:
      data.discoverVisible == null ? Boolean(data.active) : Boolean(data.discoverVisible),
    locationMode:
      data.locationMode === "countries" ||
      data.locationMode === "cities" ||
      data.locationMode === "region"
        ? data.locationMode
        : "all",
    countries: Array.isArray(data.countries)
      ? data.countries
          .map((value) => cleanText(value, 80))
          .filter(Boolean)
          .slice(0, 50)
      : [],
    cities: Array.isArray(data.cities)
      ? data.cities
          .map((value) => cleanText(value, 120))
          .filter(Boolean)
          .slice(0, 100)
      : [],
    region: cleanText(data.region, 80),
    coordinatesOnly: Boolean(data.coordinatesOnly),
    minAge: Number.isFinite(minAge) ? Math.min(Math.max(Math.trunc(minAge), 18), 90) : 18,
    maxAge: Number.isFinite(maxAge) ? Math.min(Math.max(Math.trunc(maxAge), 18), 90) : 60,
    verificationPercent: Number.isFinite(verificationPercent)
      ? Math.min(Math.max(Math.trunc(verificationPercent), 0), 100)
      : 0,
    premiumPercent: Number.isFinite(premiumPercent)
      ? Math.min(Math.max(Math.trunc(premiumPercent), 0), 100)
      : 0,
    freePercent: Number.isFinite(Number(data.freePercent))
      ? Math.min(Math.max(Math.trunc(Number(data.freePercent)), 0), 100)
      : undefined,
    goldPercent: Number.isFinite(goldPercent)
      ? Math.min(Math.max(Math.trunc(goldPercent), 0), 100)
      : 0,
    platinumPercent: Number.isFinite(platinumPercent)
      ? Math.min(Math.max(Math.trunc(platinumPercent), 0), 100)
      : 0,
    batchName:
      cleanText(data.batchName, 120) || `Demo batch ${new Date().toISOString().slice(0, 10)}`,
    photoSource:
      data.photoSource === "placeholder" ||
      data.photoSource === "mixed" ||
      data.photoSource === "zip"
        ? data.photoSource
        : "library",
    useImportedOnly: Boolean(data.useImportedOnly),
  };
}

function birthDateFromAge(age: number): string {
  const today = new Date();
  const birth = new Date(
    Date.UTC(today.getUTCFullYear() - age, today.getUTCMonth(), today.getUTCDate()),
  );
  return birth.toISOString().slice(0, 10);
}

function genderFolder(gender: string): DemoPhotoPool {
  if (gender === "man" || gender === "Male" || gender.toLowerCase() === "male") return "male";
  if (gender === "woman" || gender === "Female" || gender.toLowerCase() === "female")
    return "female";
  return "neutral";
}

function shouldRemoveStoragePath(path: string) {
  return (
    Boolean(path) &&
    !path.startsWith("/") &&
    !path.startsWith("http://") &&
    !path.startsWith("https://") &&
    !path.startsWith("demo-library/") &&
    !path.startsWith("seed-profiles/")
  );
}

function profileGenderFromFolder(gender: DemoPhotoPool) {
  if (gender === "neutral") return "nonbinary";
  return gender === "male" ? "man" : "woman";
}

function datasetGender(value: unknown): "male" | "female" | null {
  const text = cleanText(value, 20).toLowerCase();
  if (["male", "man", "men", "m"].includes(text)) return "male";
  if (["female", "woman", "women", "f"].includes(text)) return "female";
  return null;
}

function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (quoted && ch === '"' && next === '"') {
      cell += '"';
      i++;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (!quoted && ch === ",") {
      row.push(cell.trim());
      cell = "";
    } else if (!quoted && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function parseStructuredDataset(text: string, extension: string): Record<string, unknown>[] {
  if (extension === "json") {
    const parsed = JSON.parse(text) as unknown;
    if (Array.isArray(parsed))
      return parsed.filter((item) => item && typeof item === "object") as Record<string, unknown>[];
    if (parsed && typeof parsed === "object") {
      const values = Object.values(parsed as Record<string, unknown>);
      if (values.every((item) => item && typeof item === "object")) {
        return values as Record<string, unknown>[];
      }
    }
    return [];
  }
  const rows = csvRows(text);
  if (rows.length === 0) return [];
  const first = rows[0].map((v) => normalizeColumnName(v));
  const hasHeader = first.some((v) =>
    [
      "country",
      "country_iso2",
      "gender",
      "name",
      "city",
      "occupation",
      "education",
      "interest",
      "bio",
      "template",
      "language",
      "religion",
      "university",
      "company",
    ].includes(v),
  );
  const headers = hasHeader ? rows[0].map((header) => normalizeColumnName(header)) : [];
  return rows.slice(hasHeader ? 1 : 0).map((row) => {
    if (headers.length) {
      return Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]));
    }
    return {
      value: row[0] ?? "",
      country: row[0] ?? "",
      city: row[1] ?? "",
      gender: row[1] ?? "",
      name: row[2] ?? "",
    };
  });
}

function rowValue(row: Record<string, unknown>, names: string[]) {
  const entries = Object.entries(row);
  const normalizedNames = new Set(names.map((name) => normalizeColumnName(name)));
  for (const name of names) {
    const found = entries.find(([key]) => normalizeColumnName(key) === normalizeColumnName(name));
    if (found) return cleanText(found[1], 240);
  }
  const fallback = entries.find(([key]) => normalizedNames.has(normalizeColumnName(key)));
  if (fallback) return cleanText(fallback[1], 240);
  return "";
}

function rowNumber(row: Record<string, unknown>, names: string[]) {
  const raw = rowValue(row, names);
  const number = Number(raw);
  return Number.isFinite(number) ? number : null;
}

function requiredValueAliases(type: DatasetType): readonly string[] {
  const generatedMapping = GENERATED_DATASET_MAPPINGS[type];
  if (generatedMapping) return generatedMapping.value;
  if (type === "names" || type === "male_names" || type === "female_names") {
    return FIELD_ALIASES.name;
  }
  if (type === "countries") return ["name", "country", "country_name", "value"];
  if (type === "cities") return FIELD_ALIASES.city;
  if (type === "occupations") return FIELD_ALIASES.occupation;
  if (type === "interests") return FIELD_ALIASES.interest;
  if (type === "bio_templates") return FIELD_ALIASES.bioTemplate;
  if (type === "languages") return FIELD_ALIASES.language;
  if (type === "religions") return FIELD_ALIASES.religion;
  if (type === "universities" || type === "education") return FIELD_ALIASES.university;
  if (type === "companies") return FIELD_ALIASES.company;
  return ["value", "name"];
}

function datasetValue(type: DatasetType, row: Record<string, unknown>) {
  const generatedMapping = GENERATED_DATASET_MAPPINGS[type];
  return rowValue(row, [...(generatedMapping?.value ?? requiredValueAliases(type))]);
}

function datasetCountry(type: DatasetType, row: Record<string, unknown>) {
  const generatedMapping = GENERATED_DATASET_MAPPINGS[type];
  const exactCountry = generatedMapping?.country.length
    ? rowValue(row, [...generatedMapping.country])
    : "";
  return exactCountry || rowValue(row, [...FIELD_ALIASES.country]);
}

function normalizeDatasetItems(type: DatasetType, rows: Record<string, unknown>[]) {
  const errors: string[] = [];
  const headers = headersForRows(rows);
  const items: NormalizedDatasetItem[] = [];
  const truncatedRows = Math.max(0, rows.length - MAX_IMPORT_ITEMS);

  rows.slice(0, MAX_IMPORT_ITEMS).forEach((row, index) => {
    const country = datasetCountry(type, row);
    const gender = datasetGender(rowValue(row, ["gender", "sex"]));
    const value = datasetValue(type, row);

    if (!value) {
      errors.push(
        `Row ${index + 1}: missing ${type} value. Expected one of: ${requiredValueAliases(
          type,
        ).join(", ")}. Headers found: ${headers.join(", ") || "none"}.`,
      );
      return;
    }
    const resolvedGender =
      type === "male_names" ? "male" : type === "female_names" ? "female" : gender;
    if (type === "names" && !resolvedGender) {
      errors.push(`Row ${index + 1}: missing or invalid gender.`);
      return;
    }
    if (type === "cities" && !country) {
      errors.push(
        `Row ${index + 1}: missing country for city "${value}". Expected one of: ${FIELD_ALIASES.country.join(
          ", ",
        )}. Headers found: ${headers.join(", ") || "none"}.`,
      );
      return;
    }

    items.push({
      dataset_type: type,
      country: country || null,
      gender: resolvedGender,
      value,
      label: value,
      metadata: {
        source: rowValue(row, ["source"]),
        source_item: rowValue(row, ["source_item", "geoname_id"]),
        iso2: rowValue(row, ["iso2", "country_iso2", "country_code"]),
        iso3: rowValue(row, ["iso3"]),
        state_province: rowValue(row, ["state_province", "state"]),
        latitude: rowNumber(row, [...FIELD_ALIASES.latitude]),
        longitude: rowNumber(row, [...FIELD_ALIASES.longitude]),
        population: rowNumber(row, ["population"]),
        category: rowValue(row, ["category"]),
        domains: rowValue(row, ["domains"]),
        web_pages: rowValue(row, ["web_pages"]),
        ticker: rowValue(row, ["ticker"]),
        iso6391: rowValue(row, ["iso6391"]),
        iso6392: rowValue(row, ["iso6392"]),
      },
      enabled: true,
    });
  });
  return { items, errors, truncatedRows };
}

export function parseDemoDatasetForImport(
  fileName: string,
  text: string,
  requested: DatasetType | "auto" = "auto",
) {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (extension !== "csv" && extension !== "json") {
    throw new Error("Datasets must be CSV or JSON.");
  }
  const rows = parseStructuredDataset(text, extension);
  const datasetType = detectDatasetType(fileName, requested, rows);
  const normalized = normalizeDatasetItems(datasetType, rows);
  return {
    datasetType,
    headers: headersForRows(rows),
    rows,
    items: normalized.items,
    errors: normalized.errors,
    truncatedRows: normalized.truncatedRows,
  };
}

async function sha256(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy.buffer as ArrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function importStatus(errorCount: number, validRows: number) {
  if (validRows === 0 && errorCount > 0) return "failed";
  return errorCount > 0 ? "completed_with_warnings" : "completed";
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function validateDemoInput(data: SaveDemoUserInput): SaveDemoUserInput {
  const id = typeof data.id === "string" && UUID_RE.test(data.id) ? data.id : null;
  const displayName = cleanText(data.displayName, 80);
  const age = Number(data.age);
  if (displayName.length < 2) throw new Error("Add a full name.");
  if (!Number.isFinite(age) || age < 18 || age > 90)
    throw new Error("Age must be between 18 and 90.");

  return {
    id,
    displayName,
    age,
    gender: cleanText(data.gender, 40) || "woman",
    interestedIn: cleanStringArray(data.interestedIn, 6),
    country: cleanText(data.country, 80),
    city: cleanText(data.city, 80),
    bio: cleanText(data.bio, 500),
    occupation: cleanText(data.occupation, 80),
    religion: cleanText(data.religion, 80),
    education: cleanText(data.education, 80),
    relationshipGoal: cleanText(data.relationshipGoal, 80),
    interests: cleanStringArray(data.interests, 10),
    languages: cleanStringArray(data.languages, 10),
    latitude:
      typeof data.latitude === "number" && Number.isFinite(data.latitude) ? data.latitude : null,
    longitude:
      typeof data.longitude === "number" && Number.isFinite(data.longitude) ? data.longitude : null,
    lastActive: cleanText(data.lastActive, 40) || new Date().toISOString(),
    isVerified: Boolean(data.isVerified),
    membershipTier: cleanTier(data.membershipTier),
    isActive: Boolean(data.isActive),
  };
}

async function assertAdmin(context: {
  supabase: Parameters<typeof requireServerAdmin>[0];
  userId: string;
}) {
  await requireServerAdmin(context.supabase, context.userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function auditAdminAction(
  supabaseAdmin: Awaited<ReturnType<typeof assertAdmin>>,
  actorId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  details: Record<string, unknown>,
) {
  await writeAdminAuditWarning(supabaseAdmin, {
    actorId,
    action,
    entityType,
    entityId,
    details,
  });
}

async function listLibraryPaths(
  supabaseAdmin: Awaited<ReturnType<typeof assertAdmin>>,
  gender?: DemoPhotoPool,
) {
  const folders = gender ? [gender] : (["male", "female", "neutral"] as const);
  const out: DemoLibraryPhoto[] = [];
  const { data: usedRows } = await supabaseAdmin
    .from("profile_photos")
    .select("storage_path, url")
    .like("storage_path", "demo-library/%");
  const used = new Set((usedRows ?? []).map((row) => row.storage_path || row.url).filter(Boolean));

  for (const folder of folders) {
    const { data } = await supabaseAdmin.storage.from(BUCKET).list(`demo-library/${folder}`, {
      limit: 1000,
      sortBy: { column: "name", order: "asc" },
    });
    for (const item of data ?? []) {
      if (!item.name || item.name.endsWith("/")) continue;
      const path = `demo-library/${folder}/${item.name}`;
      out.push({ name: item.name, path, gender: folder, used: used.has(path) });
    }
  }
  return out;
}

async function ensureDemoPrimaryPhoto(
  supabaseAdmin: Awaited<ReturnType<typeof assertAdmin>>,
  userId: string,
  gender: string,
) {
  const { count } = await supabaseAdmin
    .from("profile_photos")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if ((count ?? 0) > 0) return false;
  const preferredPool = genderFolder(gender);
  const preferred = await listLibraryPaths(supabaseAdmin, preferredPool);
  const fallback =
    preferredPool === "neutral" ? [] : await listLibraryPaths(supabaseAdmin, "neutral");
  const any = preferred.length || fallback.length ? [] : await listLibraryPaths(supabaseAdmin);
  const library = [...preferred, ...fallback, ...any];
  const selected = library.find((photo) => !photo.used) ?? library[0];
  if (!selected) return false;
  const { error } = await supabaseAdmin.from("profile_photos").insert({
    user_id: userId,
    url: selected.path,
    storage_path: selected.path,
    position: 0,
    is_primary: true,
    is_private: false,
    moderation_status: "approved",
  } as never);
  return !error;
}

async function enabledDatasetItems(
  supabaseAdmin: Awaited<ReturnType<typeof assertAdmin>>,
  type: DatasetType,
) {
  const { data } = await supabaseAdmin
    .from("demo_dataset_items" as never)
    .select(
      "id, import_id, dataset_type, country, gender, value, label, metadata, enabled, created_at, last_used_at",
    )
    .eq("dataset_type", type)
    .eq("enabled", true)
    .limit(5000);
  return (data ?? []) as unknown as DemoDatasetItemRow[];
}

async function markDatasetItemsUsed(
  supabaseAdmin: Awaited<ReturnType<typeof assertAdmin>>,
  ids: string[],
) {
  if (!ids.length) return;
  const now = new Date().toISOString();
  await supabaseAdmin
    .from("demo_dataset_items" as never)
    .update({ last_used_at: now } as never)
    .in("id", ids);
  const { data } = await supabaseAdmin
    .from("demo_dataset_items" as never)
    .select("import_id")
    .in("id", ids);
  const importIds = Array.from(
    new Set(
      ((data ?? []) as unknown as { import_id: string | null }[])
        .map((row) => row.import_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  if (importIds.length) {
    await supabaseAdmin
      .from("demo_dataset_imports" as never)
      .update({ last_used_at: now, updated_at: now } as never)
      .in("id", importIds);
  }
}

function pickDatasetValue(
  items: DemoDatasetItemRow[],
  index: number,
  filters: { country?: string; countryAliases?: string[]; gender?: "male" | "female" } = {},
) {
  const countryAliases = new Set(
    [filters.country, ...(filters.countryAliases ?? [])].filter((value): value is string =>
      Boolean(value),
    ),
  );
  const filtered = items.filter((item) => {
    if (
      countryAliases.size > 0 &&
      !countryAliases.has("Any supported country") &&
      item.country &&
      !countryAliases.has(item.country)
    ) {
      return false;
    }
    if (filters.gender && item.gender && item.gender !== filters.gender) return false;
    return true;
  });
  const list = filtered.length ? filtered : items;
  if (!list.length) return null;
  return list[index % list.length];
}

function percentHit(index: number, percent: number) {
  if (percent <= 0) return false;
  if (percent >= 100) return true;
  return (index * 37) % 100 < percent;
}

function metadataText(item: DemoDatasetItemRow | null | undefined, key: string) {
  const value = item?.metadata?.[key];
  return typeof value === "string" ? value : "";
}

function metadataNumber(item: DemoDatasetItemRow | null | undefined, key: string) {
  const value = item?.metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function tierForIndex(index: number, data: BulkDemoGeneratorInput): MembershipTier {
  if (!data.premium) return "free";
  if (percentHit(index, data.platinumPercent ?? 0)) return "platinum";
  if (percentHit(index + 13, data.goldPercent ?? 0)) return "gold";
  if (percentHit(index + 29, data.premiumPercent ?? 25)) return "gold";
  return "free";
}

function bundledPlaceholderPath(gender: string, index: number) {
  return `/placeholder.svg?demo=${genderFolder(gender)}-${index % 24}`;
}

type DemoDiscoverRepairProfile = {
  id: string;
  is_demo_profile: boolean;
  display_name: string | null;
  birth_date: string | null;
  date_of_birth?: string | null;
  gender: string | null;
  interested_in: string[] | null;
  relationship_goal: string | null;
  location_country: string | null;
  location_city: string | null;
  bio: string | null;
  interests: string[] | null;
};

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function hasItems(value: string[] | null | undefined) {
  return Array.isArray(value) && value.length > 0;
}

function isAdultBirthDate(value: string | null | undefined) {
  if (!value) return false;
  const birth = new Date(value);
  if (Number.isNaN(birth.getTime())) return false;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 18);
  return birth <= cutoff;
}

function logicalInterestedIn(gender: string) {
  if (gender === "man") return ["women"];
  if (gender === "woman") return ["men"];
  return ["everyone"];
}

function countryAliasesForRepair(countryItem: DemoDatasetItemRow | null, countryName: string) {
  return [
    countryName,
    countryItem?.country,
    metadataText(countryItem, "iso2"),
    metadataText(countryItem, "iso3"),
  ].filter((value): value is string => Boolean(value));
}

async function repairMissingDemoDiscoverFields(
  supabaseAdmin: Awaited<ReturnType<typeof assertAdmin>>,
  ids: string[],
) {
  const [countryItems, cityItems, interestItems, bioItems] = await Promise.all([
    enabledDatasetItems(supabaseAdmin, "countries"),
    enabledDatasetItems(supabaseAdmin, "cities"),
    enabledDatasetItems(supabaseAdmin, "interests"),
    enabledDatasetItems(supabaseAdmin, "bio_templates"),
  ]);
  const { data: profiles, error } = await (
    supabaseAdmin.from("profiles") as never as {
      select: (columns: string) => {
        in: (
          column: string,
          values: string[],
        ) => Promise<{
          data: DemoDiscoverRepairProfile[] | null;
          error: { message: string } | null;
        }>;
      };
    }
  )
    .select(
      "id, is_demo_profile, display_name, birth_date, date_of_birth, gender, interested_in, relationship_goal, location_country, location_city, bio, interests",
    )
    .in("id", ids);
  if (error) throw new Error(error.message);

  const usedDatasetItemIds: string[] = [];
  let repaired = 0;

  for (const profile of profiles ?? []) {
    if (!profile.is_demo_profile) continue;

    const indexSeed = ids.indexOf(profile.id);
    const index = indexSeed >= 0 ? indexSeed : repaired;
    const currentGender = hasText(profile.gender) ? profile.gender!.trim() : "";
    const generatedGender = currentGender || (index % 2 === 0 ? "woman" : "man");
    const generated = generateDemoProfile(
      profile.location_country || "Any supported country",
      generatedGender,
      Date.now() + index,
    );
    const countryItem = profile.location_country ? null : pickDatasetValue(countryItems, index);
    const country = profile.location_country || countryItem?.value || generated.country;
    const cityItem = profile.location_city
      ? null
      : pickDatasetValue(cityItems, index, {
          countryAliases: countryAliasesForRepair(countryItem, country),
        });
    const bioItem = hasText(profile.bio) ? null : pickDatasetValue(bioItems, index);
    const interestA = hasItems(profile.interests)
      ? null
      : pickDatasetValue(interestItems, index * 2);
    const interestB = hasItems(profile.interests)
      ? null
      : pickDatasetValue(interestItems, index * 2 + 1);
    const interests = Array.from(
      new Set(
        [interestA?.value, interestB?.value, ...generated.interests].filter(
          (item): item is string => Boolean(item),
        ),
      ),
    ).slice(0, 6);
    usedDatasetItemIds.push(
      ...[countryItem?.id, cityItem?.id, bioItem?.id, interestA?.id, interestB?.id].filter(
        (id): id is string => Boolean(id),
      ),
    );

    const now = new Date().toISOString();
    const birthDate = isAdultBirthDate(profile.birth_date || profile.date_of_birth)
      ? (profile.birth_date || profile.date_of_birth)!
      : birthDateFromAge(generated.age);
    const patch = {
      birth_date: birthDate,
      date_of_birth: birthDate,
      gender: generatedGender,
      interested_in: hasItems(profile.interested_in)
        ? profile.interested_in
        : logicalInterestedIn(generatedGender),
      relationship_goal: hasText(profile.relationship_goal)
        ? profile.relationship_goal
        : generated.relationshipGoal,
      location_country: country,
      country,
      location_city: profile.location_city || cityItem?.value || generated.city,
      city: profile.location_city || cityItem?.value || generated.city,
      bio: hasText(profile.bio)
        ? profile.bio
        : bioItem
          ? `${bioItem.value} ${generated.bio.split(".").slice(1).join(".").trim()}`.trim()
          : generated.bio,
      interests: hasItems(profile.interests) ? profile.interests : interests,
      safety_agreement_accepted_at: now,
      terms_accepted_at: now,
      privacy_accepted_at: now,
      age_attested_at: now,
      is_active: true,
      is_discoverable: true,
      incognito: false,
      discovery_blocked_reason: null,
      onboarding_complete: true,
      profile_completion_score: 100,
      profile_completion_status: "complete",
      updated_at: now,
    };

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update(patch as never)
      .eq("id", profile.id)
      .eq("is_demo_profile", true);
    if (updateError) throw updateError;
    repaired++;
  }

  await markDatasetItemsUsed(supabaseAdmin, Array.from(new Set(usedDatasetItemIds)));
  return repaired;
}

export const listDemoUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DemoUserRow[]> => {
    const supabaseAdmin = await assertAdmin(context);
    const [{ data: profiles }, { data: photos }] = await Promise.all([
      (
        supabaseAdmin.from("profiles") as never as {
          select: (columns: string) => {
            eq: (
              column: string,
              value: boolean,
            ) => {
              order: (
                column: string,
                options: { ascending: boolean },
              ) => Promise<{ data: unknown[] | null }>;
            };
          };
        }
      )
        .select(
          "id, is_demo_profile, display_name, birth_date, gender, interested_in, location_country, location_city, bio, profession, religion, education, relationship_goal, interests, languages, latitude, longitude, last_active, is_verified, membership_tier, is_active, is_discoverable, incognito, discovery_blocked_reason, onboarding_complete, profile_completion_score",
        )
        .eq("is_demo_profile", true)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("profile_photos")
        .select("id, user_id, url, storage_path, is_primary, position")
        .order("is_primary", { ascending: false })
        .order("position", { ascending: true }),
    ]);

    const photosByUser = new Map<string, DemoPhotoRow[]>();
    for (const photo of photos ?? []) {
      const arr = photosByUser.get(photo.user_id) ?? [];
      arr.push({
        id: photo.id,
        url: photo.url,
        storage_path: photo.storage_path,
        is_primary: photo.is_primary,
        position: photo.position,
      });
      photosByUser.set(photo.user_id, arr);
    }

    return ((profiles ?? []) as unknown as ProfileRow[]).map((profile) => ({
      id: profile.id,
      is_demo_profile: profile.is_demo_profile,
      display_name: profile.display_name,
      birth_date: profile.birth_date,
      gender: profile.gender,
      interested_in: profile.interested_in ?? [],
      location_country: profile.location_country,
      location_city: profile.location_city,
      bio: profile.bio,
      profession: profile.profession,
      religion: profile.religion,
      education: profile.education,
      relationship_goal: profile.relationship_goal,
      interests: profile.interests ?? [],
      languages: profile.languages ?? [],
      latitude: profile.latitude,
      longitude: profile.longitude,
      last_active: profile.last_active,
      is_verified: profile.is_verified,
      membership_tier: profile.membership_tier,
      is_active: profile.is_active ?? true,
      is_discoverable: profile.is_discoverable ?? true,
      incognito: profile.incognito,
      discovery_blocked_reason: profile.discovery_blocked_reason ?? null,
      onboarding_complete: profile.onboarding_complete,
      profile_completion_score: profile.profile_completion_score ?? 0,
      photos: photosByUser.get(profile.id) ?? [],
    }));
  });

export const listDemoDatasets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DemoDatasetOverview> => {
    const supabaseAdmin = await assertAdmin(context);
    const countTypes = DATASET_TYPES.filter((type) => type !== "photo_library");
    const countPromises = countTypes.map(async (type) => {
      const { count, error } = await supabaseAdmin
        .from("demo_dataset_items" as never)
        .select("id", { count: "exact", head: true })
        .eq("dataset_type", type)
        .eq("enabled", true);
      if (error) {
        datasetImportLog("error", "dataset_count_failed", {
          datasetType: type,
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        throw error;
      }
      return [type, count ?? 0] as const;
    });
    const [
      { data: imports, error: importsError },
      { data: preview, error: previewError },
      photoLibrary,
      countEntries,
    ] = await Promise.all([
      supabaseAdmin
        .from("demo_dataset_imports" as never)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("demo_dataset_items" as never)
        .select(
          "id, import_id, dataset_type, country, gender, value, label, metadata, enabled, created_at, last_used_at",
        )
        .order("created_at", { ascending: false })
        .limit(5000),
      listLibraryPaths(supabaseAdmin),
      Promise.all(countPromises),
    ]);
    if (importsError) throw importsError;
    if (previewError) throw previewError;
    const countByType = Object.fromEntries(countEntries) as Record<DatasetType, number>;
    const items = (preview ?? []) as unknown as DemoDatasetItemRow[];
    const countries = countByType.countries ?? 0;
    const names =
      (countByType.names ?? 0) + (countByType.male_names ?? 0) + (countByType.female_names ?? 0);
    const cities = countByType.cities ?? 0;
    const occupations = countByType.occupations ?? 0;
    const education = (countByType.education ?? 0) + (countByType.universities ?? 0);
    const universities = countByType.universities ?? 0;
    const companies = countByType.companies ?? 0;
    const interests = countByType.interests ?? 0;
    const bioTemplates = countByType.bio_templates ?? 0;
    const languages = countByType.languages ?? 0;
    const religions = countByType.religions ?? 0;
    const malePhotos = photoLibrary.filter((photo) => photo.gender === "male").length;
    const femalePhotos = photoLibrary.filter((photo) => photo.gender === "female").length;
    const totalRecords =
      photoLibrary.length +
      countries +
      names +
      cities +
      occupations +
      education +
      companies +
      interests +
      bioTemplates +
      languages +
      religions;
    return {
      imports: (imports ?? []) as unknown as DemoDatasetImportRow[],
      preview: items,
      stats: {
        photosTotal: photoLibrary.length,
        malePhotos,
        femalePhotos,
        totalRecords,
        countries,
        cities,
        names,
        occupations,
        education,
        universities,
        companies,
        interests,
        bioTemplates,
        languages,
        religions,
        estimatedUniqueProfiles: Math.max(
          0,
          Math.min(names || 0, cities || 0, photoLibrary.length || 0),
        ),
      },
    };
  });

export const importDemoDataset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error("Expected form data");
    const type = cleanDatasetType(data.get("dataset_type"));
    const file = data.get("file");
    const name = cleanText(data.get("name"), 120) || "Demo dataset";
    if (!(file instanceof File)) throw new Error("Choose a dataset file.");
    if (file.size > MAX_IMPORT_FILE_BYTES) throw new Error("Import files must be under 200MB.");
    return { type, file, name };
  })
  .handler(
    async ({
      data,
      context,
    }): Promise<
      | {
          ok: true;
          importId: string;
          imported: number;
          skipped: number;
          duplicates: number;
          errorCount: number;
          errors: string[];
          summary: SerializableSummary;
          datasetType: DatasetType;
          totalRows: number;
          totalAvailable: number;
        }
      | { ok: false; error: string }
    > => {
      let failureTraceId = "";
      let failureImportId: string | null = null;
      let cleanupSupabaseAdmin: Awaited<ReturnType<typeof assertAdmin>> | null = null;
      try {
        const supabaseAdmin = await assertAdmin(context);
        cleanupSupabaseAdmin = supabaseAdmin;
        const errors: string[] = [];
        let totalRows = 0;
        let imported = 0;
        let skipped = 0;
        let duplicates = 0;
        const summary: SerializableSummary = {};
        const traceId = crypto.randomUUID();
        failureTraceId = traceId;
        const extension = data.file.name.split(".").pop()?.toLowerCase() ?? "";
        let detectedType: DatasetType =
          data.type === "auto" && extension !== "zip"
            ? "photo_library"
            : detectDatasetType(data.file.name, data.type);

        datasetImportLog("log", "started", {
          traceId,
          fileName: data.file.name,
          fileSize: data.file.size,
          extension,
          requestedType: data.type,
          initialType: detectedType,
        });

        let structuredRows: Record<string, unknown>[] = [];
        if (extension === "csv" || extension === "json") {
          const text = await data.file.text();
          const parsed = parseDemoDatasetForImport(data.file.name, text, data.type);
          structuredRows = parsed.rows;
          detectedType = parsed.datasetType;
          datasetImportLog("log", "parsed_structured_file", {
            traceId,
            detectedType,
            rowCount: structuredRows.length,
            headersFound: parsed.headers,
            firstParsedRows: structuredRows.slice(0, 3),
            firstValidationErrors: parsed.errors.slice(0, 10),
          });
        }

        const { data: importRow, error: importError } = await supabaseAdmin
          .from("demo_dataset_imports" as never)
          .insert({
            actor_id: context.userId,
            dataset_type: detectedType,
            name: data.name,
            status: "failed",
            summary: { file: data.file.name, detectedType },
          } as never)
          .select("id")
          .single();
        if (importError || !importRow) throw importError ?? new Error("Could not create import.");
        const importId = (importRow as unknown as { id: string }).id;
        failureImportId = importId;
        datasetImportLog("log", "created_import_record", { traceId, importId, detectedType });

        if (detectedType === "photo_library") {
          if (extension !== "zip")
            throw new Error("Photo libraries must be uploaded as a ZIP archive.");
          const zip = await JSZip.loadAsync(await data.file.arrayBuffer());
          const entries = Object.values(zip.files)
            .filter((entry) => !entry.dir)
            .slice(0, MAX_PHOTO_IMPORT_ITEMS);
          totalRows = entries.length;
          let male = 0;
          let female = 0;
          for (const entry of entries) {
            const normalized = entry.name.replace(/\\/g, "/").toLowerCase();
            const folder =
              normalized.includes("demo-library/male/") || normalized.startsWith("male/")
                ? "male"
                : normalized.includes("demo-library/female/") || normalized.startsWith("female/")
                  ? "female"
                  : null;
            if (!folder) {
              skipped++;
              errors.push(`${entry.name}: expected male/ or female/ folder.`);
              continue;
            }
            const bytes = new Uint8Array(await entry.async("uint8array"));
            const info = getImageInfo(bytes);
            if (!info || !ACCEPTED_MIME.has(`image/${info.format}`)) {
              skipped++;
              errors.push(`${entry.name}: unsupported or corrupted image.`);
              continue;
            }
            const hash = await sha256(bytes);
            const path = `demo-library/${folder}/${hash}.${EXT_BY_FORMAT[info.format]}`;
            const { data: existing } = await supabaseAdmin.storage
              .from(BUCKET)
              .list(`demo-library/${folder}`, {
                search: `${hash}.`,
                limit: 1,
              });
            if (!existing?.length) {
              const { error: uploadError } = await supabaseAdmin.storage
                .from(BUCKET)
                .upload(path, bytes, {
                  cacheControl: "86400",
                  upsert: false,
                  contentType: `image/${info.format}`,
                });
              if (uploadError) {
                skipped++;
                errors.push(`${entry.name}: ${uploadError.message}`);
                continue;
              }
            }
            const { error: itemError } = await supabaseAdmin
              .from("demo_dataset_items" as never)
              .upsert(
                {
                  import_id: importId,
                  dataset_type: detectedType,
                  gender: folder,
                  value: path,
                  label: entry.name.split("/").pop() ?? path,
                  metadata: { hash, source: entry.name },
                  enabled: true,
                } as never,
                { onConflict: "dataset_type,country,gender,value" } as never,
              )
              .select("id")
              .single();
            if (itemError) {
              skipped++;
              errors.push(`${entry.name}: ${itemError.message}`);
              datasetImportLog("warn", "photo_item_upsert_failed", {
                traceId,
                importId,
                entry: entry.name,
                message: itemError.message,
              });
              continue;
            }
            imported++;
            if (folder === "male") male++;
            else female++;
          }
          summary.malePhotos = male;
          summary.femalePhotos = female;
        } else {
          if (extension !== "csv" && extension !== "json")
            throw new Error("Datasets must be CSV or JSON.");
          totalRows = structuredRows.length;
          const normalized = normalizeDatasetItems(detectedType, structuredRows);
          errors.push(...normalized.errors);
          if (normalized.errors.length) {
            datasetImportLog("warn", "validation_warnings", {
              traceId,
              importId,
              detectedType,
              errorCount: normalized.errors.length,
              sampleErrors: normalized.errors.slice(0, 10),
            });
          }
          const seenImportKeys = new Set<string>();
          const uniqueItems = normalized.items.filter((item) => {
            const key = `${item.dataset_type}:${item.country ?? ""}:${item.gender ?? ""}:${item.value}`;
            if (seenImportKeys.has(key)) return false;
            seenImportKeys.add(key);
            return true;
          });
          const duplicateRowsInFile = normalized.items.length - uniqueItems.length;
          datasetImportLog("log", "normalized_items", {
            traceId,
            importId,
            detectedType,
            totalRows,
            validRows: normalized.items.length,
            uniqueRows: uniqueItems.length,
            duplicateRowsInFile,
            invalidRows: normalized.errors.length,
            truncatedRows: normalized.truncatedRows,
          });
          if (uniqueItems.length) {
            const { data: existingRows, error: existingError } = await supabaseAdmin
              .from("demo_dataset_items" as never)
              .select("dataset_type, country, gender, value")
              .eq("dataset_type", detectedType)
              .limit(MAX_IMPORT_ITEMS);
            if (existingError) throw existingError;
            const existingKeys = new Set(
              (
                (existingRows ?? []) as unknown as Array<{
                  dataset_type: string;
                  country: string | null;
                  gender: string | null;
                  value: string;
                }>
              ).map(
                (item) =>
                  `${item.dataset_type}:${item.country ?? ""}:${item.gender ?? ""}:${item.value}`,
              ),
            );
            duplicates = normalized.items.filter((item) =>
              existingKeys.has(
                `${item.dataset_type}:${item.country ?? ""}:${item.gender ?? ""}:${item.value}`,
              ),
            ).length;
            duplicates += duplicateRowsInFile;
            const newItems = uniqueItems.filter(
              (item) =>
                !existingKeys.has(
                  `${item.dataset_type}:${item.country ?? ""}:${item.gender ?? ""}:${item.value}`,
                ),
            );
            for (const [batchIndex, batch] of chunkArray(newItems, 500).entries()) {
              const { error: insertError } = await supabaseAdmin
                .from("demo_dataset_items" as never)
                .insert(batch.map((item) => ({ ...item, import_id: importId })) as never);
              if (insertError) {
                datasetImportLog("error", "item_batch_insert_failed", {
                  traceId,
                  importId,
                  detectedType,
                  batchIndex,
                  batchSize: batch.length,
                  message: insertError.message,
                  details: insertError.details,
                  hint: insertError.hint,
                  code: insertError.code,
                  sample: batch.slice(0, 3),
                });
                throw insertError;
              }
              datasetImportLog("log", "item_batch_persisted", {
                traceId,
                importId,
                detectedType,
                batchIndex,
                batchSize: batch.length,
              });
            }
            datasetImportLog("log", "insert_result", {
              traceId,
              importId,
              detectedType,
              validRows: normalized.items.length,
              uniqueRows: uniqueItems.length,
              newRows: newItems.length,
              duplicates,
            });
          } else {
            duplicates += duplicateRowsInFile;
          }
          skipped = normalized.errors.length;
          summary.truncatedRows = normalized.truncatedRows;
        }

        const { count: persistedForImport, error: importCountError } = await supabaseAdmin
          .from("demo_dataset_items" as never)
          .select("id", { count: "exact", head: true })
          .eq("import_id", importId);
        if (importCountError) throw importCountError;
        imported = persistedForImport ?? imported;

        const { count: totalAvailable, error: totalAvailableError } = await supabaseAdmin
          .from("demo_dataset_items" as never)
          .select("id", { count: "exact", head: true })
          .eq("dataset_type", detectedType)
          .eq("enabled", true);
        if (totalAvailableError) throw totalAvailableError;

        if (totalRows > 0 && imported === 0) {
          const message =
            errors.length > 0
              ? `No rows imported. First validation error: ${errors[0]}`
              : duplicates > 0
                ? `No new rows imported. ${duplicates.toLocaleString()} valid row${
                    duplicates === 1 ? " was" : "s were"
                  } already present as duplicate${duplicates === 1 ? "" : "s"}.`
                : "Supabase accepted the request but no dataset rows were persisted.";
          datasetImportLog("error", "no_rows_persisted", {
            traceId,
            importId,
            detectedType,
            totalRows,
            duplicates,
            validationErrors: errors.slice(0, 10),
            totalAvailable: totalAvailable ?? 0,
          });
          throw new Error(message);
        }

        const status = importStatus(errors.length, imported);
        const finalSummary: SerializableSummary = {
          ...summary,
          traceId,
          file: data.file.name,
          datasetType: detectedType,
          totalRows,
          imported,
          skipped,
          duplicates,
          totalAvailable: totalAvailable ?? 0,
          errors: errors.slice(0, 25),
        };
        if (detectedType === "photo_library") {
          finalSummary.note = "Images were validated and stored without server-side recompression.";
        }
        const { error: updateImportError } = await supabaseAdmin
          .from("demo_dataset_imports" as never)
          .update({
            status,
            total_rows: totalRows,
            valid_rows: imported,
            error_count: errors.length,
            summary: finalSummary,
            updated_at: new Date().toISOString(),
          } as never)
          .eq("id", importId);
        if (updateImportError) throw updateImportError;
        datasetImportLog("log", "completed", {
          traceId,
          importId,
          detectedType,
          status,
          totalRows,
          imported,
          skipped,
          duplicates,
          errors: errors.length,
          totalAvailable: totalAvailable ?? 0,
        });
        await auditAdminAction(
          supabaseAdmin,
          context.userId,
          "demo_dataset_import",
          "demo_dataset_import",
          importId,
          {
            datasetType: detectedType,
            imported,
            skipped,
            duplicates,
            errors: errors.length,
          },
        );
        return {
          ok: true,
          importId,
          imported,
          skipped,
          duplicates,
          errorCount: errors.length,
          errors: errors.slice(0, 25),
          summary: finalSummary,
          datasetType: detectedType,
          totalRows,
          totalAvailable: totalAvailable ?? 0,
        };
      } catch (error) {
        if (failureImportId && cleanupSupabaseAdmin) {
          const { error: cleanupError } = await cleanupSupabaseAdmin
            .from("demo_dataset_imports" as never)
            .delete()
            .eq("id", failureImportId);
          if (cleanupError) {
            datasetImportLog("error", "failed_import_cleanup_failed", {
              traceId: failureTraceId || undefined,
              importId: failureImportId,
              message: cleanupError.message,
              details: cleanupError.details,
              hint: cleanupError.hint,
              code: cleanupError.code,
            });
          }
        }
        datasetImportLog("error", "failed", {
          traceId: failureTraceId || undefined,
          importId: failureImportId,
          message: error instanceof Error ? error.message : "Could not import dataset.",
        });
        return {
          ok: false,
          error: error instanceof Error ? error.message : "Could not import dataset.",
        };
      }
    },
  );

export const updateDemoDatasetImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; name?: string; enabled?: boolean }) => {
    if (!UUID_RE.test(data.id)) throw new Error("Invalid dataset.");
    return {
      id: data.id,
      name: data.name == null ? undefined : cleanText(data.name, 120),
      enabled: data.enabled == null ? undefined : Boolean(data.enabled),
    };
  })
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    try {
      const supabaseAdmin = await assertAdmin(context);
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (data.name != null && data.name.length > 0) patch.name = data.name;
      if (data.enabled != null) patch.enabled = data.enabled;
      const { error } = await supabaseAdmin
        .from("demo_dataset_imports" as never)
        .update(patch as never)
        .eq("id", data.id);
      if (error) throw error;
      if (data.enabled != null) {
        await supabaseAdmin
          .from("demo_dataset_items" as never)
          .update({ enabled: data.enabled } as never)
          .eq("import_id", data.id);
      }
      await auditAdminAction(
        supabaseAdmin,
        context.userId,
        "demo_dataset_update",
        "demo_dataset_import",
        data.id,
        patch,
      );
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Could not update dataset.",
      };
    }
  });

export const deleteDemoDatasetImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; deletePhotos?: boolean }) => {
    if (!UUID_RE.test(data.id)) throw new Error("Invalid dataset.");
    return { id: data.id, deletePhotos: Boolean(data.deletePhotos) };
  })
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    try {
      const supabaseAdmin = await assertAdmin(context);
      if (data.deletePhotos) {
        const { data: items } = await supabaseAdmin
          .from("demo_dataset_items" as never)
          .select("value")
          .eq("import_id", data.id)
          .eq("dataset_type", "photo_library");
        const paths = ((items ?? []) as unknown as { value: string }[])
          .map((item) => item.value)
          .filter((path) => path.startsWith("demo-library/"));
        if (paths.length) await supabaseAdmin.storage.from(BUCKET).remove(paths);
      }
      const { error } = await supabaseAdmin
        .from("demo_dataset_imports" as never)
        .delete()
        .eq("id", data.id);
      if (error) throw error;
      await auditAdminAction(
        supabaseAdmin,
        context.userId,
        "demo_dataset_delete",
        "demo_dataset_import",
        data.id,
        {
          deletePhotos: data.deletePhotos,
        },
      );
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Could not delete dataset.",
      };
    }
  });

export const saveDemoUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: SaveDemoUserInput) => validateDemoInput(data))
  .handler(
    async ({
      data,
      context,
    }): Promise<
      | { ok: true; id: string; discoverReady: boolean; autoPhotoAdded: boolean }
      | { ok: false; error: string }
    > => {
      try {
        const supabaseAdmin = await assertAdmin(context);
        const now = new Date().toISOString();
        let id = data.id ?? null;
        const creating = !id;

        if (id) {
          const { data: existing, error: existingError } = await supabaseAdmin
            .from("profiles")
            .select("id, is_demo_profile")
            .eq("id", id)
            .maybeSingle();
          if (existingError) throw existingError;
          if (!existing?.is_demo_profile)
            return { ok: false, error: "Only demo profiles can be edited here." };
        } else {
          const email = `demo_${crypto.randomUUID()}@heartconnect.local`;
          const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            email_confirm: true,
            password: crypto.randomUUID(),
            user_metadata: { display_name: data.displayName, is_demo_profile: true },
          });
          if (createError || !created.user) {
            throw createError ?? new Error("Could not create demo user.");
          }
          id = created.user.id;
        }

        const visiblePatch = data.isActive
          ? {
              is_active: true,
              is_discoverable: true,
              incognito: false,
              discovery_blocked_reason: null,
            }
          : {
              is_active: false,
              is_discoverable: false,
              incognito: false,
              discovery_blocked_reason: "hidden_by_admin",
            };

        const profilePayload = {
          id,
          display_name: data.displayName,
          birth_date: birthDateFromAge(data.age),
          gender: data.gender,
          interested_in: data.interestedIn.length ? data.interestedIn : ["everyone"],
          location_country: data.country || null,
          location_city: data.city || null,
          bio: data.bio || null,
          profession: data.occupation || null,
          religion: data.religion || null,
          education: data.education || null,
          relationship_goal: data.relationshipGoal || null,
          marriage_intention: "marriage",
          marriage_timeline: "1_to_2_years",
          wants_children: "open",
          has_children: "no",
          faith_or_values_importance: "important",
          family_values: "balanced",
          relocation_openness: "maybe",
          communication_style: "direct",
          dealbreakers: ["dishonesty", "disrespect"],
          long_distance_openness: "maybe",
          parenting_preferences: "Shared, emotionally present parenting",
          conflict_resolution_style: "pause_then_discuss",
          love_language: "quality_time",
          work_life_balance: "balanced",
          education_importance: "important",
          faith: data.religion || null,
          faith_importance: "important",
          culture_background: "multicultural",
          languages_spoken: data.languages,
          personality_type: "ambivert",
          hobbies: ["travel", "cooking"],
          partner_expectations: "shared_values",
          future_plans: "career_and_family",
          interests: data.interests,
          languages: data.languages,
          latitude: data.latitude,
          longitude: data.longitude,
          last_active: new Date(data.lastActive).toISOString(),
          is_verified: data.isVerified,
          membership_tier: data.membershipTier,
          is_demo_profile: true,
          onboarding_complete: true,
          profile_completion_score: 95,
          location_hidden: false,
          hide_age: false,
          hide_distance: false,
          hide_online_status: false,
          age_attested_at: now,
          terms_accepted_at: now,
          privacy_accepted_at: now,
          safety_agreement_accepted_at: now,
          updated_at: now,
          ...visiblePatch,
        };

        const { error: upsertError } = await supabaseAdmin
          .from("profiles")
          .upsert(profilePayload as never, { onConflict: "id" });
        if (upsertError) throw upsertError;
        const autoPhotoAdded =
          creating && data.isActive
            ? await ensureDemoPrimaryPhoto(supabaseAdmin, id, data.gender)
            : false;
        const { count: discoverPhotoCount } = await (
          supabaseAdmin.from("profile_photos") as never as {
            select: (
              columns: string,
              options: { count: "exact"; head: true },
            ) => {
              eq: (
                column: string,
                value: string | boolean,
              ) => {
                eq: (
                  column: string,
                  value: string | boolean,
                ) => {
                  eq: (
                    column: string,
                    value: string | boolean,
                  ) => Promise<{ count: number | null }>;
                };
              };
            };
          }
        )
          .select("id", { count: "exact", head: true })
          .eq("user_id", id)
          .eq("is_private", false)
          .eq("moderation_status", "approved");
        return {
          ok: true,
          id,
          discoverReady: data.isActive && (discoverPhotoCount ?? 0) > 0,
          autoPhotoAdded,
        };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : "Could not save demo user.",
        };
      }
    },
  );

export const deleteDemoUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => {
    if (!data || !UUID_RE.test(data.id)) throw new Error("Invalid demo user.");
    return { id: data.id };
  })
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    try {
      const supabaseAdmin = await assertAdmin(context);
      const { data: profile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("id, is_demo_profile")
        .eq("id", data.id)
        .maybeSingle();
      if (profileError) throw profileError;
      if (!profile?.is_demo_profile)
        return { ok: false, error: "Only demo profiles can be deleted here." };

      const { data: photos } = await supabaseAdmin
        .from("profile_photos")
        .select("url, storage_path")
        .eq("user_id", data.id);
      const paths = (photos ?? [])
        .map((p) => p.storage_path || p.url)
        .filter((path): path is string => Boolean(path))
        .filter(shouldRemoveStoragePath);
      if (paths.length) await supabaseAdmin.storage.from(BUCKET).remove(paths);
      await supabaseAdmin.from("profile_photos").delete().eq("user_id", data.id);
      const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
      if (error) throw error;
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Could not delete demo user.",
      };
    }
  });

export const duplicateDemoUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => {
    if (!data || !UUID_RE.test(data.id)) throw new Error("Invalid demo user.");
    return { id: data.id };
  })
  .handler(
    async ({ data, context }): Promise<{ ok: true; id: string } | { ok: false; error: string }> => {
      try {
        const supabaseAdmin = await assertAdmin(context);
        const { data: profile, error: profileError } = await supabaseAdmin
          .from("profiles")
          .select("*")
          .eq("id", data.id)
          .maybeSingle();
        if (profileError) throw profileError;
        if (!profile?.is_demo_profile)
          return { ok: false, error: "Only demo profiles can be duplicated here." };

        const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: `demo_${crypto.randomUUID()}@heartconnect.local`,
          email_confirm: true,
          password: crypto.randomUUID(),
          user_metadata: {
            display_name: `${profile.display_name ?? "Demo"} Copy`,
            is_demo_profile: true,
          },
        });
        if (createError || !created.user)
          throw createError ?? new Error("Could not create demo user.");

        const now = new Date().toISOString();
        const clonedProfile = {
          ...profile,
          id: created.user.id,
          display_name: `${profile.display_name ?? "Demo"} Copy`,
          created_at: now,
          updated_at: now,
          last_active: now,
          is_demo_profile: true,
          onboarding_complete: true,
        };
        const { error: upsertError } = await supabaseAdmin
          .from("profiles")
          .upsert(clonedProfile as never, { onConflict: "id" });
        if (upsertError) throw upsertError;

        const { data: photos } = await supabaseAdmin
          .from("profile_photos")
          .select("url, storage_path, is_primary, position, is_private")
          .eq("user_id", data.id)
          .order("position", { ascending: true })
          .limit(6);
        if (photos?.length) {
          const { error: photoError } = await supabaseAdmin.from("profile_photos").insert(
            photos.map((photo) => ({
              user_id: created.user.id,
              url: photo.url,
              storage_path: photo.storage_path,
              is_primary: photo.is_primary,
              position: photo.position,
              is_private: photo.is_private,
            })),
          );
          if (photoError) throw photoError;
        }
        return { ok: true, id: created.user.id };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : "Could not duplicate demo user.",
        };
      }
    },
  );

export const setDemoDiscoverVisibility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; visible: boolean }) => {
    if (!UUID_RE.test(data.id)) throw new Error("Invalid demo user.");
    return { id: data.id, visible: Boolean(data.visible) };
  })
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    try {
      const supabaseAdmin = await assertAdmin(context);
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id, is_demo_profile")
        .eq("id", data.id)
        .maybeSingle();
      if (!profile?.is_demo_profile)
        return { ok: false, error: "Only demo profiles can be changed here." };
      const patch = data.visible
        ? {
            is_active: true,
            is_discoverable: true,
            incognito: false,
            discovery_blocked_reason: null,
          }
        : {
            is_active: false,
            is_discoverable: false,
            incognito: false,
            discovery_blocked_reason: "hidden_by_admin",
          };
      const { error } = await supabaseAdmin
        .from("profiles")
        .update(patch as never)
        .eq("id", data.id);
      if (error) throw error;
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Could not update visibility.",
      };
    }
  });

export const convertDemoUserToReal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => {
    if (!UUID_RE.test(data.id)) throw new Error("Invalid demo user.");
    return { id: data.id };
  })
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    try {
      const supabaseAdmin = await assertAdmin(context);
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id, is_demo_profile")
        .eq("id", data.id)
        .maybeSingle();
      if (!profile?.is_demo_profile)
        return { ok: false, error: "This profile is already real or unavailable." };
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({
          is_demo_profile: false,
          onboarding_complete: true,
          is_active: true,
          is_discoverable: true,
          incognito: false,
          discovery_blocked_reason: null,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", data.id);
      if (error) throw error;
      await auditAdminAction(
        supabaseAdmin,
        context.userId,
        "demo_convert_to_real",
        "profile",
        data.id,
        {},
      );
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Could not convert profile.",
      };
    }
  });

export const bulkManageDemoUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: DemoBulkActionInput) => {
    const ids = Array.isArray(data.ids)
      ? data.ids.filter((id) => UUID_RE.test(id)).slice(0, 1000)
      : [];
    if (!ids.length) throw new Error("Select at least one demo user.");
    if (
      ![
        "show",
        "hide",
        "delete",
        "convert",
        "tier",
        "verified",
        "fill_photos",
        "repair_discover_fields",
      ].includes(data.action)
    ) {
      throw new Error("Choose a bulk action.");
    }
    return {
      ids,
      action: data.action,
      tier: cleanTier(data.tier),
      verified: Boolean(data.verified),
    };
  })
  .handler(
    async ({
      data,
      context,
    }): Promise<{ ok: true; affected: number } | { ok: false; error: string }> => {
      try {
        const supabaseAdmin = await assertAdmin(context);
        const { data: profiles } = await supabaseAdmin
          .from("profiles")
          .select("id, is_demo_profile")
          .in("id", data.ids);
        const demoIds = ((profiles ?? []) as { id: string; is_demo_profile: boolean }[])
          .filter((profile) => profile.is_demo_profile)
          .map((profile) => profile.id);
        if (!demoIds.length) return { ok: false, error: "No demo profiles selected." };

        if (data.action === "delete") {
          for (const id of demoIds) {
            const { data: photos } = await supabaseAdmin
              .from("profile_photos")
              .select("url, storage_path")
              .eq("user_id", id);
            const paths = (photos ?? [])
              .map((p) => p.storage_path || p.url)
              .filter((path): path is string => Boolean(path))
              .filter(shouldRemoveStoragePath);
            if (paths.length) await supabaseAdmin.storage.from(BUCKET).remove(paths);
            await supabaseAdmin.from("profile_photos").delete().eq("user_id", id);
            await supabaseAdmin.auth.admin.deleteUser(id);
          }
        } else if (data.action === "convert") {
          await supabaseAdmin
            .from("profiles")
            .update({
              is_demo_profile: false,
              onboarding_complete: true,
              is_active: true,
              is_discoverable: true,
              incognito: false,
              discovery_blocked_reason: null,
              updated_at: new Date().toISOString(),
            } as never)
            .in("id", demoIds);
        } else if (data.action === "fill_photos") {
          const { data: demoProfiles } = await supabaseAdmin
            .from("profiles")
            .select("id, gender")
            .in("id", demoIds);
          for (const profile of demoProfiles ?? []) {
            await ensureDemoPrimaryPhoto(supabaseAdmin, profile.id, profile.gender ?? "neutral");
          }
        } else if (data.action === "repair_discover_fields") {
          await repairMissingDemoDiscoverFields(supabaseAdmin, demoIds);
        } else if (data.action === "show" || data.action === "hide") {
          const patch =
            data.action === "show"
              ? {
                  is_active: true,
                  is_discoverable: true,
                  incognito: false,
                  discovery_blocked_reason: null,
                }
              : {
                  is_active: false,
                  is_discoverable: false,
                  incognito: false,
                  discovery_blocked_reason: "hidden_by_admin",
                };
          await supabaseAdmin
            .from("profiles")
            .update(patch as never)
            .in("id", demoIds);
        } else if (data.action === "tier") {
          await supabaseAdmin
            .from("profiles")
            .update({ membership_tier: data.tier } as never)
            .in("id", demoIds);
        } else if (data.action === "verified") {
          await supabaseAdmin
            .from("profiles")
            .update({ is_verified: data.verified } as never)
            .in("id", demoIds);
        }

        await auditAdminAction(supabaseAdmin, context.userId, "demo_bulk_manage", "profile", null, {
          action: data.action,
          affected: demoIds.length,
        });
        return { ok: true, affected: demoIds.length };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : "Could not run bulk action.",
        };
      }
    },
  );

export const bulkGenerateDemoUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: BulkDemoGeneratorInput) => cleanBulkInput(data))
  .handler(
    async ({
      data,
      context,
    }): Promise<
      | {
          ok: true;
          created: number;
          withoutPhotos: number;
          duplicates: number;
          errors: number;
          batchId: string;
        }
      | { ok: false; error: string }
    > => {
      try {
        const supabaseAdmin = await assertAdmin(context);
        const [
          maleLibrary,
          femaleLibrary,
          countryItems,
          nameItems,
          maleNameItems,
          femaleNameItems,
          cityItems,
          occupationItems,
          educationItems,
          universityItems,
          companyItems,
          interestItems,
          bioItems,
          languageItems,
          religionItems,
        ] = await Promise.all([
          listLibraryPaths(supabaseAdmin, "male"),
          listLibraryPaths(supabaseAdmin, "female"),
          enabledDatasetItems(supabaseAdmin, "countries"),
          enabledDatasetItems(supabaseAdmin, "names"),
          enabledDatasetItems(supabaseAdmin, "male_names"),
          enabledDatasetItems(supabaseAdmin, "female_names"),
          enabledDatasetItems(supabaseAdmin, "cities"),
          enabledDatasetItems(supabaseAdmin, "occupations"),
          enabledDatasetItems(supabaseAdmin, "education"),
          enabledDatasetItems(supabaseAdmin, "universities"),
          enabledDatasetItems(supabaseAdmin, "companies"),
          enabledDatasetItems(supabaseAdmin, "interests"),
          enabledDatasetItems(supabaseAdmin, "bio_templates"),
          enabledDatasetItems(supabaseAdmin, "languages"),
          enabledDatasetItems(supabaseAdmin, "religions"),
        ]);
        const sourceCounts = {
          countries: countryItems.length,
          names: nameItems.length + maleNameItems.length + femaleNameItems.length,
          cities: cityItems.length,
          occupations: occupationItems.length,
          education: educationItems.length + universityItems.length,
          companies: companyItems.length,
          interests: interestItems.length,
          bioTemplates: bioItems.length,
          languages: languageItems.length,
          religions: religionItems.length,
          photos: maleLibrary.length + femaleLibrary.length,
        };
        const selectedCountries = new Set(data.countries ?? []);
        const selectedCities = new Set((data.cities ?? []).map((city) => city.toLowerCase()));
        const locationCountryItems =
          data.locationMode === "countries" && selectedCountries.size
            ? countryItems.filter((item) => selectedCountries.has(item.value))
            : countryItems;
        const locationCityItems = cityItems.filter((item) => {
          if (
            data.coordinatesOnly &&
            (metadataNumber(item, "latitude") == null || metadataNumber(item, "longitude") == null)
          ) {
            return false;
          }
          if (data.locationMode === "cities" && selectedCities.size) {
            return selectedCities.has(item.value.toLowerCase());
          }
          if (data.locationMode === "countries" && selectedCountries.size && item.country) {
            return selectedCountries.has(item.country);
          }
          return true;
        });
        datasetImportLog("log", "demo_generation_dataset_counts", {
          requestedCount: data.count,
          useImportedOnly: data.useImportedOnly,
          country: data.country,
          gender: data.gender,
          ...sourceCounts,
        });
        if (data.useImportedOnly) {
          const missing = Object.entries({
            names: sourceCounts.names,
            cities: sourceCounts.cities,
            occupations: sourceCounts.occupations,
            interests: sourceCounts.interests,
            bioTemplates: sourceCounts.bioTemplates,
            languages: sourceCounts.languages,
            religions: sourceCounts.religions,
          })
            .filter(([, count]) => count === 0)
            .map(([key]) => key);
          if (missing.length) {
            const message = `Import ${missing.join(", ")} before generating with imported data only.`;
            datasetImportLog("warn", "demo_generation_missing_imported_sources", {
              missing,
              sourceCounts,
            });
            return { ok: false, error: message };
          }
        }
        const { data: batchRow, error: batchError } = await supabaseAdmin
          .from("demo_generation_batches" as never)
          .insert({
            actor_id: context.userId,
            name: data.batchName,
            status: "running",
            requested_count: data.count,
            generation_settings: data,
            source_datasets: sourceCounts,
          } as never)
          .select("id")
          .single();
        if (batchError || !batchRow) throw batchError ?? new Error("Could not create batch.");
        const batchId = (batchRow as unknown as { id: string }).id;

        const usedThisRun = new Set<string>();
        const usedDatasetItemIds: string[] = [];
        const usedCombos = new Set<string>();
        let createdCount = 0;
        let withoutPhotos = 0;
        let duplicateCount = 0;
        const errors: string[] = [];

        for (let index = 0; index < data.count; index++) {
          const generated = generateDemoProfile(
            data.country,
            data.gender === "Male" ? "man" : data.gender === "Female" ? "woman" : "Mixed",
            Date.now() + index,
          );
          const folder = genderFolder(generated.gender);
          const selectedCountry = pickDatasetValue(locationCountryItems, index, {
            country: data.country,
          });
          const countryName =
            data.country !== "Any supported country"
              ? data.country
              : (selectedCountry?.value ?? generated.country);
          const countryAliases = [
            countryName,
            metadataText(selectedCountry, "iso2"),
            metadataText(selectedCountry, "iso3"),
          ].filter(Boolean);
          const genderNames = folder === "male" ? maleNameItems : femaleNameItems;
          const nameGender = folder === "male" || folder === "female" ? folder : undefined;
          const nameItem =
            pickDatasetValue(genderNames, index, { countryAliases, gender: nameGender }) ??
            pickDatasetValue(nameItems, index, {
              countryAliases,
              gender: nameGender,
            });
          const cityItem = pickDatasetValue(locationCityItems, index, { countryAliases });
          const occupationItem = pickDatasetValue(occupationItems, index);
          const educationItem =
            pickDatasetValue(universityItems, index, { countryAliases }) ??
            pickDatasetValue(educationItems, index);
          const companyItem = pickDatasetValue(companyItems, index, { countryAliases });
          const religionItem = pickDatasetValue(religionItems, index);
          const languageA = pickDatasetValue(languageItems, index);
          const languageB = pickDatasetValue(languageItems, index * 3 + 1);
          const bioItem = pickDatasetValue(bioItems, index);
          const interestA = pickDatasetValue(interestItems, index * 2);
          const interestB = pickDatasetValue(interestItems, index * 2 + 1);
          const minAge = data.minAge ?? 18;
          const maxAge = Math.max(data.maxAge ?? 60, minAge);
          const age = minAge + ((index * 7) % (maxAge - minAge + 1));
          const isVerified = data.verified && percentHit(index, data.verificationPercent ?? 35);
          const membershipTier = tierForIndex(index, data);
          const displayName =
            nameItem?.value ?? (data.useImportedOnly ? "" : generated.displayName);
          const city = cityItem?.value ?? (data.useImportedOnly ? "" : generated.city);
          const birthDate = birthDateFromAge(age);
          const combo = `${displayName.toLowerCase()}:${city.toLowerCase()}:${birthDate}`;
          if (!displayName || !city || usedCombos.has(combo)) {
            duplicateCount++;
            continue;
          }
          usedCombos.add(combo);
          const datasetIds = [
            selectedCountry?.id,
            nameItem?.id,
            cityItem?.id,
            occupationItem?.id,
            educationItem?.id,
            companyItem?.id,
            religionItem?.id,
            languageA?.id,
            languageB?.id,
            bioItem?.id,
            interestA?.id,
            interestB?.id,
          ].filter((id): id is string => Boolean(id));
          usedDatasetItemIds.push(...datasetIds);
          const { data: authUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email: `demo_${crypto.randomUUID()}@heartconnect.local`,
            email_confirm: true,
            password: crypto.randomUUID(),
            user_metadata: {
              display_name: displayName,
              is_demo_profile: true,
              demo_batch_id: batchId,
            },
          });
          if (createError || !authUser.user) {
            errors.push(createError?.message ?? "Could not create demo user.");
            continue;
          }

          const now = new Date().toISOString();
          const isDiscoverVisible = data.active && (data.discoverVisible ?? data.active);
          const visiblePatch = isDiscoverVisible
            ? {
                is_active: true,
                is_discoverable: true,
                incognito: false,
                discovery_blocked_reason: null,
              }
            : {
                is_active: data.active,
                is_discoverable: false,
                incognito: false,
                discovery_blocked_reason: data.active ? "hidden_by_admin" : "inactive_by_admin",
              };
          const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
            {
              id: authUser.user.id,
              display_name: displayName,
              birth_date: birthDate,
              gender: generated.gender,
              interested_in: generated.interestedIn,
              location_country: countryName,
              location_city: city,
              bio: bioItem
                ? `${bioItem.value} ${generated.bio.split(".").slice(1).join(".").trim()}`.trim()
                : generated.bio,
              profession: occupationItem?.value ?? generated.occupation,
              religion: religionItem?.value ?? generated.religion,
              education: educationItem?.value ?? generated.education,
              company: companyItem?.value,
              relationship_goal: generated.relationshipGoal,
              marriage_intention: "marriage",
              marriage_timeline: index % 3 === 0 ? "within_1_year" : "1_to_2_years",
              wants_children: index % 4 === 0 ? "yes" : "open",
              has_children: index % 5 === 0 ? "yes_not_at_home" : "no",
              faith_or_values_importance: index % 3 === 0 ? "essential" : "important",
              family_values: index % 2 === 0 ? "balanced" : "community_centered",
              relocation_openness: index % 3 === 0 ? "yes" : "maybe",
              communication_style: index % 2 === 0 ? "direct" : "reflective",
              dealbreakers: ["dishonesty", "disrespect"],
              long_distance_openness: index % 3 === 0 ? "yes" : "maybe",
              parenting_preferences: "Shared, emotionally present parenting",
              conflict_resolution_style:
                index % 2 === 0 ? "pause_then_discuss" : "solution_focused",
              love_language: index % 2 === 0 ? "quality_time" : "acts",
              work_life_balance: index % 3 === 0 ? "family_first" : "balanced",
              education_importance: "important",
              faith: religionItem?.value ?? generated.religion,
              faith_importance: index % 3 === 0 ? "essential" : "important",
              culture_background: index % 2 === 0 ? "diaspora" : "multicultural",
              languages_spoken: Array.from(
                new Set(
                  [languageA?.value, languageB?.value, ...generated.languages].filter(
                    (item): item is string => Boolean(item),
                  ),
                ),
              ).slice(0, 4),
              personality_type: index % 2 === 0 ? "ambivert" : "empathetic",
              hobbies: index % 2 === 0 ? ["travel", "cooking"] : ["music", "volunteering"],
              partner_expectations: index % 2 === 0 ? "shared_values" : "emotional_maturity",
              future_plans: index % 2 === 0 ? "career_and_family" : "build_family",
              interests: Array.from(
                new Set(
                  [interestA?.value, interestB?.value, ...generated.interests].filter(
                    (item): item is string => Boolean(item),
                  ),
                ),
              ).slice(0, 6),
              languages: Array.from(
                new Set(
                  [languageA?.value, languageB?.value, ...generated.languages].filter(
                    (item): item is string => Boolean(item),
                  ),
                ),
              ).slice(0, 4),
              latitude: metadataNumber(cityItem, "latitude") ?? generated.latitude,
              longitude: metadataNumber(cityItem, "longitude") ?? generated.longitude,
              last_active: generated.lastActive,
              is_verified: isVerified,
              membership_tier: membershipTier,
              is_demo_profile: true,
              demo_batch_id: batchId,
              onboarding_complete: true,
              profile_completion_score: 95,
              location_hidden: false,
              hide_age: false,
              hide_distance: false,
              hide_online_status: false,
              age_attested_at: now,
              terms_accepted_at: now,
              privacy_accepted_at: now,
              safety_agreement_accepted_at: now,
              updated_at: now,
              ...visiblePatch,
            } as never,
            { onConflict: "id" },
          );
          if (profileError) {
            errors.push(profileError.message);
            await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
            continue;
          }

          const library = folder === "male" ? maleLibrary : femaleLibrary;
          const available = library.filter(
            (photo) => data.allowPhotoReuse || (!photo.used && !usedThisRun.has(photo.path)),
          );
          const selected =
            data.photoSource !== "placeholder"
              ? available[index % Math.max(available.length, 1)]
              : undefined;
          if (selected) {
            usedThisRun.add(selected.path);
            await supabaseAdmin.from("profile_photos").insert({
              user_id: authUser.user.id,
              url: selected.path,
              storage_path: selected.path,
              position: 0,
              is_primary: true,
              is_private: false,
              moderation_status: "approved",
            } as never);
          } else if (
            data.photoSource === "placeholder" ||
            data.photoSource === "mixed" ||
            isDiscoverVisible
          ) {
            const placeholder = bundledPlaceholderPath(generated.gender, index);
            await supabaseAdmin.from("profile_photos").insert({
              user_id: authUser.user.id,
              url: placeholder,
              storage_path: placeholder,
              position: 0,
              is_primary: true,
              is_private: false,
              moderation_status: "approved",
            } as never);
          } else {
            withoutPhotos++;
          }
          createdCount++;
        }

        await markDatasetItemsUsed(supabaseAdmin, Array.from(new Set(usedDatasetItemIds)));
        await supabaseAdmin
          .from("demo_generation_batches" as never)
          .update({
            status: errors.length ? "completed_with_warnings" : "completed",
            created_count: createdCount,
            visible_count: data.active && (data.discoverVisible ?? data.active) ? createdCount : 0,
            hidden_count: data.active && (data.discoverVisible ?? data.active) ? 0 : createdCount,
            without_photos: withoutPhotos,
            duplicate_count: duplicateCount,
            error_count: errors.length,
            updated_at: new Date().toISOString(),
          } as never)
          .eq("id", batchId);
        await auditAdminAction(
          supabaseAdmin,
          context.userId,
          "demo_bulk_generate",
          "demo_profile",
          null,
          {
            batchId,
            batchName: data.batchName,
            count: createdCount,
            withoutPhotos,
            duplicates: duplicateCount,
            errors: errors.length,
            country: data.country,
            gender: data.gender,
          },
        );
        return {
          ok: true,
          created: createdCount,
          withoutPhotos,
          duplicates: duplicateCount,
          errors: errors.length,
          batchId,
        };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : "Could not generate demo users.",
        };
      }
    },
  );

export const listDemoBatches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DemoBatchRow[]> => {
    const supabaseAdmin = await assertAdmin(context);
    const { data } = await supabaseAdmin
      .from("demo_generation_batches" as never)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    return (data ?? []) as unknown as DemoBatchRow[];
  });

export const manageDemoBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      id: string;
      action: "show" | "hide" | "feature" | "unfeature" | "delete" | "convert" | "update";
      confirm?: boolean;
      name?: string;
    }) => {
      if (!UUID_RE.test(data.id)) throw new Error("Invalid demo batch.");
      if (
        !["show", "hide", "feature", "unfeature", "delete", "convert", "update"].includes(
          data.action,
        )
      ) {
        throw new Error("Choose a batch action.");
      }
      if ((data.action === "delete" || data.action === "convert") && !data.confirm) {
        throw new Error("Confirm this batch action first.");
      }
      return {
        id: data.id,
        action: data.action,
        confirm: Boolean(data.confirm),
        name: data.name == null ? undefined : cleanText(data.name, 120),
      };
    },
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{ ok: true; affected: number } | { ok: false; error: string }> => {
      try {
        const supabaseAdmin = await assertAdmin(context);
        const { data: profiles } = await (
          supabaseAdmin.from("profiles") as never as {
            select: (columns: string) => {
              eq: (
                column: string,
                value: string,
              ) => Promise<{ data: Array<{ id: string; is_demo_profile: boolean }> | null }>;
            };
          }
        )
          .select("id, is_demo_profile")
          .eq("demo_batch_id", data.id);
        const demoIds = ((profiles ?? []) as { id: string; is_demo_profile: boolean }[])
          .filter((profile) => profile.is_demo_profile)
          .map((profile) => profile.id);

        if (data.action === "update") {
          if (!data.name) return { ok: false, error: "Batch name is required." };
          await supabaseAdmin
            .from("demo_generation_batches" as never)
            .update({ name: data.name, updated_at: new Date().toISOString() } as never)
            .eq("id", data.id);
        } else if (data.action === "delete") {
          for (const id of demoIds) {
            const { data: photos } = await supabaseAdmin
              .from("profile_photos")
              .select("url, storage_path")
              .eq("user_id", id);
            const paths = (photos ?? [])
              .map((p) => p.storage_path || p.url)
              .filter((path): path is string => Boolean(path))
              .filter(shouldRemoveStoragePath);
            if (paths.length) await supabaseAdmin.storage.from(BUCKET).remove(paths);
            await supabaseAdmin.from("profile_photos").delete().eq("user_id", id);
            await supabaseAdmin.auth.admin.deleteUser(id);
          }
          await supabaseAdmin
            .from("demo_generation_batches" as never)
            .delete()
            .eq("id", data.id);
        } else if (data.action === "convert") {
          await supabaseAdmin
            .from("profiles")
            .update({
              is_demo_profile: false,
              onboarding_complete: true,
              is_active: true,
              is_discoverable: true,
              incognito: false,
              discovery_blocked_reason: null,
              updated_at: new Date().toISOString(),
            } as never)
            .in("id", demoIds);
        } else if (data.action === "feature" || data.action === "unfeature") {
          await supabaseAdmin
            .from("profiles")
            .update({
              is_featured: data.action === "feature",
              updated_at: new Date().toISOString(),
            } as never)
            .in("id", demoIds);
        } else {
          const visible = data.action === "show";
          await supabaseAdmin
            .from("profiles")
            .update(
              (visible
                ? {
                    is_active: true,
                    is_discoverable: true,
                    incognito: false,
                    discovery_blocked_reason: null,
                  }
                : {
                    is_active: false,
                    is_discoverable: false,
                    incognito: false,
                    discovery_blocked_reason: "hidden_by_admin",
                  }) as never,
            )
            .in("id", demoIds);
          await supabaseAdmin
            .from("demo_generation_batches" as never)
            .update({
              visible_count: visible ? demoIds.length : 0,
              hidden_count: visible ? 0 : demoIds.length,
              updated_at: new Date().toISOString(),
            } as never)
            .eq("id", data.id);
        }

        await auditAdminAction(
          supabaseAdmin,
          context.userId,
          "demo_batch_manage",
          "demo_generation_batch",
          data.id,
          {
            action: data.action,
            affected: demoIds.length,
          },
        );
        return { ok: true, affected: demoIds.length };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : "Could not manage batch.",
        };
      }
    },
  );

export const uploadDemoUserPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error("Expected form data");
    const userId = data.get("user_id");
    const file = data.get("file");
    if (typeof userId !== "string" || !UUID_RE.test(userId)) throw new Error("Invalid demo user.");
    if (!(file instanceof File)) throw new Error("No file provided");
    return { userId, file };
  })
  .handler(
    async ({
      data,
      context,
    }): Promise<{ ok: true; photo: DemoPhotoRow } | { ok: false; error: string }> => {
      try {
        const supabaseAdmin = await assertAdmin(context);
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("id, is_demo_profile")
          .eq("id", data.userId)
          .maybeSingle();
        if (!profile?.is_demo_profile)
          return { ok: false, error: "Photos can only be added to demo profiles here." };

        const { count } = await supabaseAdmin
          .from("profile_photos")
          .select("id", { count: "exact", head: true })
          .eq("user_id", data.userId);
        if ((count ?? 0) >= 6) return { ok: false, error: "Demo users can have up to 6 photos." };
        if (!ACCEPTED_MIME.has(data.file.type)) {
          return { ok: false, error: "Upload a JPG, PNG or WebP image." };
        }
        if (data.file.size > MAX_FILE_BYTES)
          return { ok: false, error: "Each photo must be under 8MB." };

        const bytes = new Uint8Array(await data.file.arrayBuffer());
        const info = getImageInfo(bytes);
        if (!info || !ACCEPTED_MIME.has(`image/${info.format}`)) {
          return { ok: false, error: "File contents do not match a supported image type." };
        }

        const path = `${data.userId}/${crypto.randomUUID()}.${EXT_BY_FORMAT[info.format]}`;
        const { error: uploadError } = await supabaseAdmin.storage
          .from(BUCKET)
          .upload(path, bytes, {
            cacheControl: "3600",
            upsert: false,
            contentType: `image/${info.format}`,
          });
        if (uploadError) throw uploadError;

        const position = count ?? 0;
        const { data: photo, error: insertError } = await supabaseAdmin
          .from("profile_photos")
          .insert({
            user_id: data.userId,
            url: path,
            storage_path: path,
            position,
            is_primary: position === 0,
            is_private: false,
            moderation_status: "approved",
          } as never)
          .select("id, url, storage_path, is_primary, position")
          .single();
        if (insertError || !photo) {
          await supabaseAdmin.storage.from(BUCKET).remove([path]);
          throw insertError ?? new Error("Could not register photo.");
        }

        return { ok: true, photo };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : "Could not upload photo.",
        };
      }
    },
  );

export const listDemoPhotoLibrary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DemoLibraryPhoto[]> => {
    const supabaseAdmin = await assertAdmin(context);
    return listLibraryPaths(supabaseAdmin);
  });

export const fillMissingDemoPhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data?: { ids?: string[] }) => ({
    ids: Array.isArray(data?.ids) ? data.ids.filter((id) => UUID_RE.test(id)).slice(0, 1000) : [],
  }))
  .handler(
    async ({
      data,
      context,
    }): Promise<
      | { ok: true; scanned: number; filled: number; missingPool: number }
      | { ok: false; error: string }
    > => {
      try {
        const supabaseAdmin = await assertAdmin(context);
        let query = supabaseAdmin
          .from("profiles")
          .select("id, gender")
          .eq("is_demo_profile", true)
          .limit(1000);
        if (data.ids.length) query = query.in("id", data.ids);
        const { data: profiles, error } = await query;
        if (error) throw error;
        let filled = 0;
        let missingPool = 0;
        for (const profile of profiles ?? []) {
          const ok = await ensureDemoPrimaryPhoto(
            supabaseAdmin,
            profile.id,
            profile.gender ?? "neutral",
          );
          if (ok) filled++;
          else {
            const { count } = await supabaseAdmin
              .from("profile_photos")
              .select("id", { count: "exact", head: true })
              .eq("user_id", profile.id);
            if ((count ?? 0) === 0) missingPool++;
          }
        }
        await auditAdminAction(
          supabaseAdmin,
          context.userId,
          "demo_fill_missing_photos",
          "demo_profile",
          null,
          { scanned: profiles?.length ?? 0, filled, missingPool, selected: data.ids.length },
        );
        return { ok: true, scanned: profiles?.length ?? 0, filled, missingPool };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : "Could not fill missing demo photos.",
        };
      }
    },
  );

export const fillMissingAvatars = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<
      { ok: true; missingRealPhotos: number; message: string } | { ok: false; error: string }
    > => {
      try {
        const supabaseAdmin = await assertAdmin(context);
        const { data, error } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("is_demo_profile", false)
          .limit(1000);
        if (error) throw error;
        let missingRealPhotos = 0;
        for (const profile of data ?? []) {
          const { count } = await supabaseAdmin
            .from("profile_photos")
            .select("id", { count: "exact", head: true })
            .eq("user_id", profile.id);
          if ((count ?? 0) === 0) missingRealPhotos++;
        }
        await auditAdminAction(
          supabaseAdmin,
          context.userId,
          "fill_missing_safe_avatars",
          "profile",
          null,
          { scanned: data?.length ?? 0, missingRealPhotos },
        );
        return {
          ok: true,
          missingRealPhotos,
          message:
            "Safe default avatars are displayed automatically without adding fake photos to real accounts.",
        };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : "Could not check missing avatars.",
        };
      }
    },
  );

export const uploadDemoLibraryPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error("Expected form data");
    const gender = data.get("gender");
    const file = data.get("file");
    if (gender !== "male" && gender !== "female" && gender !== "neutral")
      throw new Error("Choose a library folder.");
    if (!(file instanceof File)) throw new Error("No file provided");
    return { gender, file };
  })
  .handler(
    async ({
      data,
      context,
    }): Promise<{ ok: true; path: string } | { ok: false; error: string }> => {
      try {
        const supabaseAdmin = await assertAdmin(context);
        if (!ACCEPTED_MIME.has(data.file.type)) {
          return { ok: false, error: "Upload a JPG, PNG or WebP image." };
        }
        if (data.file.size > MAX_FILE_BYTES)
          return { ok: false, error: "Each photo must be under 8MB." };
        const bytes = new Uint8Array(await data.file.arrayBuffer());
        const info = getImageInfo(bytes);
        if (!info || !ACCEPTED_MIME.has(`image/${info.format}`)) {
          return { ok: false, error: "File contents do not match a supported image type." };
        }
        const path = `demo-library/${data.gender}/${crypto.randomUUID()}.${EXT_BY_FORMAT[info.format]}`;
        const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, bytes, {
          cacheControl: "86400",
          upsert: false,
          contentType: `image/${info.format}`,
        });
        if (error) throw error;
        return { ok: true, path };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : "Could not upload library photo.",
        };
      }
    },
  );

export const replaceDemoPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error("Expected form data");
    const userId = data.get("user_id");
    const photoId = data.get("photo_id");
    const file = data.get("file");
    if (typeof userId !== "string" || !UUID_RE.test(userId)) throw new Error("Invalid demo user.");
    if (typeof photoId !== "string" || !UUID_RE.test(photoId)) throw new Error("Invalid photo.");
    if (!(file instanceof File)) throw new Error("No file provided");
    return { userId, photoId, file };
  })
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    try {
      const supabaseAdmin = await assertAdmin(context);
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id, is_demo_profile")
        .eq("id", data.userId)
        .maybeSingle();
      if (!profile?.is_demo_profile)
        return { ok: false, error: "Photos can only be replaced on demo profiles here." };
      const { data: current } = await supabaseAdmin
        .from("profile_photos")
        .select("id, url, storage_path")
        .eq("id", data.photoId)
        .eq("user_id", data.userId)
        .maybeSingle();
      if (!current) return { ok: false, error: "Photo not found." };
      if (!ACCEPTED_MIME.has(data.file.type))
        return { ok: false, error: "Upload a JPG, PNG or WebP image." };
      if (data.file.size > MAX_FILE_BYTES)
        return { ok: false, error: "Each photo must be under 8MB." };
      const bytes = new Uint8Array(await data.file.arrayBuffer());
      const info = getImageInfo(bytes);
      if (!info || !ACCEPTED_MIME.has(`image/${info.format}`)) {
        return { ok: false, error: "File contents do not match a supported image type." };
      }
      const path = `${data.userId}/${crypto.randomUUID()}.${EXT_BY_FORMAT[info.format]}`;
      const { error: uploadError } = await supabaseAdmin.storage.from(BUCKET).upload(path, bytes, {
        cacheControl: "3600",
        upsert: false,
        contentType: `image/${info.format}`,
      });
      if (uploadError) throw uploadError;
      const { error } = await supabaseAdmin
        .from("profile_photos")
        .update({
          url: path,
          storage_path: path,
          is_private: false,
          moderation_status: "approved",
        } as never)
        .eq("id", data.photoId)
        .eq("user_id", data.userId);
      if (error) {
        await supabaseAdmin.storage.from(BUCKET).remove([path]);
        throw error;
      }
      const oldPath = current.storage_path || current.url;
      if (oldPath && shouldRemoveStoragePath(oldPath)) {
        await supabaseAdmin.storage.from(BUCKET).remove([oldPath]);
      }
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Could not replace photo.",
      };
    }
  });

export const addLibraryPhotoToDemoUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string; path: string }) => {
    if (!UUID_RE.test(data.userId)) throw new Error("Invalid demo user.");
    const path = cleanText(data.path, 300);
    if (!path.startsWith("demo-library/")) throw new Error("Choose a library photo.");
    return { userId: data.userId, path };
  })
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    try {
      const supabaseAdmin = await assertAdmin(context);
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id, is_demo_profile")
        .eq("id", data.userId)
        .maybeSingle();
      if (!profile?.is_demo_profile)
        return { ok: false, error: "Photos can only be added to demo profiles here." };
      const { count } = await supabaseAdmin
        .from("profile_photos")
        .select("id", { count: "exact", head: true })
        .eq("user_id", data.userId);
      if ((count ?? 0) >= 6) return { ok: false, error: "Demo users can have up to 6 photos." };
      const position = count ?? 0;
      const { error } = await supabaseAdmin.from("profile_photos").insert({
        user_id: data.userId,
        url: data.path,
        storage_path: data.path,
        position,
        is_primary: position === 0,
        is_private: false,
        moderation_status: "approved",
      } as never);
      if (error) throw error;
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Could not add library photo.",
      };
    }
  });

export const setDemoPrimaryPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string; photoId: string }) => {
    if (!UUID_RE.test(data.userId) || !UUID_RE.test(data.photoId))
      throw new Error("Invalid photo.");
    return data;
  })
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    try {
      const supabaseAdmin = await assertAdmin(context);
      await supabaseAdmin
        .from("profile_photos")
        .update({ is_primary: false })
        .eq("user_id", data.userId);
      const { error } = await supabaseAdmin
        .from("profile_photos")
        .update({ is_primary: true })
        .eq("id", data.photoId)
        .eq("user_id", data.userId);
      if (error) throw error;
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Could not update primary photo.",
      };
    }
  });

export const reorderDemoPhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string; photoIds: string[] }) => {
    if (!UUID_RE.test(data.userId) || !Array.isArray(data.photoIds))
      throw new Error("Invalid photo order.");
    const photoIds = data.photoIds.filter((id) => UUID_RE.test(id)).slice(0, 6);
    if (photoIds.length !== data.photoIds.length) throw new Error("Invalid photo order.");
    return { userId: data.userId, photoIds };
  })
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    try {
      const supabaseAdmin = await assertAdmin(context);
      await Promise.all(
        data.photoIds.map((id, position) =>
          supabaseAdmin
            .from("profile_photos")
            .update({ position })
            .eq("id", id)
            .eq("user_id", data.userId),
        ),
      );
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Could not reorder photos.",
      };
    }
  });

export const deleteDemoPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string; photoId: string }) => {
    if (!UUID_RE.test(data.userId) || !UUID_RE.test(data.photoId))
      throw new Error("Invalid photo.");
    return data;
  })
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    try {
      const supabaseAdmin = await assertAdmin(context);
      const { data: photo } = await supabaseAdmin
        .from("profile_photos")
        .select("id, url, storage_path, is_primary")
        .eq("id", data.photoId)
        .eq("user_id", data.userId)
        .maybeSingle();
      if (!photo) return { ok: false, error: "Photo not found." };

      await supabaseAdmin
        .from("profile_photos")
        .delete()
        .eq("id", data.photoId)
        .eq("user_id", data.userId);
      const path = photo.storage_path || photo.url;
      if (path && shouldRemoveStoragePath(path))
        await supabaseAdmin.storage.from(BUCKET).remove([path]);

      if (photo.is_primary) {
        const { data: next } = await supabaseAdmin
          .from("profile_photos")
          .select("id")
          .eq("user_id", data.userId)
          .order("position", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (next)
          await supabaseAdmin.from("profile_photos").update({ is_primary: true }).eq("id", next.id);
      }
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Could not delete photo.",
      };
    }
  });
