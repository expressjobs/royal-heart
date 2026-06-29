import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, SlidersHorizontal, Search as SearchIcon, Compass } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/AppShell";
import { ProfileCard } from "@/components/ProfileCard";
import {
  DiscoverFiltersSheet,
  DEFAULT_FILTERS,
  activeFilterCount,
} from "@/components/DiscoverFilters";
import { Button } from "@/components/ui/button";
import { searchProfiles, type DiscoverFilters, type ProfileWithPhotos } from "@/lib/profiles";

export const Route = createFileRoute("/_authenticated/search")({
  head: () => ({ meta: [{ title: "Advanced Search — HeartConnect" }] }),
  component: () => (
    <AppShell>
      <AdvancedSearch />
    </AppShell>
  ),
});

const PAGE_SIZE = 24;

function AdvancedSearch() {
  const { profile } = useAuth();
  const [filters, setFilters] = useState<DiscoverFilters>(DEFAULT_FILTERS);
  const [results, setResults] = useState<ProfileWithPhotos[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const sentinel = useRef<HTMLDivElement | null>(null);

  const filterCount = activeFilterCount(filters);
  const hasMore = results.length < total;

  // Reset and load the first page whenever filters change.
  useEffect(() => {
    let active = true;
    setLoading(true);
    setPage(0);
    searchProfiles(filters, 0, PAGE_SIZE).then(({ results: r, total: t }) => {
      if (!active) return;
      setResults(r);
      setTotal(t);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [filters]);

  const loadMore = useCallback(async () => {
    if (loadingMore || loading) return;
    setLoadingMore(true);
    const next = page + 1;
    const { results: r } = await searchProfiles(filters, next, PAGE_SIZE);
    setResults((prev) => [...prev, ...r]);
    setPage(next);
    setLoadingMore(false);
  }, [filters, page, loading, loadingMore]);

  // Infinite scroll.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore || loading) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "400px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loading, loadMore]);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Advanced search</h1>
          <p className="text-sm text-muted-foreground">
            {loading ? "Searching…" : `${total} ${total === 1 ? "match" : "matches"}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link to="/explore">
              <Compass className="h-4 w-4" /> Explore
            </Link>
          </Button>
          <Button
            variant="hero"
            size="sm"
            className="relative rounded-full"
            onClick={() => setFilterOpen(true)}
          >
            <SlidersHorizontal className="h-4 w-4" /> Filters
            {filterCount > 0 && (
              <span className="ml-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary-foreground px-1 text-xs font-semibold text-primary">
                {filterCount}
              </span>
            )}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid h-[60vh] place-items-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : results.length === 0 ? (
        <div className="grid h-[55vh] place-items-center rounded-3xl border border-dashed border-border bg-card/50 p-8 text-center">
          <div>
            <SearchIcon className="mx-auto h-10 w-10 text-primary" />
            <h2 className="mt-4 font-display text-xl font-semibold">No matches found</h2>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground">
              Try widening your filters — distance, age range, or removing a few preferences.
            </p>
            <Button
              variant="outline"
              className="mt-5 rounded-full"
              onClick={() => setFilters(DEFAULT_FILTERS)}
            >
              Reset filters
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {results.map((p) => (
              <ProfileCard key={p.id} profile={p} viewerCountry={profile?.location_country} />
            ))}
          </div>
          <div ref={sentinel} className="h-10" />
          {loadingMore && (
            <div className="grid place-items-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
          {!hasMore && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              You've reached the end.
            </p>
          )}
        </>
      )}

      <DiscoverFiltersSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        value={filters}
        onApply={setFilters}
      />
    </div>
  );
}
