// Location & distance helpers for the discovery system.

const MILES_COUNTRIES = new Set([
  "united states",
  "united states of america",
  "usa",
  "us",
  "u.s.",
  "u.s.a.",
  "united kingdom",
  "uk",
  "u.k.",
  "great britain",
  "england",
  "scotland",
  "wales",
  "northern ireland",
  "myanmar",
  "liberia",
]);

const METERS_PER_MILE = 1609.344;

/** Whether distances should be shown in miles for the given country. */
export function usesMiles(country: string | null | undefined): boolean {
  if (!country) return false;
  return MILES_COUNTRIES.has(country.trim().toLowerCase());
}

/**
 * Formats a distance (in meters) into a friendly label like "4 km away"
 * or "3 miles away", using the viewer's country to pick the unit.
 */
export function formatDistance(
  meters: number | null | undefined,
  viewerCountry: string | null | undefined,
): string | null {
  if (meters == null || !Number.isFinite(meters)) return null;
  const miles = usesMiles(viewerCountry);
  const value = miles ? meters / METERS_PER_MILE : meters / 1000;
  const unit = miles ? "mile" : "km";

  if (value < 1) {
    return miles ? "Less than a mile away" : "Less than 1 km away";
  }
  const rounded = Math.round(value);
  if (miles) return `${rounded} ${rounded === 1 ? "mile" : "miles"} away`;
  return `${rounded} ${unit} away`;
}

export interface DetectedLocation {
  latitude: number;
  longitude: number;
  city: string | null;
  state: string | null;
  country: string | null;
}

/**
 * Reverse-geocodes coordinates to a city/state/country using BigDataCloud's
 * free, key-less client endpoint. Returns coordinates with null place names
 * if the lookup fails so we can still store the GPS fix.
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<DetectedLocation> {
  const base: DetectedLocation = { latitude, longitude, city: null, state: null, country: null };
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
    );
    if (!res.ok) return base;
    const data = (await res.json()) as {
      city?: string;
      locality?: string;
      principalSubdivision?: string;
      countryName?: string;
    };
    return {
      latitude,
      longitude,
      city: data.city || data.locality || null,
      state: data.principalSubdivision || null,
      country: data.countryName || null,
    };
  } catch {
    return base;
  }
}

/** Reasons GPS detection can fail, mapped to friendly, actionable messages. */
export type GeoErrorKind =
  | "unsupported"
  | "insecure"
  | "denied"
  | "unavailable"
  | "timeout"
  | "unknown";

export class GeoError extends Error {
  kind: GeoErrorKind;
  constructor(kind: GeoErrorKind, message: string) {
    super(message);
    this.kind = kind;
    this.name = "GeoError";
  }
}

export const GEO_MESSAGES: Record<GeoErrorKind, string> = {
  unsupported: "Your browser doesn't support location detection. Enter your city manually below.",
  insecure:
    "Location requires a secure (https) connection. Enter your city manually below, or open the site over https.",
  denied:
    "Location permission was blocked. Allow location for this site in your browser settings, or enter your city manually below.",
  unavailable:
    "We couldn't determine your location right now. Try again, or enter your city manually below.",
  timeout: "Detecting your location took too long. Try again, or enter your city manually below.",
  unknown: "Couldn't detect your location. Try again, or enter your city manually below.",
};

/** Promisified browser geolocation request with explicit failure reasons. */
export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      reject(new GeoError("unsupported", GEO_MESSAGES.unsupported));
      return;
    }
    // Geolocation only works in a secure context (https or localhost).
    if (typeof window !== "undefined" && window.isSecureContext === false) {
      reject(new GeoError("insecure", GEO_MESSAGES.insecure));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      resolve,
      (err) => {
        const kind: GeoErrorKind =
          err.code === err.PERMISSION_DENIED
            ? "denied"
            : err.code === err.POSITION_UNAVAILABLE
              ? "unavailable"
              : err.code === err.TIMEOUT
                ? "timeout"
                : "unknown";
        reject(new GeoError(kind, GEO_MESSAGES[kind]));
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
      },
    );
  });
}

/**
 * Forward-geocodes a manually entered place (city/state/country) into
 * coordinates using OpenStreetMap's key-free Nominatim service. This lets
 * members who can't or won't share GPS still appear in distance-based
 * discovery. Returns null if nothing matches.
 */
export async function forwardGeocode(
  city: string,
  state: string,
  country: string,
): Promise<{ latitude: number; longitude: number } | null> {
  const q = [city, state, country]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");
  if (!q) return null;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!data.length) return null;
    const lat = Number(data[0].lat);
    const lon = Number(data[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { latitude: lat, longitude: lon };
  } catch {
    return null;
  }
}
