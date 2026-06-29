import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { BadgeCheck, Info, MapPin, Radar } from "lucide-react";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import { VerifiedBadge } from "@/components/TierBadge";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDistance, usesMiles } from "@/lib/geo";
import { loadGoogleMaps, onGoogleMapsAuthFailure } from "@/lib/google-maps";
import {
  destinationPoint,
  memberPosition,
  selectMapProvider,
  type MapProviderId,
} from "@/lib/map-provider";
import { primaryPhotoPath, type ProfileWithPhotos } from "@/lib/profiles";
import { cn } from "@/lib/utils";
import "leaflet/dist/leaflet.css";

const METERS_PER_MILE = 1609.344;

/** Stable 32-bit hash from a string (for deterministic bearings). */
function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Resolves a CSS custom property to a concrete color string for canvas use. */
function cssColor(varName: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const probe = document.createElement("span");
  probe.style.color = `var(${varName})`;
  probe.style.display = "none";
  document.body.appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved || fallback;
}

/**
 * Builds a descriptive accessible label for a tile-based map. Tile maps render
 * to canvas/SVG, so this text (plus the keyboard-navigable member list) is how
 * screen-reader and keyboard users understand and operate the map.
 */
function buildMapLabel(
  count: number,
  radiusKm: number | null | undefined,
  viewerCountry: string | null | undefined,
): string {
  const miles = usesMiles(viewerCountry);
  let radiusText = "";
  if (radiusKm && radiusKm > 0) {
    const value = miles ? Math.round(radiusKm / 1.609344) : Math.round(radiusKm);
    radiusText = `, with a ${value} ${miles ? "mile" : "kilometer"} search-radius circle around you`;
  }
  const memberText =
    count === 0
      ? "No members are currently shown"
      : `${count} ${count === 1 ? "member is" : "members are"} shown as map markers`;
  return (
    `Map of nearby members centered on your approximate location${radiusText}. ` +
    `${memberText}. Use arrow keys to pan the map and the plus and minus controls to zoom. ` +
    `For each member, use the list below the map to open their profile with the keyboard.`
  );
}

/**
 * Keyboard- and screen-reader-accessible equivalent of the visual map markers.
 * Map markers (Google symbols / Leaflet vector circles) are not focusable, so
 * this list is the accessible path to reach every plotted member.
 */
function MapMemberList({
  shown,
  viewerCountry,
}: {
  shown: ProfileWithPhotos[];
  viewerCountry?: string | null;
}) {
  const navigate = useNavigate();
  if (shown.length === 0) return null;
  const sorted = [...shown].sort((a, b) => (a.distance_m ?? 0) - (b.distance_m ?? 0));
  return (
    <nav className="mt-3 border-t border-border pt-3" aria-label="Members shown on the map">
      <h4 className="mb-2 text-xs font-medium text-muted-foreground">
        Members on the map ({sorted.length})
      </h4>
      <ul className="flex flex-wrap gap-1.5">
        {sorted.map((profile) => {
          const name = profile.display_name ?? "Member";
          const distance = formatDistance(profile.distance_m, viewerCountry);
          return (
            <li key={profile.id}>
              <button
                type="button"
                onClick={() => navigate({ to: "/profile/$id", params: { id: profile.id } })}
                aria-label={`View ${name}'s profile${
                  profile.is_verified ? ", verified member" : ""
                }${distance ? `, ${distance} away` : ""}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    profile.is_verified ? "bg-primary" : "bg-muted-foreground",
                  )}
                />
                <span aria-hidden="true">{name}</span>
                {distance && (
                  <span aria-hidden="true" className="text-muted-foreground">
                    · {distance}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

interface NearbyMapProps {
  members: ProfileWithPhotos[];
  viewerCountry?: string | null;
  viewerPhotoPath?: string | null;
  viewerName?: string | null;
  viewerLat?: number | null;
  viewerLng?: number | null;
  radiusKm?: number | null;
  className?: string;
}

/**
 * Proximity map for nearby members. When Google Maps and the viewer's own
 * location are available it renders real map tiles; otherwise it falls back to
 * a key-free radar. We never receive other members' exact coordinates — each
 * member is plotted at their reported distance along a deterministic bearing,
 * so this visualizes closeness without revealing where anyone actually is.
 */
export function NearbyMap(props: NearbyMapProps) {
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  // Provider is chosen on the client only: Google on Lovable hosts with the
  // managed key, OpenStreetMap/Leaflet everywhere else (incl. custom domains).
  const [provider, setProvider] = useState<MapProviderId | null>(null);
  useEffect(() => {
    setProvider(selectMapProvider());
  }, []);

  const hasViewerLoc =
    props.viewerLat != null &&
    props.viewerLng != null &&
    Number.isFinite(props.viewerLat) &&
    Number.isFinite(props.viewerLng);

  const withDistance = useMemo(
    () => props.members.filter((m) => m.distance_m != null && Number.isFinite(m.distance_m)),
    [props.members],
  );
  const shown = useMemo(
    () => (verifiedOnly ? withDistance.filter((m) => m.is_verified) : withDistance),
    [withDistance, verifiedOnly],
  );

  const maxMeters = useMemo(() => {
    const fromFilter = props.radiusKm != null && props.radiusKm > 0 ? props.radiusKm * 1000 : 0;
    const fromMembers = shown.reduce((m, p) => Math.max(m, p.distance_m ?? 0), 0);
    return Math.max(fromFilter, fromMembers, 1000);
  }, [props.radiusKm, shown]);

  const miles = usesMiles(props.viewerCountry);
  const unit = miles ? "mi" : "km";
  const ringValue = (frac: number) => {
    const meters = maxMeters * frac;
    const value = miles ? meters / METERS_PER_MILE : meters / 1000;
    return value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  };

  return (
    <div className={cn("rounded-3xl border border-border bg-card p-4 sm:p-6", props.className)}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Radar className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-display text-base font-semibold leading-tight">Nearby map</h3>
            <p className="text-xs text-muted-foreground">
              {shown.length} {shown.length === 1 ? "member" : "members"} within {ringValue(1)}{" "}
              {unit}
            </p>
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <BadgeCheck aria-hidden="true" className="h-4 w-4 text-primary" />
          <span className="text-muted-foreground">Verified only</span>
          <Switch
            checked={verifiedOnly}
            onCheckedChange={setVerifiedOnly}
            aria-label="Show verified members only"
          />
        </label>
      </div>

      {(() => {
        const radar = (
          <RadarMap
            {...props}
            shown={shown}
            maxMeters={maxMeters}
            unit={unit}
            ringValue={ringValue}
          />
        );
        if (!hasViewerLoc) return radar;
        const leaflet = (
          <LeafletNearbyMap {...props} shown={shown} maxMeters={maxMeters} fallback={radar} />
        );
        // Wait for client-side provider selection before mounting tiles.
        if (provider === null) return radar;
        if (provider === "google") {
          return (
            <GoogleNearbyMap {...props} shown={shown} maxMeters={maxMeters} fallback={leaflet} />
          );
        }
        return leaflet;
      })()}

      <p className="mt-4 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Positions are approximate — exact locations are never shared. Tap a member to view their
        profile.
      </p>
    </div>
  );
}

type InnerProps = NearbyMapProps & {
  shown: ProfileWithPhotos[];
  maxMeters: number;
};

/** Real Google Maps tiles with privacy-preserving member placement. */
function GoogleNearbyMap({
  shown,
  maxMeters,
  viewerLat,
  viewerLng,
  viewerCountry,
  radiusKm,
  fallback,
}: InnerProps & { fallback: React.ReactNode }) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const overlaysRef = useRef<google.maps.MVCObject[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  // Initialize the map once.
  useEffect(() => {
    let cancelled = false;
    // If Google rejects the key/referrer at runtime (RefererNotAllowedMapError,
    // InvalidKeyMapError, etc.) the script still loads and Map() never throws —
    // the tiles just render blank. gm_authFailure is the only reliable signal,
    // so subscribe to it and fall back to the key-free Leaflet map.
    const unsubscribe = onGoogleMapsAuthFailure(() => {
      if (!cancelled) setStatus("error");
    });
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !maps || !containerRef.current) {
          if (!maps) setStatus("error");
          return;
        }
        mapRef.current = new maps.Map(containerRef.current, {
          center: { lat: viewerLat as number, lng: viewerLng as number },
          zoom: 11,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "greedy",
          clickableIcons: false,
        });
        setStatus("ready");
      })
      .catch(() => !cancelled && setStatus("error"));
    return () => {
      cancelled = true;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Render markers when data or map readiness changes.
  useEffect(() => {
    const maps = window.google?.maps;
    const map = mapRef.current;
    if (status !== "ready" || !maps || !map) return;

    overlaysRef.current.forEach((o) => (o as google.maps.Marker | google.maps.Circle).setMap(null));
    overlaysRef.current = [];

    const center = { lat: viewerLat as number, lng: viewerLng as number };
    const primary = cssColor("--primary", "#e94560");
    const muted = cssColor("--muted-foreground", "#888888");
    const bg = cssColor("--card", "#ffffff");
    const bounds = new maps.LatLngBounds();
    bounds.extend(center);

    // Viewer marker.
    overlaysRef.current.push(
      new maps.Marker({
        map,
        position: center,
        zIndex: 1000,
        title: "You",
        icon: {
          path: maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: primary,
          fillOpacity: 1,
          strokeColor: bg,
          strokeWeight: 3,
        },
      }),
    );

    // Radius circle.
    if (radiusKm && radiusKm > 0) {
      overlaysRef.current.push(
        new maps.Circle({
          map,
          center,
          radius: radiusKm * 1000,
          strokeColor: primary,
          strokeOpacity: 0.5,
          strokeWeight: 1,
          fillColor: primary,
          fillOpacity: 0.06,
        }),
      );
      bounds.union(
        new maps.LatLngBounds(
          destinationPoint(center.lat, center.lng, 225, radiusKm * 1000),
          destinationPoint(center.lat, center.lng, 45, radiusKm * 1000),
        ),
      );
    }

    const info = new maps.InfoWindow();

    shown.forEach((profile) => {
      const h = hashString(profile.id);
      const bearing = (h % 3600) / 10;
      const jitter = ((h >> 12) % 100) / 100;
      const dist = (profile.distance_m ?? 0) * (0.96 + jitter * 0.08);
      const pos = destinationPoint(center.lat, center.lng, bearing, dist);
      const marker = new maps.Marker({
        map,
        position: pos,
        title: profile.display_name ?? "Member",
        icon: {
          path: maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: profile.is_verified ? primary : muted,
          fillOpacity: 0.95,
          strokeColor: bg,
          strokeWeight: 2,
        },
      });
      const distance = formatDistance(profile.distance_m, viewerCountry);
      marker.addListener("mouseover", () => {
        info.setContent(
          `<div style="font:600 12px system-ui;padding:2px 4px">${(
            profile.display_name ?? "Member"
          ).replace(
            /[<>&]/g,
            "",
          )}${distance ? `<div style="font-weight:400;color:#666">${distance}</div>` : ""}</div>`,
        );
        info.open(map, marker);
      });
      marker.addListener("mouseout", () => info.close());
      marker.addListener("click", () =>
        navigate({ to: "/profile/$id", params: { id: profile.id } }),
      );
      overlaysRef.current.push(marker);
      bounds.extend(pos);
    });

    if (shown.length > 0 || (radiusKm && radiusKm > 0)) {
      map.fitBounds(bounds, 48);
    }
  }, [status, shown, maxMeters, viewerLat, viewerLng, viewerCountry, radiusKm, navigate]);

  if (status === "error") return <>{fallback}</>;

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl border border-border">
        <div
          ref={containerRef}
          role="application"
          aria-roledescription="interactive map"
          aria-label={buildMapLabel(shown.length, radiusKm, viewerCountry)}
          className="aspect-square w-full sm:aspect-[16/10]"
        />
        {status === "loading" && (
          <div className="absolute inset-0 grid place-items-center bg-muted/60">
            <MapPin className="h-6 w-6 animate-pulse text-muted-foreground" />
            <span className="sr-only">Loading map…</span>
          </div>
        )}
      </div>
      <MapMemberList shown={shown} viewerCountry={viewerCountry} />
    </>
  );
}

/**
 * Production-safe OpenStreetMap + Leaflet map. Requires no API key, so it works
 * on custom domains (e.g. www.royal-heart.com). Mirrors the Google provider:
 * viewer marker, radius circle, verified/unverified member markers placed at
 * their reported distance along a deterministic bearing (privacy-safe).
 */
function LeafletNearbyMap({
  shown,
  viewerLat,
  viewerLng,
  viewerCountry,
  radiusKm,
  fallback,
}: InnerProps & { fallback: React.ReactNode }) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerRef = useRef<import("leaflet").Layer[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  // Initialize the Leaflet map once (dynamic import keeps it client-only).
  useEffect(() => {
    let cancelled = false;
    let map: import("leaflet").Map | null = null;
    import("leaflet")
      .then(({ default: L }) => {
        if (cancelled || !containerRef.current) return;
        map = L.map(containerRef.current, {
          center: [viewerLat as number, viewerLng as number],
          zoom: 11,
          zoomControl: true,
          attributionControl: true,
          scrollWheelZoom: false,
        });
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);
        mapRef.current = map;
        // Give the zoom controls explicit accessible names for screen readers.
        const root = containerRef.current;
        root.querySelector(".leaflet-control-zoom-in")?.setAttribute("aria-label", "Zoom in");
        root.querySelector(".leaflet-control-zoom-out")?.setAttribute("aria-label", "Zoom out");
        // Leaflet needs a size recalculation once the container is laid out.
        setTimeout(() => map?.invalidateSize(), 0);
        setStatus("ready");
      })
      .catch(() => !cancelled && setStatus("error"));
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Render markers / radius whenever data changes.
  useEffect(() => {
    const map = mapRef.current;
    if (status !== "ready" || !map) return;
    let cancelled = false;

    import("leaflet").then(({ default: L }) => {
      if (cancelled || !mapRef.current) return;
      layerRef.current.forEach((l) => l.remove());
      layerRef.current = [];

      const center: [number, number] = [viewerLat as number, viewerLng as number];
      const primary = cssColor("--primary", "#e94560");
      const muted = cssColor("--muted-foreground", "#888888");
      const bg = cssColor("--card", "#ffffff");
      const bounds = L.latLngBounds([center]);

      // Viewer marker.
      const viewer = L.circleMarker(center, {
        radius: 8,
        color: bg,
        weight: 3,
        fillColor: primary,
        fillOpacity: 1,
      })
        .bindTooltip("You", { direction: "top" })
        .addTo(map);
      layerRef.current.push(viewer);

      // Radius circle.
      if (radiusKm && radiusKm > 0) {
        const circle = L.circle(center, {
          radius: radiusKm * 1000,
          color: primary,
          opacity: 0.5,
          weight: 1,
          fillColor: primary,
          fillOpacity: 0.06,
        }).addTo(map);
        layerRef.current.push(circle);
        bounds.extend(circle.getBounds());
      }

      shown.forEach((profile) => {
        const pos = memberPosition(profile.id, center[0], center[1], profile.distance_m ?? 0);
        const distance = formatDistance(profile.distance_m, viewerCountry);
        const name = (profile.display_name ?? "Member").replace(/[<>&]/g, "");
        const marker = L.circleMarker([pos.lat, pos.lng], {
          radius: 7,
          color: bg,
          weight: 2,
          fillColor: profile.is_verified ? primary : muted,
          fillOpacity: 0.95,
        })
          .bindTooltip(
            `<strong>${name}</strong>${distance ? `<br/><span style="color:#888">${distance}</span>` : ""}`,
            { direction: "top" },
          )
          .addTo(map);
        marker.on("click", () => navigate({ to: "/profile/$id", params: { id: profile.id } }));
        layerRef.current.push(marker);
        bounds.extend([pos.lat, pos.lng]);
      });

      if (shown.length > 0 || (radiusKm && radiusKm > 0)) {
        map.fitBounds(bounds, { padding: [48, 48] });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [status, shown, viewerLat, viewerLng, viewerCountry, radiusKm, navigate]);

  if (status === "error") return <>{fallback}</>;

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl border border-border">
        <div
          ref={containerRef}
          role="application"
          aria-roledescription="interactive map"
          aria-label={buildMapLabel(shown.length, radiusKm, viewerCountry)}
          className="aspect-square w-full sm:aspect-[16/10]"
        />
        {status === "loading" && (
          <div className="absolute inset-0 grid place-items-center bg-muted/60">
            <MapPin className="h-6 w-6 animate-pulse text-muted-foreground" />
            <span className="sr-only">Loading map…</span>
          </div>
        )}
      </div>
      <MapMemberList shown={shown} viewerCountry={viewerCountry} />
    </>
  );
}

/** Key-free radar fallback used when Maps or the viewer's location is absent. */
function RadarMap({
  shown,
  maxMeters,
  viewerCountry,
  viewerPhotoPath,
  viewerName,
  unit,
  ringValue,
}: InnerProps & { unit: string; ringValue: (frac: number) => number }) {
  const navigate = useNavigate();

  const plotted = useMemo(() => {
    return shown.map((profile) => {
      const h = hashString(profile.id);
      const angle = (h % 3600) / 10;
      const jitter = ((h >> 12) % 100) / 100;
      const frac = Math.min(0.97, Math.max(0.1, (profile.distance_m ?? 0) / maxMeters));
      const radius = Math.min(0.97, frac + (jitter - 0.5) * 0.04);
      const rad = (angle * Math.PI) / 180;
      return {
        profile,
        left: 50 + Math.cos(rad) * radius * 46,
        top: 50 + Math.sin(rad) * radius * 46,
      };
    });
  }, [shown, maxMeters]);

  return (
    <div
      role="group"
      aria-roledescription="proximity radar"
      aria-label={buildMapLabel(shown.length, null, viewerCountry)}
      className="relative mx-auto aspect-square w-full max-w-md"
    >
      {[1, 0.75, 0.5, 0.25].map((frac) => (
        <div
          key={frac}
          aria-hidden="true"
          className="absolute rounded-full border border-border/70"
          style={{
            left: `${50 - frac * 46}%`,
            top: `${50 - frac * 46}%`,
            width: `${frac * 92}%`,
            height: `${frac * 92}%`,
          }}
        >
          <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-card px-1.5 text-[10px] font-medium text-muted-foreground">
            {ringValue(frac)} {unit}
          </span>
        </div>
      ))}

      <div
        aria-hidden="true"
        className="absolute left-1/2 top-[4%] h-[92%] w-px -translate-x-1/2 bg-border/50"
      />
      <div
        aria-hidden="true"
        className="absolute top-1/2 left-[4%] h-px w-[92%] -translate-y-1/2 bg-border/50"
      />

      <div aria-hidden="true" className="absolute inset-[4%] overflow-hidden rounded-full">
        <div
          className="absolute inset-0 animate-spin rounded-full opacity-40 [animation-duration:6s]"
          style={{
            background:
              "conic-gradient(from 0deg, transparent 0deg, transparent 300deg, color-mix(in oklab, var(--primary) 40%, transparent) 360deg)",
          }}
        />
      </div>

      <TooltipProvider delayDuration={100}>
        {plotted.map(({ profile, left, top }) => {
          const distance = formatDistance(profile.distance_m, viewerCountry);
          return (
            <Tooltip key={profile.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => navigate({ to: "/profile/$id", params: { id: profile.id } })}
                  className="group absolute z-10 -translate-x-1/2 -translate-y-1/2 transition-transform hover:z-20 hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                  style={{ left: `${left}%`, top: `${top}%` }}
                  aria-label={`${profile.display_name ?? "Member"}${distance ? `, ${distance}` : ""}`}
                >
                  <span className="relative block h-10 w-10 overflow-hidden rounded-full border-2 border-background shadow-card">
                    <ProfilePhoto
                      path={primaryPhotoPath(profile)}
                      alt={profile.display_name ?? "Member"}
                      rounded="rounded-full"
                      className="h-full w-full object-cover"
                    />
                  </span>
                  {profile.is_verified && (
                    <span className="absolute -right-1 -top-1">
                      <VerifiedBadge className="h-4 w-4" />
                    </span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs font-semibold">{profile.display_name ?? "Member"}</p>
                {distance && <p className="text-[11px] text-muted-foreground">{distance}</p>}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </TooltipProvider>

      <div
        className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-center"
        role="img"
        aria-label={`${viewerName ?? "You"} — your location at the center`}
      >
        <span className="relative block h-11 w-11 overflow-hidden rounded-full border-2 border-primary shadow-card ring-2 ring-primary/30">
          <ProfilePhoto
            path={viewerPhotoPath}
            alt=""
            rounded="rounded-full"
            className="h-full w-full object-cover"
          />
        </span>
      </div>

      {shown.length === 0 && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="rounded-2xl bg-card/80 px-4 py-3 text-center backdrop-blur-sm">
            <MapPin className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-1 text-sm text-muted-foreground">No members nearby yet.</p>
          </div>
        </div>
      )}
    </div>
  );
}
