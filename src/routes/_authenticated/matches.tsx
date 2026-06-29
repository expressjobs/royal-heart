import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Heart, Loader2, MessageCircle, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, ageFromBirthDate } from "@/contexts/AuthContext";
import { usePresence } from "@/contexts/PresenceContext";
import { AppShell } from "@/components/AppShell";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import { PresenceDot } from "@/components/PresenceIndicator";
import { VerifiedBadge } from "@/components/TierBadge";
import { Button } from "@/components/ui/button";
import { fetchProfilesWithPhotos, primaryPhotoPath, type ProfileWithPhotos } from "@/lib/profiles";

export const Route = createFileRoute("/_authenticated/matches")({
  head: () => ({ meta: [{ title: "Matches — HeartConnect" }] }),
  component: () => (
    <AppShell>
      <Matches />
    </AppShell>
  ),
});

interface MatchEntry {
  matchId: string;
  other: ProfileWithPhotos;
  matchedAt: string;
}

function Matches() {
  const { user } = useAuth();
  const { isOnline } = usePresence();
  const [matches, setMatches] = useState<MatchEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: rows } = await supabase
      .from("matches")
      .select("id, user1_id, user2_id, created_at")
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    const list = rows ?? [];
    if (list.length === 0) {
      setMatches([]);
      setLoading(false);
      return;
    }

    const otherIds = list.map((m) => (m.user1_id === user.id ? m.user2_id : m.user1_id));
    const profiles = await fetchProfilesWithPhotos(otherIds);
    const byId = new Map(profiles.map((p) => [p.id, p]));

    const result = list
      .map((m): MatchEntry | null => {
        const otherId = m.user1_id === user.id ? m.user2_id : m.user1_id;
        const other = byId.get(otherId);
        return other ? { matchId: m.id, other, matchedAt: m.created_at } : null;
      })
      .filter((m): m is MatchEntry => m !== null);

    setMatches(result);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center gap-2">
        <Heart className="h-6 w-6 text-primary" />
        <h1 className="font-display text-2xl font-semibold">Your matches</h1>
      </div>

      {loading ? (
        <div className="grid h-[50vh] place-items-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : matches.length === 0 ? (
        <div className="overflow-hidden rounded-[20px] border border-primary/20 bg-gradient-to-br from-rose-50 via-card to-violet-50 p-6 text-center shadow-card dark:from-rose-950/30 dark:to-violet-950/25 sm:p-8">
          <div className="mx-auto grid max-w-sm grid-cols-3 gap-3">
            {["Like", "Match", "Chat"].map((label, index) => (
              <div
                key={label}
                className="rounded-[18px] border border-background/70 bg-background/85 p-3 shadow-soft"
              >
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-gradient-primary text-primary-foreground">
                  {index === 2 ? (
                    <MessageCircle className="h-5 w-5" />
                  ) : (
                    <Heart className="h-5 w-5" fill={index === 1 ? "currentColor" : "none"} />
                  )}
                </span>
                <p className="mt-2 text-xs font-bold text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
          <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-background/90 px-3 py-1 text-xs font-bold text-foreground shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Better visibility helps
          </p>
          <h2 className="mt-4 font-display text-2xl font-semibold">No matches yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Keep discovering compatible people, or upgrade to stand out and get more chances to
            connect.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild variant="hero" className="min-h-12 rounded-2xl">
              <Link to="/discover">
                Start discovering <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="gold" className="min-h-12 rounded-2xl">
              <Link to="/premium" search={{ plan: "gold", period: "month" }}>
                Boost Your Matches <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {matches.map(({ matchId, other }) => {
            const age = ageFromBirthDate(other.birth_date);
            const online = isOnline(other.id);
            return (
              <li
                key={matchId}
                className="group overflow-hidden rounded-3xl border border-border bg-card transition-shadow hover:shadow-romantic"
              >
                <Link
                  to="/profile/$id"
                  params={{ id: other.id }}
                  className="relative block aspect-[3/4] overflow-hidden"
                >
                  <ProfilePhoto
                    path={primaryPhotoPath(other)}
                    alt={other.display_name ?? "Match"}
                    rounded="rounded-none"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  {online && (
                    <span className="absolute left-3 top-3">
                      <PresenceDot online lastActive={other.last_active} className="h-3 w-3" />
                    </span>
                  )}
                </Link>
                <div className="p-3">
                  <div className="flex min-w-0 items-center gap-1">
                    <p className="truncate font-medium">
                      {other.display_name ?? "Member"}
                      {age != null && <span className="text-muted-foreground">, {age}</span>}
                    </p>
                    {other.is_verified && <VerifiedBadge />}
                  </div>
                  <Button asChild size="sm" variant="outline" className="mt-2 w-full rounded-full">
                    <Link to="/messages/$matchId" params={{ matchId }}>
                      <MessageCircle className="h-4 w-4" /> Message
                    </Link>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
