import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const BUCKET = "site-media";
const SIGN_EXPIRY = 60 * 60;

export interface PublicBanner {
  id: string;
  title: string;
  linkUrl: string | null;
  placement: string;
  imageUrl: string | null;
}

function publicClient() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  return createClient<Database>(process.env.SUPABASE_URL!, key!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

/** Public: active, in-schedule banners with signed image URLs. SSR-safe. */
export const getActiveBanners = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicBanner[]> => {
    try {
      const supabase = publicClient();
      const { data } = await supabase
        .from("banners")
        .select("id, title, link_url, placement, image_path")
        .order("sort_order", { ascending: true });
      const rows = data ?? [];

      const paths = rows.map((r) => r.image_path).filter(Boolean) as string[];
      const urls: Record<string, string> = {};
      if (paths.length) {
        const { data: signed } = await supabase.storage
          .from(BUCKET)
          .createSignedUrls(paths, SIGN_EXPIRY);
        for (const item of signed ?? []) {
          if (item.path && item.signedUrl) urls[item.path] = item.signedUrl;
        }
      }

      return rows.map((r) => ({
        id: r.id,
        title: r.title,
        linkUrl: r.link_url,
        placement: r.placement,
        imageUrl: r.image_path ? (urls[r.image_path] ?? null) : null,
      }));
    } catch {
      return [];
    }
  },
);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Public: increment impression or click counters for a banner. */
export const trackBannerEvent = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; type: "impression" | "click" }) => {
    if (!data || !UUID_RE.test(data.id ?? "")) throw new Error("Invalid banner id");
    if (data.type !== "impression" && data.type !== "click") throw new Error("Invalid event type");
    return { id: data.id, type: data.type };
  })
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: row } = await supabaseAdmin
        .from("banners")
        .select("impressions, clicks")
        .eq("id", data.id)
        .maybeSingle();
      if (!row) return { ok: false };
      const patch =
        data.type === "click"
          ? { clicks: (row.clicks ?? 0) + 1 }
          : { impressions: (row.impressions ?? 0) + 1 };
      await supabaseAdmin.from("banners").update(patch).eq("id", data.id);
      return { ok: true };
    } catch {
      return { ok: false };
    }
  });
