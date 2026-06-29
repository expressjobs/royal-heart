import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Heart, Loader2, Sparkles } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePresence } from "@/contexts/PresenceContext";
import { AppShell } from "@/components/AppShell";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import { PresenceDot } from "@/components/PresenceIndicator";
import { VerifiedBadge } from "@/components/TierBadge";
import { Button } from "@/components/ui/button";
import { fetchProfilesWithPhotos, primaryPhotoPath, type ProfileWithPhotos } from "@/lib/profiles";

export const Route = createFileRoute("/_authenticated/messages/")({
  head: () => ({ meta: [{ title: "Messages — HeartConnect" }] }),
  component: () => (
    <AppShell>
      <MessagesList />
    </AppShell>
  ),
});

interface Conversation {
  matchId: string;
  other: ProfileWithPhotos;
  lastMessage: string | null;
  lastAt: string | null;
  unread: number;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "";

  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function MessagesList() {
  const { user } = useAuth();
  const { isOnline } = usePresence();

  const [convos, setConvos] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setConvos([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data: matches, error: matchesError } = await supabase
      .from("matches")
      .select("id, user1_id, user2_id, created_at")
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (matchesError) {
      console.error("Failed to load matches:", matchesError);
      setConvos([]);
      setLoading(false);
      return;
    }

    const list = matches ?? [];

    if (list.length === 0) {
      setConvos([]);
      setLoading(false);
      return;
    }

    const otherIds = list.map((match) =>
      match.user1_id === user.id ? match.user2_id : match.user1_id,
    );

    const matchIds = list.map((match) => match.id);

    const [profiles, messagesResult] = await Promise.all([
      fetchProfilesWithPhotos(otherIds),
      supabase
        .from("messages")
        .select("match_id, sender_id, content, read_at, created_at")
        .in("match_id", matchIds)
        .order("created_at", { ascending: false }),
    ]);

    if (messagesResult.error) {
      console.error("Failed to load messages:", messagesResult.error);
    }

    const messages = messagesResult.data ?? [];
    const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

    const lastByMatch = new Map<string, { content: string; at: string }>();
    const unreadByMatch = new Map<string, number>();

    for (const message of messages) {
      if (!lastByMatch.has(message.match_id)) {
        lastByMatch.set(message.match_id, {
          content: message.content,
          at: message.created_at,
        });
      }

      if (message.sender_id !== user.id && !message.read_at) {
        unreadByMatch.set(message.match_id, (unreadByMatch.get(message.match_id) ?? 0) + 1);
      }
    }

    const result: Conversation[] = list
      .map((match): Conversation | null => {
        const otherId = match.user1_id === user.id ? match.user2_id : match.user1_id;

        const other = profileById.get(otherId);
        const last = lastByMatch.get(match.id);

        if (!other) return null;

        return {
          matchId: match.id,
          other,
          lastMessage: last?.content ?? null,
          lastAt: last?.at ?? match.created_at,
          unread: unreadByMatch.get(match.id) ?? 0,
        };
      })
      .filter((conversation): conversation is Conversation => conversation !== null)
      .sort((a, b) => new Date(b.lastAt ?? 0).getTime() - new Date(a.lastAt ?? 0).getTime());

    setConvos(result);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`messages-list-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        () => {
          load();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches",
        },
        () => {
          load();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, load]);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 font-display text-2xl font-semibold">Messages</h1>

      {loading ? (
        <div className="grid h-[50vh] place-items-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : convos.length === 0 ? (
        <div className="overflow-hidden rounded-[20px] border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-amber-100/70 p-6 text-center shadow-card dark:to-amber-950/25 sm:p-8">
          <div className="mx-auto max-w-xs rounded-[20px] border border-border bg-background/90 p-4 text-left shadow-soft">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-gradient-primary text-primary-foreground">
                <Heart className="h-5 w-5" fill="currentColor" />
              </span>

              <div className="min-w-0 flex-1">
                <div className="h-3 w-28 rounded-full bg-muted" />
                <div className="mt-2 h-2 w-36 rounded-full bg-muted/70" />
              </div>
            </div>

            <div className="mt-4 ml-10 rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
              Your first conversation will appear here.
            </div>
          </div>

          <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-background/90 px-3 py-1 text-xs font-bold text-foreground shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Match first, then message
          </p>

          <h2 className="mt-4 font-display text-2xl font-semibold">No conversations yet</h2>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Start discovering people you like. Gold unlocks unlimited messaging after you match.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild variant="hero" className="min-h-12 rounded-2xl">
              <Link to="/discover">
                Start discovering <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>

            <Button asChild variant="gold" className="min-h-12 rounded-2xl">
              <Link to="/premium" search={{ plan: "gold", period: "month" }}>
                Get Gold <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-card">
          {convos.map((conversation) => (
            <li key={conversation.matchId}>
              <Link
                to="/messages/$matchId"
                params={{ matchId: conversation.matchId }}
                className="flex items-center gap-3 p-4 transition-colors hover:bg-muted/60"
              >
                <div className="relative h-14 w-14 shrink-0">
                  <div className="h-14 w-14 overflow-hidden rounded-full">
                    <ProfilePhoto
                      path={primaryPhotoPath(conversation.other)}
                      alt={conversation.other.display_name ?? ""}
                      rounded="rounded-full"
                    />
                  </div>

                  <PresenceDot
                    online={isOnline(conversation.other.id)}
                    lastActive={conversation.other.last_active}
                    className="absolute bottom-0.5 right-0.5 h-3.5 w-3.5"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="truncate font-semibold">
                      {conversation.other.display_name}
                    </span>

                    {conversation.other.is_verified && (
                      <VerifiedBadge className="h-4 w-4 shrink-0" />
                    )}

                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {timeAgo(conversation.lastAt)}
                    </span>
                  </div>

                  <p
                    className={`truncate text-sm ${
                      conversation.unread ? "font-medium text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {conversation.lastMessage ?? "Say hello 👋"}
                  </p>
                </div>

                {conversation.unread > 0 && (
                  <span className="grid h-6 min-w-6 shrink-0 place-items-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                    {conversation.unread}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
