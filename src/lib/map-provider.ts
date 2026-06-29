/**
 * Map provider abstraction layer.
 *
 * HeartConnect renders an interactive proximity map two ways:
 *  - Google Maps  — used only when an explicit browser key is configured.
 *  - OpenStreetMap + Leaflet — a production-safe, key-free fallback used on
 *    royal-heart.com when no Google Maps key is configured.
 *
 * The selection is automatic and requires no Google Maps API key in
 * production. Both providers share the same geometry helpers so the Nearby
 * Users feature (radius circle, distance plotting, verified markers, viewer
 * marker, privacy-safe approximate coordinates) behaves identically.
 */

export type MapProviderId = "google" | "osm";

/** True when running on a local development host. */
export function isLocalHost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

/** True when a Google Maps browser key is configured at build time. */
export function hasGoogleMapsKey(): boolean {
  return Boolean(import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY);
}

/**
 * Picks the best available map provider.
 *
 * Google Maps is only attempted for local development when an explicit browser
 * key is present. Production uses the key-free OpenStreetMap/Leaflet provider
 * so the map always works on royal-heart.com.
 */
export function selectMapProvider(): MapProviderId {
  if (isLocalHost() && hasGoogleMapsKey()) return "google";
  return "osm";
}

const EARTH_RADIUS_M = 6_371_000;

/**
 * Computes a destination point given a start coordinate, a bearing (degrees),
 * and a distance (meters). Used to plot a member at their reported distance
 * along a deterministic bearing — their exact coordinates are never exposed.
 */
export function destinationPoint(
  lat: number,
  lng: number,
  bearingDeg: number,
  distanceM: number,
): { lat: number; lng: number } {
  const δ = distanceM / EARTH_RADIUS_M;
  const θ = (bearingDeg * Math.PI) / 180;
  const φ1 = (lat * Math.PI) / 180;
  const λ1 = (lng * Math.PI) / 180;

  const sinφ2 = Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ);
  const φ2 = Math.asin(sinφ2);
  const y = Math.sin(θ) * Math.sin(δ) * Math.cos(φ1);
  const x = Math.cos(δ) - Math.sin(φ1) * sinφ2;
  const λ2 = λ1 + Math.atan2(y, x);

  return {
    lat: (φ2 * 180) / Math.PI,
    lng: (((λ2 * 180) / Math.PI + 540) % 360) - 180,
  };
}

/** Stable 32-bit hash from a string (for deterministic bearings/jitter). */
export function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Resolves a member's privacy-safe map position: their reported distance from
 * the viewer is preserved, but the bearing is deterministic-per-id with a
 * small jitter so exact coordinates are never revealed.
 */
export function memberPosition(
  id: string,
  centerLat: number,
  centerLng: number,
  distanceM: number,
): { lat: number; lng: number } {
  const h = hashString(id);
  const bearing = (h % 3600) / 10;
  const jitter = ((h >> 12) % 100) / 100;
  const dist = distanceM * (0.96 + jitter * 0.08);
  return destinationPoint(centerLat, centerLng, bearing, dist);
}
