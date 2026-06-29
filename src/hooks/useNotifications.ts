import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";

export type AppNotification = Database["public"]["Tables"]["notifications"]["Row"];

const PAGE_SIZE = 50;

/** Returns true if the browser supports the Notification API. */
export function browserNotificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/** Fire a native browser notification if permission has been granted. */
function showBrowserNotification(n: AppNotification) {
  if (!browserNotificationsSupported() || Notification.permission !== "granted") return;
  try {
    const notification = new Notification(n.title, {
      body: n.body ?? undefined,
      icon: "/icon-192.png",
      badge: "/favicon-32.png",
      tag: n.id,
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch {
    /* some browsers throw outside a SW context; ignore gracefully */
  }
}

export interface UseNotificationsResult {
  notifications: AppNotification[];
  unread: number;
  loading: boolean;
  markAllRead: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useNotifications(): UseNotificationsResult {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const pushEnabled = useRef(false);

  const unread = notifications.filter((n) => !n.read_at).length;

  const refresh = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);
    setNotifications(data ?? []);
    setLoading(false);
  }, [user]);

  // Read the user's browser-push preference once so we know whether to surface
  // native notifications.
  useEffect(() => {
    if (!user) return;
    let active = true;
    supabase
      .from("notification_preferences")
      .select("browser_push")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (active) pushEnabled.current = data?.browser_push ?? false;
      });
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("notifications-feed")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const n = payload.new as AppNotification;
          setNotifications((prev) => (prev.some((x) => x.id === n.id) ? prev : [n, ...prev]));
          if (pushEnabled.current) showBrowserNotification(n);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const n = payload.new as AppNotification;
          setNotifications((prev) => prev.map((x) => (x.id === n.id ? n : x)));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const old = payload.old as { id: string };
          setNotifications((prev) => prev.filter((x) => x.id !== old.id));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
    );
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .is("read_at", null);
  }, []);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    await supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("user_id", user.id)
      .is("read_at", null);
  }, [user]);

  const remove = useCallback(async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await supabase.from("notifications").delete().eq("id", id);
  }, []);

  return { notifications, unread, loading, markAllRead, markRead, remove, refresh };
}

/**
 * Lightweight unread-notification counter for the nav bell badge. Avoids
 * fetching full notification rows on every page.
 */
export function useUnreadNotificationCount(): number {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) {
      setCount(0);
      return;
    }
    const { count: c } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null);
    setCount(c ?? 0);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("notifications-count")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refresh]);

  return count;
}
