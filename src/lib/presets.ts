import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { DiscoverFilters } from "@/lib/profiles";

export interface FilterPreset {
  id: string;
  name: string;
  filters: DiscoverFilters;
  is_quick: boolean;
  created_at: string;
}

function rowToPreset(row: {
  id: string;
  name: string;
  filters: Json;
  is_quick: boolean;
  created_at: string;
}): FilterPreset {
  return {
    id: row.id,
    name: row.name,
    filters: (row.filters ?? {}) as unknown as DiscoverFilters,
    is_quick: row.is_quick,
    created_at: row.created_at,
  };
}

export async function listPresets(userId: string): Promise<FilterPreset[]> {
  const { data } = await supabase
    .from("filter_presets")
    .select("id, name, filters, is_quick, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []).map(rowToPreset);
}

export async function savePreset(
  userId: string,
  name: string,
  filters: DiscoverFilters,
): Promise<FilterPreset | null> {
  const { data, error } = await supabase
    .from("filter_presets")
    .insert({
      user_id: userId,
      name: name.trim().slice(0, 60) || "My filter",
      filters: JSON.parse(JSON.stringify(filters)) as Json,
    })
    .select("id, name, filters, is_quick, created_at")
    .single();
  if (error || !data) return null;
  return rowToPreset(data);
}

export async function deletePreset(id: string): Promise<void> {
  await supabase.from("filter_presets").delete().eq("id", id);
}

export async function setPresetQuick(id: string, isQuick: boolean): Promise<void> {
  await supabase.from("filter_presets").update({ is_quick: isQuick }).eq("id", id);
}
