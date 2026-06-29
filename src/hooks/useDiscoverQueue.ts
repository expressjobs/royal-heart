import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchDiscoverDeck,
  invalidateDiscoverCache,
  primaryPhotoPath,
  primaryPhotoFromRows,
  type DiscoverFilters,
  type ProfileWithPhotos,
} from "@/lib/profiles";
import { getSignedUrls } from "@/lib/storage";
import {
  loadDiscoverAccessSettings,
  normalizeDiscoverAccessSettings,
  type DiscoverAccessSettings,
} from "@/lib/discover-settings";

const DISCOVER_BATCH_SIZE = 240;
const LOW_QUEUE_WATERMARK = 8;

export function useDiscoverQueue({
  userId,
  filters,
}: {
  userId: string | null | undefined;
  filters: DiscoverFilters;
}) {
  const [deck, setDeck] = useState<ProfileWithPhotos[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [myPhoto, setMyPhoto] = useState<string | null>(null);
  const [settings, setSettings] = useState<DiscoverAccessSettings>(
    normalizeDiscoverAccessSettings(null),
  );

  const effectiveFilters = filters;

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const [nextSettings, list, myPhotos] = await Promise.all([
      loadDiscoverAccessSettings(supabase),
      fetchDiscoverDeck(userId, null, effectiveFilters, DISCOVER_BATCH_SIZE),
      supabase
        .from("profile_photos")
        .select("url, storage_path, is_primary")
        .eq("user_id", userId)
        .order("is_primary", { ascending: false })
        .order("position", { ascending: true }),
    ]);
    const nearbyPhotoPaths = list
      .slice(0, 5)
      .map(primaryPhotoPath)
      .filter((path): path is string => Boolean(path));
    if (nearbyPhotoPaths.length) await getSignedUrls(nearbyPhotoPaths);
    setSettings(nextSettings);
    setDeck(list);
    setMyPhoto(primaryPhotoFromRows(myPhotos.data));
    setLoading(false);
  }, [effectiveFilters, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const advance = useCallback(() => {
    if (userId) invalidateDiscoverCache(userId);
    setDeck((current) => current.slice(1));
  }, [userId]);

  const topUp = useCallback(async () => {
    if (!userId || loading || loadingMore || deck.length > LOW_QUEUE_WATERMARK) return;
    setLoadingMore(true);
    try {
      const list = await fetchDiscoverDeck(userId, null, effectiveFilters, DISCOVER_BATCH_SIZE);
      setDeck((current) => {
        const existing = new Set(current.map((person) => person.id));
        const merged = [...current];
        for (const person of list) {
          if (!existing.has(person.id)) {
            merged.push(person);
            existing.add(person.id);
          }
        }
        return merged;
      });
    } finally {
      setLoadingMore(false);
    }
  }, [deck.length, effectiveFilters, loading, loadingMore, userId]);

  useEffect(() => {
    void topUp();
  }, [topUp]);

  return {
    deck,
    setDeck,
    current: deck[0] ?? null,
    next: deck[1] ?? null,
    previewDeck: deck.slice(0, 3),
    loading,
    loadingMore,
    myPhoto,
    settings,
    effectiveFilters,
    refresh: load,
    advance,
  };
}
