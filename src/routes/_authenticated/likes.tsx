import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Eye, Heart, Loader2, Lock, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/AppShell";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import { ProfileView } from "@/components/ProfileView";
import { MatchModal } from "@/components/MatchModal";
import { TierBadge, VerifiedBadge } from "@/components/TierBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ageFromBirthDate } from "@/contexts/AuthContext";
import { capabilities } from "@/lib/membership";
import {
  fetchProfilesWithPhotos,
  primaryPhotoFromRows,
  primaryPhotoPath,
  type ProfileWithPhotos,
} from "@/lib/profiles";

export const Route = createFileRoute("/_authenticated/likes")({
  head: () => ({ meta: [{ title: "Likes — HeartConnect" }] }),
  component: () => (
    <AppShell>
      <Likes />
    </AppShell>
  ),
});

function Likes() {
  const { user, profile } = useAuth();
  const caps = profile ? capabilities(profile.membership_tier) : capabilities("free");
  const [people, setPeople] = useState<ProfileWithPhotos[]>([]);
  const [loading, setLoading] = useState(true);
  const [myPhoto, setMyPhoto] = useState<string | null>(null);
  const [selected, setSelected] = useState<ProfileWithPhotos | null>(null);
  const [acting, setActing] = useState(false);
  const [match, setMatch] = useState<{
    matchId: string | null;
    photo: string | null;
    name: string;
  } | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: incoming }, { data: outgoing }, myPhotos] = await Promise.all([
      supabase.from("likes").select("liker_id").eq("liked_id", user.id).eq("is_like", true),
      supabase.from("likes").select("liked_id").eq("liker_id", user.id),
      supabase
        .from("profile_photos")
        .select("url, storage_path, is_primary")
        .eq("user_id", user.id)
        .order("is_primary", { ascending: false })
        .order("position", { ascending: true }),
    ]);
    const responded = new Set((outgoing ?? []).map((l) => l.liked_id));
    const ids = [...new Set((incoming ?? []).map((l) => l.liker_id))].filter(
      (id) => !responded.has(id),
    );
    setPeople(await fetchProfilesWithPhotos(ids));
    setMyPhoto(primaryPhotoFromRows(myPhotos.data));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const respond = async (target: ProfileWithPhotos, like: boolean) => {
    if (!user || acting) return;
    setActing(true);
    try {
      await supabase
        .from("likes")
        .insert({ liker_id: user.id, liked_id: target.id, is_like: like });
      if (like) {
        const u1 = user.id < target.id ? user.id : target.id;
        const u2 = user.id < target.id ? target.id : user.id;
        const { data: m } = await supabase
          .from("matches")
          .select("id")
          .eq("user1_id", u1)
          .eq("user2_id", u2)
          .maybeSingle();
        setMatch({
          matchId: m?.id ?? null,
          photo: primaryPhotoPath(target),
          name: target.display_name ?? "your match",
        });
      } else {
        toast("Passed");
      }
      setSelected(null);
      setPeople((p) => p.filter((x) => x.id !== target.id));
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 font-display text-2xl font-semibold">Likes you</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        People who liked your profile. Like back to match.
      </p>

      {loading ? (
        <div className="grid h-[50vh] place-items-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !caps.seeWhoLikedYou ? (
        <LockedLikes count={people.length} />
      ) : people.length === 0 ? (
        <div className="grid h-[40vh] place-items-center rounded-3xl border border-dashed border-border bg-card/50 text-center">
          <div>
            <Heart className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 font-medium">No likes yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Keep your profile fresh to attract more attention.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {people.map((p) => {
            const age = ageFromBirthDate(p.birth_date);
            return (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                className="group relative aspect-[3/4] overflow-hidden rounded-3xl text-left shadow-soft transition-shadow hover:shadow-card"
              >
                <ProfilePhoto
                  path={primaryPhotoPath(p)}
                  alt={p.display_name ?? "Profile"}
                  rounded="rounded-3xl"
                  className="transition-transform group-hover:scale-105"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 text-white">
                  <div className="flex items-center gap-1">
                    <span className="font-semibold">
                      {p.display_name}
                      {age != null ? `, ${age}` : ""}
                    </span>
                    {p.is_verified && <VerifiedBadge className="h-4 w-4 text-white" />}
                  </div>
                  <TierBadge tier={p.membership_tier} className="mt-1" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-md overflow-hidden rounded-3xl p-0">
          {selected && (
            <div>
              <ProfileView profile={selected} />
              <div className="flex items-center justify-center gap-6 p-5 pt-0">
                <Button
                  variant="outline"
                  size="icon-lg"
                  className="border-2"
                  onClick={() => respond(selected, false)}
                  disabled={acting}
                  aria-label="Pass"
                >
                  <X className="h-6 w-6" />
                </Button>
                <Button
                  variant="hero"
                  size="icon-lg"
                  onClick={() => respond(selected, true)}
                  disabled={acting}
                  aria-label="Like back"
                >
                  <Heart className="h-6 w-6" fill="currentColor" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <MatchModal
        open={!!match}
        onClose={() => setMatch(null)}
        myPhoto={myPhoto}
        theirPhoto={match?.photo ?? null}
        theirName={match?.name ?? ""}
        matchId={match?.matchId ?? null}
      />
    </div>
  );
}

function LockedLikes({ count }: { count: number }) {
  return (
    <div className="relative overflow-hidden rounded-[20px] border border-amber-300/50 bg-gradient-to-br from-amber-50 via-card to-rose-50 p-6 text-center shadow-card dark:from-amber-950/35 dark:to-rose-950/30 sm:p-8">
      <div className="relative mx-auto flex max-w-xs justify-center -space-x-5 py-2">
        {[0, 1, 2].map((item) => (
          <span
            key={item}
            className="grid h-24 w-20 place-items-center rounded-[18px] border-4 border-background bg-gradient-to-br from-rose-400 to-amber-300 shadow-soft"
          >
            {item === 1 ? (
              <Lock className="h-8 w-8 text-white" />
            ) : (
              <Heart className="h-7 w-7 text-white" fill="currentColor" />
            )}
          </span>
        ))}
      </div>
      <span className="relative mx-auto mt-3 inline-flex items-center gap-2 rounded-full bg-background/90 px-3 py-1 text-xs font-bold text-foreground shadow-sm">
        <Eye className="h-3.5 w-3.5 text-primary" />
        Gold unlock
      </span>
      <h2 className="relative mt-4 font-display text-2xl font-semibold">
        {count > 0
          ? `${count} ${count === 1 ? "person likes" : "people like"} you!`
          : "See who likes you"}
      </h2>
      <p className="relative mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
        Upgrade to Gold to reveal admirers, like back faster, and turn warm interest into real
        matches.
      </p>
      <Button
        asChild
        variant="gold"
        size="lg"
        className="relative mt-6 min-h-12 w-full rounded-2xl sm:w-auto"
      >
        <Link to="/premium" search={{ plan: "gold", period: "month" }}>
          Unlock Likes <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
      <p className="relative mt-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        See who is already interested.
      </p>
    </div>
  );
}
