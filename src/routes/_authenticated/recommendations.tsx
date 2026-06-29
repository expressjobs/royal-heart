import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Loader2,
  Sparkles,
  Flame,
  UserPlus,
  BadgeCheck,
  MapPin,
  Heart,
  Search,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/AppShell";
import { ProfileCard } from "@/components/ProfileCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchSection, type ProfileWithPhotos } from "@/lib/profiles";
import { fetchRecommended, fetchDailyRecommendations, logInteraction } from "@/lib/compatibility";

export const Route = createFileRoute("/_authenticated/recommendations")({
  head: () => ({ meta: [{ title: "For You — HeartConnect" }] }),
  component: () => (
    <AppShell>
      <Recommendations />
    </AppShell>
  ),
});

type TabKey = "recommended" | "compatible" | "nearby" | "new" | "verified" | "trending";

const TABS: { key: TabKey; label: string; icon: typeof Sparkles }[] = [
  { key: "recommended", label: "AI Recommended", icon: Sparkles },
  { key: "compatible", label: "Highly Compatible", icon: Heart },
  { key: "nearby", label: "Nearby Compatible", icon: MapPin },
  { key: "new", label: "New Members", icon: UserPlus },
  { key: "verified", label: "Verified", icon: BadgeCheck },
  { key: "trending", label: "Trending", icon: Flame },
];

async function loadTab(key: TabKey): Promise<ProfileWithPhotos[]> {
  switch (key) {
    case "recommended":
      return fetchRecommended("recommended", 36);
    case "compatible":
      return fetchRecommended("compatible", 36);
    case "nearby":
      return fetchRecommended("nearby_compatible", 36);
    case "new":
      return fetchSection("new_members", 24);
    case "verified":
      return fetchSection("verified", 24);
    case "trending":
      return fetchSection("trending", 24);
  }
}

function Recommendations() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<TabKey>("recommended");
  const [cache, setCache] = useState<Record<string, ProfileWithPhotos[]>>({});
  const [daily, setDaily] = useState<ProfileWithPhotos[]>([]);
  const [loading, setLoading] = useState(true);
  const [dailyLoading, setDailyLoading] = useState(true);

  const load = useCallback(
    async (key: TabKey) => {
      if (cache[key]) return;
      setLoading(true);
      const items = await loadTab(key);
      setCache((c) => ({ ...c, [key]: items }));
      setLoading(false);
      if (items.length) {
        logInteraction("recommendation_shown", null, { tab: key, count: items.length });
      }
    },
    [cache],
  );

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  useEffect(() => {
    let active = true;
    fetchDailyRecommendations(10).then((items) => {
      if (!active) return;
      setDaily(items);
      setDailyLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const items = cache[tab] ?? [];
  const showLoading = loading && !cache[tab];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">For You</h1>
          <p className="text-sm text-muted-foreground">
            AI-matched picks based on your compatibility.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="rounded-full">
          <Link to="/search">
            <Search className="h-4 w-4" /> Advanced search
          </Link>
        </Button>
      </div>

      {/* Daily recommended matches */}
      <section className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-display text-lg font-semibold leading-tight">Your daily matches</h2>
            <p className="text-xs text-muted-foreground">A fresh set of top picks every day.</p>
          </div>
        </div>
        {dailyLoading ? (
          <div className="grid h-40 place-items-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : daily.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground">
            No daily matches yet — complete your profile and check back tomorrow.
          </p>
        ) : (
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
            {daily.map((p) => (
              <ProfileCard
                key={p.id}
                profile={p}
                viewerCountry={profile?.location_country}
                className="w-40 shrink-0 sm:w-48"
                onSelect={() => logInteraction("recommendation_clicked", p.id, { tab: "daily" })}
              />
            ))}
          </div>
        )}
      </section>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList className="mb-6 flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/60 p-1">
          {TABS.map((t) => (
            <TabsTrigger
              key={t.key}
              value={t.key}
              className="gap-1.5 rounded-lg data-[state=active]:bg-card"
            >
              <t.icon className="h-4 w-4" />
              <span>{t.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map((t) => (
          <TabsContent key={t.key} value={t.key}>
            {showLoading ? (
              <div className="grid h-[40vh] place-items-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : items.length === 0 ? (
              <div className="grid h-[40vh] place-items-center rounded-3xl border border-dashed border-border bg-card/50 p-8 text-center">
                <div>
                  <t.icon className="mx-auto h-10 w-10 text-primary" />
                  <h3 className="mt-3 font-display text-lg font-semibold">Nothing here yet</h3>
                  <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                    Try widening your filters or check back as more people join.
                  </p>
                  <Button asChild variant="hero" className="mt-4 rounded-full">
                    <Link to="/discover">Go to Discover</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {items.map((p) => (
                  <ProfileCard
                    key={p.id}
                    profile={p}
                    viewerCountry={profile?.location_country}
                    onSelect={() => logInteraction("recommendation_clicked", p.id, { tab: t.key })}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
