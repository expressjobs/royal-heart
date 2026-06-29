import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { genderPreferenceValue } from "@/lib/gender";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type PhotoRow = {
  url: string;
  storage_path: string | null;
  is_primary: boolean;
  position: number;
};
export type ProfileWithPhotos = Profile & {
  photos: PhotoRow[];
  distance_m?: number | null;
  /** AI compatibility percentage (0–100), attached by the matching engine. */
  score?: number | null;
};

export type PhotoSource = Pick<PhotoRow, "url" | "storage_path" | "is_primary">;

const DISCOVER_CACHE_TTL_MS = 45_000;
const PLACEHOLDER_PHOTO_RE = /^\/?(?:placeholder\.svg|seed-profiles\/avatar-[^/?#]+)(?:[?#].*)?$/i;
const discoverCache = new Map<
  string,
  { expiresAt: number; promise: Promise<ProfileWithPhotos[]> }
>();

export function isPlaceholderPhotoPath(path: string | null | undefined): boolean {
  return Boolean(path?.trim() && PLACEHOLDER_PHOTO_RE.test(path.trim()));
}

export function photoPath(photo: Pick<PhotoRow, "url" | "storage_path"> | null | undefined) {
  if (!photo) return null;
  const storagePath = photo.storage_path?.trim();
  if (storagePath && !isPlaceholderPhotoPath(storagePath)) return storagePath;
  const fallbackUrl = photo.url?.trim();
  return fallbackUrl && !isPlaceholderPhotoPath(fallbackUrl) ? fallbackUrl : null;
}

export function primaryPhotoPath(p: ProfileWithPhotos): string | null {
  if (!p.photos || p.photos.length === 0) return null;
  const primary = p.photos.find((ph) => ph.is_primary);
  return photoPath(primary ?? p.photos[0]);
}

export function primaryPhotoFromRows<T extends PhotoSource>(photos: T[] | null | undefined) {
  const list = photos ?? [];
  return photoPath(list.find((p) => p.is_primary) ?? list[0]);
}

async function attachPhotos(profiles: Profile[]): Promise<ProfileWithPhotos[]> {
  if (profiles.length === 0) return [];
  const ids = profiles.map((p) => p.id);
  const { data: photos, error } = await supabase
    .from("profile_photos")
    .select("user_id, url, storage_path, is_primary, position")
    .in("user_id", ids)
    .eq("moderation_status", "approved")
    .or("is_private.eq.false,is_private.is.null")
    .order("is_primary", { ascending: false })
    .order("position", { ascending: true });
  if (error) {
    console.warn("[discover-photos] Approved photo rows could not be loaded", {
      profileCount: ids.length,
      errorCode: error.code ?? null,
    });
    throw error;
  }

  const byUser = new Map<string, PhotoRow[]>();
  for (const ph of photos ?? []) {
    const arr = byUser.get(ph.user_id) ?? [];
    arr.push({
      url: ph.url,
      storage_path: ph.storage_path ?? null,
      is_primary: ph.is_primary,
      position: ph.position,
    });
    byUser.set(ph.user_id, arr);
  }
  return profiles.map((p) => ({ ...p, photos: byUser.get(p.id) ?? [] }));
}

export async function fetchProfilesWithPhotos(ids: string[]): Promise<ProfileWithPhotos[]> {
  if (ids.length === 0) return [];
  // Reads other members through the masked, visibility-aware function: precise
  // GPS coordinates and exact birth dates are stripped for everyone but the owner/admin.
  const { data } = await supabase.rpc("get_visible_profiles", { _ids: ids });
  return attachPhotos((data ?? []) as unknown as Profile[]);
}

export async function fetchOneProfile(id: string): Promise<ProfileWithPhotos | null> {
  const { data } = await supabase.rpc("get_visible_profiles", { _ids: [id] });
  const row = (data ?? [])[0];
  if (!row) return null;
  return (await attachPhotos([row as unknown as Profile]))[0];
}

export interface DiscoverFilters {
  maxDistanceKm?: number | null;
  minAge?: number | null;
  maxAge?: number | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  onlineOnly?: boolean;
  recentlyActive?: boolean;
  verifiedOnly?: boolean;
  premiumOnly?: boolean;
  hasBio?: boolean;
  interests?: string[];
  languages?: string[];
  religion?: string | null;
  education?: string | null;
  relationshipGoal?: string | null;
  profession?: string | null;
  smoking?: string | null;
  drinking?: string | null;
  workout?: string | null;
  familyPlans?: string | null;
  pets?: string | null;
}

/** Recently-active window for the "recently active" toggle. */
const RECENTLY_ACTIVE_MINUTES = 60 * 24 * 3; // 3 days

export interface ViewerPrefs {
  gender: string | null;
  interested_in: string[] | null;
}

/** Maps a profile's `gender` value to the matching `interested_in` category. */
/**
 * Returns true if someone with these `interested_in` preferences would want to
 * see a person of the given `gender`. An empty/unset preference shows everyone.
 */
export function preferenceMatches(
  interestedIn: string[] | null | undefined,
  gender: string | null | undefined,
): boolean {
  if (!interestedIn || interestedIn.length === 0) return true;
  if (interestedIn.includes("everyone")) return true;
  if (!gender) return false;
  const mapped = genderPreferenceValue(gender);
  return mapped ? interestedIn.includes(mapped) : false;
}

/** Online-now is defined as activity within the last 5 minutes. */
const ONLINE_WINDOW_MINUTES = 5;

/** Maps the client filter object to the discover/search RPC argument shape. */
function rpcFilterArgs(filters?: DiscoverFilters) {
  return {
    _max_distance_km: filters?.maxDistanceKm ?? undefined,
    _min_age: filters?.minAge ?? undefined,
    _max_age: filters?.maxAge ?? undefined,
    _country: filters?.country?.trim() || undefined,
    _state: filters?.state?.trim() || undefined,
    _city: filters?.city?.trim() || undefined,
    _online_minutes: filters?.onlineOnly ? ONLINE_WINDOW_MINUTES : undefined,
    _recently_active_minutes: filters?.recentlyActive ? RECENTLY_ACTIVE_MINUTES : undefined,
    _verified_only: filters?.verifiedOnly ?? false,
    _premium_only: filters?.premiumOnly ?? false,
    _has_bio: filters?.hasBio ?? false,
    _interests: filters?.interests && filters.interests.length ? filters.interests : undefined,
    _languages: filters?.languages && filters.languages.length ? filters.languages : undefined,
    _religion: filters?.religion || undefined,
    _education: filters?.education || undefined,
    _relationship_goal: filters?.relationshipGoal || undefined,
    _profession: filters?.profession || undefined,
    _smoking: filters?.smoking || undefined,
    _drinking: filters?.drinking || undefined,
    _workout: filters?.workout || undefined,
    _family_plans: filters?.familyPlans || undefined,
    _pets: filters?.pets || undefined,
  };
}

/** Hydrates a ranked list of {id, distance_m} into ordered profiles with photos. */
async function hydrateRanked(
  ranked: { id: string; distance_m: number | null }[],
): Promise<ProfileWithPhotos[]> {
  if (ranked.length === 0) return [];
  const ids = ranked.map((r) => r.id);
  const distanceById = new Map(ranked.map((r) => [r.id, r.distance_m]));
  const profiles = await fetchProfilesWithPhotos(ids);
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const ordered: ProfileWithPhotos[] = [];
  for (const id of ids) {
    const p = byId.get(id);
    if (p) ordered.push({ ...p, distance_m: distanceById.get(id) ?? null });
  }
  return ordered;
}

/**
 * Builds the discovery deck using the PostGIS-backed `discover_profiles`
 * function for fast, location-aware, server-side filtering. Returns profiles
 * (with photos) ordered by relevance and distance, each carrying `distance_m`.
 */
export async function fetchDiscoverDeck(
  myId: string,
  _viewer?: ViewerPrefs | null,
  filters?: DiscoverFilters,
  limit = 240,
): Promise<ProfileWithPhotos[]> {
  const cacheKey = `${myId}:${limit}:${JSON.stringify(rpcFilterArgs(filters))}`;
  const now = Date.now();
  const cached = discoverCache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.promise;

  const promise = (async () => {
    const [{ data: ranked, error }, { data: reports }] = await Promise.all([
      supabase.rpc("discover_profiles", {
        ...rpcFilterArgs(filters),
        _limit: limit,
      }),
      supabase.from("reports").select("reported_id").not("reported_id", "is", null),
    ]);
    if (error || !ranked) return [];
    const reported = new Set((reports ?? []).map((row) => row.reported_id).filter(Boolean));
    const safeRanked = (ranked as { id: string; distance_m: number | null }[]).filter(
      (row) => !reported.has(row.id),
    );
    return hydrateRanked(safeRanked);
  })();

  discoverCache.set(cacheKey, { expiresAt: now + DISCOVER_CACHE_TTL_MS, promise });
  return promise;
}

export function invalidateDiscoverCache(userId: string) {
  for (const key of discoverCache.keys()) {
    if (key.startsWith(`${userId}:`)) discoverCache.delete(key);
  }
}

export interface SearchPage {
  results: ProfileWithPhotos[];
  total: number;
}

/**
 * Paginated advanced search. Returns one page of matches plus the total count
 * across all pages, and logs the query for analytics.
 */
export async function searchProfiles(
  filters: DiscoverFilters,
  page: number,
  pageSize = 24,
): Promise<SearchPage> {
  const { data, error } = await supabase.rpc("search_profiles", {
    ...rpcFilterArgs(filters),
    _limit: pageSize,
    _offset: page * pageSize,
  });
  if (error || !data) return { results: [], total: 0 };
  const rows = data as { id: string; distance_m: number | null; total_count: number }[];
  const total = rows[0]?.total_count ?? 0;
  const results = await hydrateRanked(rows.map((r) => ({ id: r.id, distance_m: r.distance_m })));

  // Fire-and-forget analytics; first page only to avoid double-counting scroll.
  if (page === 0) {
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) {
      void supabase.from("search_events").insert({
        user_id: auth.user.id,
        filters: JSON.parse(JSON.stringify(filters)) as Json,
        result_count: total,
      });
    }
  }
  return { results, total };
}

export type SectionKind = "recommended" | "trending" | "new_members" | "nearby" | "verified";

/** Fetches a curated discovery section (recommended/trending/new/nearby/verified). */
export async function fetchSection(kind: SectionKind, limit = 12): Promise<ProfileWithPhotos[]> {
  const { data, error } = await supabase.rpc("discover_section", { _kind: kind, _limit: limit });
  if (error || !data) return [];
  return hydrateRanked(data as { id: string; distance_m: number | null }[]);
}
