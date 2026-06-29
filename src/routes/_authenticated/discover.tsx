import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  Ban,
  Compass,
  Flag,
  Layers,
  Loader2,
  MapPin,
  MoreVertical,
  Radar,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { ComfortControls } from "@/components/ComfortControls";
import {
  DiscoverFiltersSheet,
  DEFAULT_FILTERS,
  activeFilterCount,
} from "@/components/DiscoverFilters";
import { DiscoverActions } from "@/components/discover/DiscoverActions";
import { ProfileDetailSheet } from "@/components/discover/ProfileDetailSheet";
import { SwipeDeck } from "@/components/discover/SwipeDeck";
import { UpgradeModal } from "@/components/discover/UpgradeModal";
import { FilterPresetsBar } from "@/components/FilterPresetsBar";
import { MatchModal } from "@/components/MatchModal";
import { NearbyMap } from "@/components/NearbyMap";
import { ReportDialog, blockUser } from "@/components/ReportDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useDiscoverQueue } from "@/hooks/useDiscoverQueue";
import { fetchOneCompatibility, logInteraction, type CompatBreakdown } from "@/lib/compatibility";
import {
  createDiscoverReaction,
  getDiscoverDiagnostics,
  getDiscoverLikeAllowance,
  type DiscoverDiagnostics,
  type DiscoverLikeAllowance,
} from "@/lib/discover.functions";
import type { DiscoverFilters } from "@/lib/profiles";
import { primaryPhotoPath } from "@/lib/profiles";
import { getSignedUrls } from "@/lib/storage";
import { cn } from "@/lib/utils";

type DiscoveryProfile = NonNullable<ReturnType<typeof useAuth>["profile"]> & {
  discovery_blocked_reason?: string | null;
};

const UPGRADE_COPY =
  "Upgrade to start connecting with members. Choose Gold or Platinum to like, match, and message.";

export const Route = createFileRoute("/_authenticated/discover")({
  head: () => ({ meta: [{ title: "Discover - HeartConnect" }] }),
  component: () => (
    <AppShell>
      <Discover />
    </AppShell>
  ),
});

function isPaidRomanticTier(tier: string | null | undefined) {
  return tier === "gold" || tier === "platinum";
}

function Discover() {
  const { user, profile, refreshProfile } = useAuth();
  const { detect, detecting } = useGeolocation();
  const reactToProfile = useServerFn(createDiscoverReaction);
  const loadDiagnostics = useServerFn(getDiscoverDiagnostics);
  const loadLikeAllowance = useServerFn(getDiscoverLikeAllowance);
  const [acting, setActing] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [filters, setFilters] = useState<DiscoverFilters>(DEFAULT_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [mapView, setMapView] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiscoverDiagnostics | null>(null);
  const [likeAllowance, setLikeAllowance] = useState<DiscoverLikeAllowance | null>(null);
  const [match, setMatch] = useState<{
    matchId: string | null;
    photo: string | null;
    name: string;
  } | null>(null);
  const [breakdown, setBreakdown] = useState<CompatBreakdown | null>(null);

  const {
    deck,
    setDeck,
    current,
    previewDeck,
    loading,
    myPhoto,
    settings,
    effectiveFilters,
    refresh,
    advance,
  } = useDiscoverQueue({
    userId: user?.id,
    viewerCountry: profile?.location_country,
    filters,
  });

  const filterCount = activeFilterCount(filters);
  const needsLocation = !!profile && profile.latitude == null && !profile.location_access_suspended;
  const discoveryProfile = profile as DiscoveryProfile | null;
  const discoveryBlockedReason =
    discoveryProfile?.discovery_blocked_reason ??
    (!profile?.onboarding_complete ? "Complete onboarding before discovery." : null);

  const diagnosticFilters = useMemo(
    () => ({
      country: effectiveFilters.country ?? null,
      state: effectiveFilters.state ?? null,
      city: effectiveFilters.city ?? null,
    }),
    [effectiveFilters.city, effectiveFilters.country, effectiveFilters.state],
  );

  useEffect(() => {
    if (!current) {
      setBreakdown(null);
      return;
    }
    let active = true;
    setBreakdown(null);
    logInteraction("view", current.id, { source: "discover" });
    fetchOneCompatibility(current.id).then((res) => {
      if (active) setBreakdown(res?.breakdown ?? null);
    });
    return () => {
      active = false;
    };
  }, [current]);

  useEffect(() => {
    const paths = deck
      .slice(0, 5)
      .flatMap((person) => person.photos.map((photo) => photo.storage_path || photo.url))
      .filter((path): path is string => Boolean(path));
    if (paths.length) void getSignedUrls(paths);
  }, [deck]);

  const refreshDiagnostics = useCallback(async () => {
    if (!user) return;
    try {
      const result = await loadDiagnostics({
        data: { filters: diagnosticFilters, currentQueueIds: deck.map((person) => person.id) },
      });
      setDiagnostics(result);
    } catch {
      setDiagnostics(null);
    }
  }, [deck, diagnosticFilters, loadDiagnostics, user]);

  useEffect(() => {
    void refreshDiagnostics();
  }, [refreshDiagnostics]);

  const refreshLikeAllowance = useCallback(async () => {
    if (!user) return;
    try {
      setLikeAllowance(await loadLikeAllowance());
    } catch {
      setLikeAllowance(null);
    }
  }, [loadLikeAllowance, user]);

  useEffect(() => {
    void refreshLikeAllowance();
  }, [refreshLikeAllowance]);

  const refreshDeck = useCallback(async () => {
    await refreshProfile();
    await refresh();
    await refreshDiagnostics();
    await refreshLikeAllowance();
  }, [refresh, refreshDiagnostics, refreshLikeAllowance, refreshProfile]);

  const showUpgrade = useCallback((message = UPGRADE_COPY) => {
    toast.message(message);
    setUpgradeOpen(true);
  }, []);

  const runReaction = useCallback(
    async (reaction: "like" | "pass" | "superlike") => {
      if (!user || !current || acting) return;
      if (reaction === "superlike" && !isPaidRomanticTier(profile?.membership_tier)) {
        showUpgrade();
        return;
      }
      if (
        reaction === "like" &&
        !isPaidRomanticTier(profile?.membership_tier) &&
        likeAllowance &&
        !likeAllowance.unlimited &&
        (likeAllowance.remaining ?? 0) <= 0
      ) {
        showUpgrade("You've used your 10 free likes today. Upgrade to keep connecting.");
        return;
      }

      setActing(true);
      try {
        const result = await reactToProfile({
          data: { targetId: current.id, reaction },
        });
        if (result.gated) {
          if (result.likeAllowance) setLikeAllowance(result.likeAllowance);
          showUpgrade(result.error ?? UPGRADE_COPY);
          return;
        }
        if (!result.ok) {
          toast.error(result.error ?? "Could not save that action.");
          return;
        }
        logInteraction(reaction, current.id, {
          score: breakdown?.score ?? null,
          source: "discover",
        });
        if (reaction === "like" && result.matchId) {
          setMatch({
            matchId: result.matchId,
            photo: primaryPhotoPath(current),
            name: current.display_name ?? "your match",
          });
        }
        if (reaction === "superlike") toast.success("Super Like sent.");
        if (result.likeAllowance) setLikeAllowance(result.likeAllowance);
        advance();
        await refreshDiagnostics();
      } catch {
        toast.error("Something went wrong.");
      } finally {
        setActing(false);
      }
    },
    [
      acting,
      advance,
      breakdown?.score,
      current,
      likeAllowance,
      profile?.membership_tier,
      reactToProfile,
      refreshDiagnostics,
      showUpgrade,
      user,
    ],
  );

  const handleMessage = () => {
    if (!current) return;
    if (!isPaidRomanticTier(profile?.membership_tier) && !settings.free_users_can_message) {
      showUpgrade();
      return;
    }
    toast.message("Like this profile first. Messaging opens after you match.");
  };

  const handleBlock = async () => {
    if (!user || !current) return;
    try {
      await blockUser(user.id, current.id);
      toast.success(`${current.display_name} has been blocked.`);
      advance();
      await refreshDiagnostics();
    } catch {
      toast.error("Could not block user.");
    }
  };

  const shuffleCurrentDeck = () => {
    setDeck((currentDeck) => [...currentDeck].sort(() => Math.random() - 0.5));
    toast.success("Deck shuffled");
  };

  return (
    <div className="mx-auto max-w-md pb-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-semibold">Discover</h1>
        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="outline"
            size="icon"
            className="rounded-full"
            aria-label="Explore"
          >
            <Link to="/explore">
              <Compass className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="icon"
            className="rounded-full"
            aria-label="Advanced search"
          >
            <Link to="/search">
              <Search className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            variant={mapView ? "hero" : "outline"}
            size="icon"
            className="rounded-full"
            onClick={() => setMapView((v) => !v)}
            aria-label={mapView ? "Show swipe deck" : "Show map"}
            aria-pressed={mapView}
          >
            {mapView ? <Layers className="h-4 w-4" /> : <Radar className="h-4 w-4" />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="relative rounded-full"
            onClick={() => setFilterOpen(true)}
          >
            <SlidersHorizontal className="h-4 w-4" /> Filters
            {filterCount > 0 && (
              <span className="ml-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-xs font-semibold text-primary-foreground">
                {filterCount}
              </span>
            )}
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="rounded-full"
            onClick={refreshDeck}
            aria-label="Refresh deck"
            disabled={loading}
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      <FilterPresetsBar current={filters} onApply={setFilters} />

      {needsLocation && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-primary/30 bg-accent/60 p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-primary text-primary-foreground">
            <MapPin className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Turn on location</p>
            <p className="text-xs text-muted-foreground">
              See how far away people are when you use distance filters.
            </p>
          </div>
          <Button size="sm" className="rounded-full" onClick={() => detect()} disabled={detecting}>
            {detecting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enable"}
          </Button>
        </div>
      )}

      {diagnostics && <DiscoverDiagnosticsPanel diagnostics={diagnostics} />}

      {!isPaidRomanticTier(profile?.membership_tier) &&
        likeAllowance &&
        !likeAllowance.unlimited && (
          <p className="mb-3 rounded-2xl border border-primary/15 bg-primary/5 px-3 py-2 text-center text-sm font-medium text-primary">
            {likeAllowance.remaining ?? 0} free like{likeAllowance.remaining === 1 ? "" : "s"} left
            today
          </p>
        )}

      {discoveryBlockedReason && <ProfileCompletionPrompt reason={discoveryBlockedReason} />}

      {loading ? (
        <div className="grid h-[60vh] place-items-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : mapView ? (
        <NearbyMap
          members={deck}
          viewerCountry={profile?.location_country}
          viewerPhotoPath={myPhoto}
          viewerName={profile?.display_name}
          viewerLat={profile?.latitude}
          viewerLng={profile?.longitude}
          radiusKm={effectiveFilters.maxDistanceKm}
        />
      ) : !current ? (
        <EmptyDeck onRefresh={refreshDeck} />
      ) : (
        <div className="relative">
          <div className="absolute right-3 top-3 z-30">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="rounded-full bg-black/30 p-2 text-white backdrop-blur hover:bg-black/50"
                  aria-label="More options"
                >
                  <MoreVertical className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setReportOpen(true)}>
                  <Flag className="h-4 w-4" /> Report
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleBlock}
                  className="text-destructive focus:text-destructive"
                >
                  <Ban className="h-4 w-4" /> Block
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <SwipeDeck
            profiles={previewDeck}
            viewerCountry={profile?.location_country}
            breakdown={breakdown}
            disabled={acting}
            onLike={() => void runReaction("like")}
            onPass={() => void runReaction("pass")}
            onOpenProfile={() => setDetailOpen(true)}
          />

          <DiscoverActions
            disabled={acting}
            onPass={() => void runReaction("pass")}
            onSuperLike={() => void runReaction("superlike")}
            onMessage={handleMessage}
            onLike={() => void runReaction("like")}
          />

          <ComfortControls
            personName={current.display_name}
            context="discover"
            onReport={() => setReportOpen(true)}
            onBlock={handleBlock}
            onHide={() => void runReaction("pass")}
            className="mt-6"
          />
        </div>
      )}

      {current && (
        <>
          <ReportDialog
            open={reportOpen}
            onOpenChange={setReportOpen}
            reportedId={current.id}
            reportedName={current.display_name ?? "this user"}
          />
          <ProfileDetailSheet
            open={detailOpen}
            onOpenChange={setDetailOpen}
            profile={current}
            viewerCountry={profile?.location_country}
            breakdown={breakdown}
          />
        </>
      )}

      <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} />

      <MatchModal
        open={!!match}
        onClose={() => setMatch(null)}
        myPhoto={myPhoto}
        theirPhoto={match?.photo ?? null}
        theirName={match?.name ?? ""}
        matchId={match?.matchId ?? null}
      />

      <DiscoverFiltersSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        value={filters}
        onApply={setFilters}
      />
    </div>
  );
}

function DiscoverDiagnosticsPanel({ diagnostics }: { diagnostics: DiscoverDiagnostics }) {
  if (!import.meta.env.DEV) return null;
  const rows = [
    ["Real users", diagnostics.total_real_users],
    ["Active users", diagnostics.total_active_users],
    ["Discoverable users", diagnostics.total_discoverable_users],
    ["Eligible for you", diagnostics.eligible_for_current_viewer],
    ["Current user", diagnostics.excluded_by_current_user],
    ["Location filter", diagnostics.excluded_by_location_filter],
    ["Blocks/reports", diagnostics.excluded_by_blocks_reports],
    ["Incomplete profile", diagnostics.excluded_by_incomplete_profile],
    ["Gender/preference", diagnostics.excluded_by_gender_preference_filter],
    ["Queue returned", diagnostics.profiles_returned_current_queue],
    ["With photos", diagnostics.profiles_with_photos],
    ["Safe avatar", diagnostics.profiles_using_safe_avatar_fallback],
  ];
  return (
    <div className="mb-4 rounded-2xl border border-dashed border-border bg-muted/40 p-3">
      <p className="text-xs font-semibold uppercase text-muted-foreground">Discover diagnostics</p>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex items-center justify-between rounded-xl bg-background px-2 py-1"
          >
            <span className="truncate text-muted-foreground">{label}</span>
            <span className="font-semibold tabular-nums">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProfileCompletionPrompt({ reason }: { reason: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold">Complete your profile to appear in Discover</p>
        <p className="truncate text-xs text-muted-foreground">{reason}</p>
      </div>
      <Button asChild variant="outline" size="sm" className="shrink-0 rounded-full">
        <Link to="/onboarding">Finish</Link>
      </Button>
    </div>
  );
}

function DiscoveryBlocked({ reason }: { reason: string }) {
  return (
    <div className="grid min-h-[52vh] place-items-center rounded-[20px] border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-rose-50 p-6 text-center shadow-card dark:to-rose-950/25">
      <div className="max-w-sm">
        <div className="relative mx-auto grid h-28 w-28 place-items-center rounded-[20px] border border-border bg-background/90 shadow-soft">
          <ShieldCheck className="h-8 w-8" />
          <span className="absolute mt-16 grid h-9 w-9 place-items-center rounded-full bg-gradient-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </span>
        </div>
        <h2 className="mt-4 font-display text-xl font-semibold">Finish your profile first</h2>
        <p className="mx-auto mt-2 text-sm leading-6 text-muted-foreground">{reason}</p>
        <Button asChild variant="hero" className="mt-6 min-h-12 rounded-2xl">
          <Link to="/onboarding">
            Continue onboarding <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function EmptyDeck({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="overflow-hidden rounded-[20px] border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-amber-100/80 p-6 text-center shadow-card dark:to-amber-950/25">
      <div className="mx-auto flex max-w-xs justify-center -space-x-8 py-3">
        {[
          ["A", "from-rose-400 to-pink-600", "-rotate-6"],
          ["M", "from-amber-300 to-orange-500", "rotate-3"],
          ["S", "from-violet-400 to-fuchsia-600", "rotate-6"],
        ].map(([initial, gradient, rotate], index) => (
          <div
            key={initial}
            className={cn(
              "relative h-28 w-20 overflow-hidden rounded-3xl border-4 border-background bg-gradient-to-br shadow-soft",
              gradient,
              rotate,
              index === 1 && "z-10 scale-110",
            )}
          >
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-left text-white">
              <p className="text-sm font-bold">{initial}, 29</p>
              <p className="text-[10px] text-white/80">No eligible profile</p>
            </div>
          </div>
        ))}
      </div>
      <span className="mx-auto mt-2 grid h-14 w-14 place-items-center rounded-full bg-background text-primary shadow-soft">
        <Sparkles className="h-7 w-7" />
      </span>
      <h2 className="mt-4 font-display text-2xl font-semibold">No eligible profiles right now</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        Refresh the deck or remove manual filters to check every active discoverable member.
      </p>
      <div className="mt-6 flex justify-center">
        <Button variant="outline" className="min-h-12 rounded-2xl" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>
    </div>
  );
}
