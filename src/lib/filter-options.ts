import { supabase } from "@/integrations/supabase/client";

export type FilterCategory =
  | "interest"
  | "language"
  | "religion"
  | "education"
  | "relationship_goal"
  | "profession";

export interface FilterOption {
  id: string;
  category: string;
  value: string;
  label: string;
  sort_order: number;
  is_active: boolean;
}

export type OptionItem = { value: string; label: string };

/** Reads the active options for a category (public-readable). */
export async function fetchOptions(category: FilterCategory): Promise<OptionItem[]> {
  const { data } = await supabase
    .from("filter_options")
    .select("value, label, sort_order")
    .eq("category", category)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  return (data ?? []).map((o) => ({ value: o.value, label: o.label }));
}

/** Reads every option (active + inactive) for admin management. */
export async function fetchAllOptions(category: FilterCategory): Promise<FilterOption[]> {
  const { data } = await supabase
    .from("filter_options")
    .select("id, category, value, label, sort_order, is_active")
    .eq("category", category)
    .order("sort_order", { ascending: true });
  return data ?? [];
}

export async function createOption(
  category: FilterCategory,
  value: string,
  label: string,
  sortOrder: number,
): Promise<FilterOption | null> {
  const { data, error } = await supabase
    .from("filter_options")
    .insert({ category, value: value.trim(), label: label.trim(), sort_order: sortOrder })
    .select("id, category, value, label, sort_order, is_active")
    .single();
  if (error || !data) return null;
  return data;
}

export async function updateOption(
  id: string,
  patch: Partial<Pick<FilterOption, "label" | "sort_order" | "is_active">>,
): Promise<void> {
  await supabase.from("filter_options").update(patch).eq("id", id);
}

export async function deleteOption(id: string): Promise<void> {
  await supabase.from("filter_options").delete().eq("id", id);
}
