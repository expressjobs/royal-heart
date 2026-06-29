import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const BUCKET = "site-media";
const SIGN_EXPIRY = 60 * 60;

export interface PublicPostSummary {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  publishedAt: string | null;
  coverUrl: string | null;
}

export interface PublicPost extends PublicPostSummary {
  body: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
}

function publicClient() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  return createClient<Database>(process.env.SUPABASE_URL!, key!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

async function signCover(
  supabase: ReturnType<typeof publicClient>,
  path: string | null,
): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGN_EXPIRY);
  return data?.signedUrl ?? null;
}

/** Public: list published blog posts, newest first. */
export const listPublishedPosts = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicPostSummary[]> => {
    try {
      const supabase = publicClient();
      const { data } = await supabase
        .from("blog_posts")
        .select("id, title, slug, excerpt, published_at, cover_path")
        .eq("status", "published")
        .order("published_at", { ascending: false });
      const rows = data ?? [];

      const paths = rows.map((r) => r.cover_path).filter(Boolean) as string[];
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
        slug: r.slug,
        excerpt: r.excerpt,
        publishedAt: r.published_at,
        coverUrl: r.cover_path ? (urls[r.cover_path] ?? null) : null,
      }));
    } catch {
      return [];
    }
  },
);

/** Public: fetch a single published post by slug. */
export const getPublishedPost = createServerFn({ method: "GET" })
  .inputValidator((data: { slug: string }) => {
    if (!data || typeof data.slug !== "string" || !data.slug) throw new Error("Slug required");
    return { slug: data.slug.slice(0, 80) };
  })
  .handler(async ({ data }): Promise<PublicPost | null> => {
    try {
      const supabase = publicClient();
      const { data: row } = await supabase
        .from("blog_posts")
        .select(
          "id, title, slug, excerpt, body, published_at, cover_path, seo_title, seo_description",
        )
        .eq("status", "published")
        .eq("slug", data.slug)
        .maybeSingle();
      if (!row) return null;

      return {
        id: row.id,
        title: row.title,
        slug: row.slug,
        excerpt: row.excerpt,
        body: row.body,
        publishedAt: row.published_at,
        coverUrl: await signCover(supabase, row.cover_path),
        seoTitle: row.seo_title,
        seoDescription: row.seo_description,
      };
    } catch {
      return null;
    }
  });
