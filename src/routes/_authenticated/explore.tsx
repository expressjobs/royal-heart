import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Loader2,
  Sparkles,
  Flame,
  UserPlus,
  MapPin,
  BadgeCheck,
  Search,
  Radar,
  LayoutGrid,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ProfileCard } from "@/components/ProfileCard";
import { NearbyMap } from "@/components/NearbyMap";
import { Button } from "@/components/ui/button";
import {
  fetchSection,
  primaryPhotoFromRows,
  type ProfileWithPhotos,
  type SectionKind,
} from "@/lib/profiles";

export const Route = createFileRoute("/_authenticated/explore")({
  head: () => ({ meta: [{ title: "Explore — HeartConnect" }] }),
  component: () => (
    <AppShell>
      <Explore />
    </AppShell>
  ),
});

const SECTIONS: { kind: SectionKind; title: string; subtitle: string; icon: typeof Sparkles }[] = [
  {
    kind: "recommended",
    title: "Recommended for you",
    subtitle: "Based on your interests and goals",
    icon: Sparkles,
  },
  { kind: "trending", title: "Trending now", subtitle: "Most liked this week", icon: Flame },
  {
    kind: "new_members",
    title: "New members",
    subtitle: "Just joined HeartConnect",
    icon: UserPlus,
  },
  { kind: "nearby", title: "Nearby", subtitle: "People close to you", icon: MapPin },
  {
    kind: "verified",
    title: "Verified members",
    subtitle: "Confirmed real people",
    icon: BadgeCheck,
  },
];

function Explore() {
  const { user, profile } = useAuth();
  const [data, setData] = useState<Record<string, ProfileWithPhotos[]>>({});
  const [nearby, setNearby] = useState<ProfileWithPhotos[]>([]);
  const [myPhoto, setMyPhoto] = useState<string | null>(null);
  const [nearbyView, setNearbyView] = useState<"list" | "map">("list");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [results, nearbyFull, myPhotos] = await Promise.all([
      Promise.all(SECTIONS.map((s) => fetchSection(s.kind))),
      fetchSection("nearby", 48),
      user
        ? supabase
            .from("profile_photos")
            .select("url, storage_path, is_primary")
            .eq("user_id", user.id)
            .eq("moderation_status", "approved")
            .or("is_private.eq.false,is_private.is.null")
            .order("is_primary", { ascending: false })
            .order("position", { ascending: true })
        : Promise.resolve({
            data: [] as { url: string; storage_path: string | null; is_primary: boolean }[],
          }),
    ]);
    const next: Record<string, ProfileWithPhotos[]> = {};
    SECTIONS.forEach((s, i) => (next[s.kind] = results[i]));
    setData(next);
    setNearby(nearbyFull);
    setMyPhoto(primaryPhotoFromRows(myPhotos.data));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Explore</h1>
          <p className="text-sm text-muted-foreground">Discover people across HeartConnect.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="hero" size="sm" className="rounded-full">
            <Link to="/recommendations">
              <Sparkles className="h-4 w-4" /> For You
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link to="/search">
              <Search className="h-4 w-4" /> Advanced search
            </Link>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid h-[60vh] place-items-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-9">
          {SECTIONS.map((s) => {
            const items = data[s.kind] ?? [];
            if (items.length === 0) return null;
            return (
              <section key={s.kind}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <s.icon className="h-5 w-5 text-primary" />
                    <div>
                      <h2 className="font-display text-lg font-semibold leading-tight">
                        {s.title}
                      </h2>
                      <p className="text-xs text-muted-foreground">{s.subtitle}</p>
                    </div>
                  </div>
                  {s.kind === "nearby" && (
                    <div className="flex shrink-0 rounded-full border border-border p-0.5">
                      <button
                        type="button"
                        onClick={() => setNearbyView("list")}
                        className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${nearbyView === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                        aria-pressed={nearbyView === "list"}
                      >
                        <LayoutGrid className="h-3.5 w-3.5" /> List
                      </button>
                      <button
                        type="button"
                        onClick={() => setNearbyView("map")}
                        className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${nearbyView === "map" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                        aria-pressed={nearbyView === "map"}
                      >
                        <Radar className="h-3.5 w-3.5" /> Map
                      </button>
                    </div>
                  )}
                </div>
                {s.kind === "nearby" && nearbyView === "map" ? (
                  <NearbyMap
                    members={nearby.length ? nearby : items}
                    viewerCountry={profile?.location_country}
                    viewerPhotoPath={myPhoto}
                    viewerName={profile?.display_name}
                    viewerLat={profile?.latitude}
                    viewerLng={profile?.longitude}
                  />
                ) : (
                  <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
                    {items.map((p) => (
                      <ProfileCard
                        key={p.id}
                        profile={p}
                        viewerCountry={profile?.location_country}
                        className="w-40 shrink-0 sm:w-48"
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
          {SECTIONS.every((s) => (data[s.kind] ?? []).length === 0) && (
            <div className="grid h-[50vh] place-items-center rounded-3xl border border-dashed border-border bg-card/50 p-8 text-center">
              <div>
                <Sparkles className="mx-auto h-10 w-10 text-primary" />
                <h2 className="mt-4 font-display text-xl font-semibold">Nothing here yet</h2>
                <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                  Check back soon as more people join, or try the swipe deck.
                </p>
                <Button asChild variant="hero" className="mt-5 rounded-full">
                  <Link to="/discover">Go to Discover</Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
