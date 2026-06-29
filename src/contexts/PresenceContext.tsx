import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface PresenceContextValue {
  /** Set of user ids currently online (have an active session somewhere). */
  onlineIds: Set<string>;
  isOnline: (id: string | null | undefined) => boolean;
}

const PresenceContext = createContext<PresenceContextValue | undefined>(undefined);

const HEARTBEAT_MS = 60_000;

export function PresenceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const lastBeat = useRef(0);

  useEffect(() => {
    if (!user) {
      setOnlineIds(new Set());
      return;
    }

    const channel = supabase.channel("presence:online", {
      config: { presence: { key: user.id } },
    });

    const sync = () => {
      const state = channel.presenceState();
      setOnlineIds(new Set(Object.keys(state)));
    };

    channel
      .on("presence", { event: "sync" }, sync)
      .on("presence", { event: "join" }, sync)
      .on("presence", { event: "leave" }, sync)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Keep last_active fresh while the user is active (for "last seen" of others).
  useEffect(() => {
    if (!user) return;
    const beat = () => {
      const now = Date.now();
      if (now - lastBeat.current < HEARTBEAT_MS) return;
      lastBeat.current = now;
      supabase.from("profiles").update({ last_active: new Date().toISOString() }).eq("id", user.id);
    };
    beat();
    const onVisible = () => {
      if (document.visibilityState === "visible") beat();
    };
    const id = window.setInterval(beat, HEARTBEAT_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user]);

  const value = useMemo<PresenceContextValue>(
    () => ({
      onlineIds,
      isOnline: (id) => (id ? onlineIds.has(id) : false),
    }),
    [onlineIds],
  );

  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
}

export function usePresence(): PresenceContextValue {
  const ctx = useContext(PresenceContext);
  // Safe fallback when used outside the provider (e.g. public pages).
  if (!ctx) return { onlineIds: new Set(), isOnline: () => false };
  return ctx;
}

/** Human-friendly presence label: "Online", "Active 5m ago", "Active yesterday", etc. */
export function presenceLabel(online: boolean, lastActive: string | null): string {
  if (online) return "Online";
  if (!lastActive) return "Offline";
  const diff = Date.now() - new Date(lastActive).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Active just now";
  if (mins < 60) return `Active ${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Active ${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Active yesterday";
  if (days < 7) return `Active ${days}d ago`;
  return "Offline";
}

/** Whether a user counts as "away" — online session but idle for a while. */
export function isAway(online: boolean, lastActive: string | null): boolean {
  if (!online || !lastActive) return false;
  return Date.now() - new Date(lastActive).getTime() > 5 * 60 * 1000;
}
