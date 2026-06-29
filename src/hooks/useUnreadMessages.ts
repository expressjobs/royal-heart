import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Tracks the number of unread messages addressed to the current user across
 * all of their conversations. Updates live via realtime so the navigation
 * badge stays in sync without a refresh.
 */
export function useUnreadMessages(): number {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) {
      setCount(0);
      return;
    }
    // Matches the current user belongs to.
    const { data: matches } = await supabase
      .from("matches")
      .select("id")
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

    const matchIds = (matches ?? []).map((m) => m.id);
    if (matchIds.length === 0) {
      setCount(0);
      return;
    }

    const { count: unread } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .in("match_id", matchIds)
      .neq("sender_id", user.id)
      .is("read_at", null);

    setCount(unread ?? 0);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("unread-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          if ((payload.new as { sender_id: string }).sender_id !== user.id) refresh();
        },
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, () =>
        refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refresh]);

  return count;
}
