import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Counts incoming likes addressed to the current user that they have not yet
 * responded to (i.e. new admirers waiting in the Likes tab). Stays in sync via
 * realtime so the navigation badge updates without a refresh.
 */
export function useUnreadLikes(): number {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) {
      setCount(0);
      return;
    }
    const [{ data: incoming }, { data: outgoing }] = await Promise.all([
      supabase.from("likes").select("liker_id").eq("liked_id", user.id).eq("is_like", true),
      supabase.from("likes").select("liked_id").eq("liker_id", user.id),
    ]);
    const responded = new Set((outgoing ?? []).map((l) => l.liked_id));
    const pending = new Set(
      (incoming ?? []).map((l) => l.liker_id).filter((id) => !responded.has(id)),
    );
    setCount(pending.size);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("unread-likes")
      .on("postgres_changes", { event: "*", schema: "public", table: "likes" }, () => refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refresh]);

  return count;
}
