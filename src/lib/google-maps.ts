/// <reference types="google.maps" />

/**
 * Lazily loads the Google Maps JavaScript API (once) using the Lovable-managed
 * browser key. Resolves when `google.maps` is fully initialized. Returns null
 * if no browser key is configured so callers can fall back gracefully.
 */
let loaderPromise: Promise<typeof google.maps | null> | null = null;

const CALLBACK_NAME = "__heartconnectInitMap";

/**
 * Google does NOT throw when an API key is invalid or the page's referrer is
 * not allowed — the bootstrap script loads (HTTP 200), `new google.maps.Map()`
 * succeeds, and the tiles silently render blank while Google logs an error and
 * invokes the global `window.gm_authFailure` callback. We track that here so
 * map components can fall back to the key-free Leaflet/OSM provider instead of
 * showing an empty grey box (e.g. RefererNotAllowedMapError / InvalidKeyMapError).
 */
let authFailed = false;
const authFailureListeners = new Set<() => void>();

/**
 * Subscribes to Google Maps authentication failures. The callback fires
 * immediately if a failure already occurred. Returns an unsubscribe function.
 */
export function onGoogleMapsAuthFailure(cb: () => void): () => void {
  if (authFailed) cb();
  authFailureListeners.add(cb);
  return () => {
    authFailureListeners.delete(cb);
  };
}

/** True once Google has reported an auth/referrer failure for the loaded key. */
export function googleMapsAuthFailed(): boolean {
  return authFailed;
}

function registerAuthFailureHandler() {
  if (typeof window === "undefined") return;
  (window as unknown as Record<string, unknown>).gm_authFailure = () => {
    authFailed = true;
    authFailureListeners.forEach((cb) => cb());
  };
}

export function loadGoogleMaps(): Promise<typeof google.maps | null> {
  if (loaderPromise) return loaderPromise;

  const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
  const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as
    | string
    | undefined;

  if (typeof window === "undefined") return Promise.resolve(null);
  if (!key) return Promise.resolve(null);

  if (window.google?.maps) return Promise.resolve(window.google.maps);

  registerAuthFailureHandler();

  loaderPromise = new Promise((resolve, reject) => {
    (window as unknown as Record<string, unknown>)[CALLBACK_NAME] = () => {
      resolve(window.google.maps);
    };

    const params = new URLSearchParams({
      key,
      loading: "async",
      callback: CALLBACK_NAME,
      libraries: "marker",
    });
    if (channel) params.set("channel", channel);

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.onerror = () => {
      loaderPromise = null;
      reject(new Error("Failed to load Google Maps"));
    };
    document.head.appendChild(script);
  });

  return loaderPromise;
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

declare global {
  interface Window {
    google: typeof google;
  }
}
