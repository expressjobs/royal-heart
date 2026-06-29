import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Banner = Database["public"]["Tables"]["banners"]["Row"];
export type BannerInsert = Database["public"]["Tables"]["banners"]["Insert"];
export type BannerUpdate = Database["public"]["Tables"]["banners"]["Update"];

export const BANNER_PLACEMENTS = [
  { value: "home_top", label: "Homepage — top" },
  { value: "home_mid", label: "Homepage — middle" },
  { value: "discover", label: "Discover page" },
  { value: "sidebar", label: "Sidebar" },
] as const;

/** Admin: list every banner (active or not) ordered for management. */
export async function listAllBanners(): Promise<Banner[]> {
  const { data, error } = await supabase
    .from("banners")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createBanner(input: BannerInsert): Promise<Banner> {
  const { data, error } = await supabase.from("banners").insert(input).select("*").single();
  if (error) throw error;
  return data;
}

export async function updateBanner(id: string, patch: BannerUpdate): Promise<void> {
  const { error } = await supabase.from("banners").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteBanner(id: string): Promise<void> {
  const { error } = await supabase.from("banners").delete().eq("id", id);
  if (error) throw error;
}

export function bannerCtr(b: Pick<Banner, "impressions" | "clicks">): string {
  if (!b.impressions) return "0%";
  return `${((b.clicks / b.impressions) * 100).toFixed(1)}%`;
}
