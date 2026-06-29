import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { requireServerAdmin } from "@/lib/server-auth";
import { getImageInfo } from "./image-validation";
import {
  DEFAULT_ABOUT,
  DEFAULT_HERO,
  DEFAULT_STATS,
  DEFAULT_STORIES,
  DEFAULT_TESTIMONIALS,
} from "./cms-defaults";
import type {
  AboutContent,
  HeroContent,
  HeroSlide,
  HomepageContent,
  StatsContent,
  SuccessStory,
  Testimonial,
} from "./cms-types";

const BUCKET = "site-media";
const SIGN_EXPIRY = 60 * 60; // 1h (regenerated each request)
const ACCEPTED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
const EXT_BY_FORMAT: Record<string, string> = { jpeg: "jpg", png: "png", webp: "webp" };

function publicClient() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  return createClient<Database>(process.env.SUPABASE_URL!, key!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Public homepage content. Reads admin-managed overrides from the database and
 * falls back to production-safe code defaults for any section that is empty.
 * Safe for SSR / prerender — uses the publishable (anon) client only.
 */
export const getHomepageContent = createServerFn({ method: "GET" }).handler(
  async (): Promise<HomepageContent> => {
    try {
      return await loadHomepageContent();
    } catch {
      // Never blank the homepage on a backend hiccup — fall back to defaults.
      return {
        hero: DEFAULT_HERO,
        slides: [],
        stats: DEFAULT_STATS,
        about: DEFAULT_ABOUT,
        testimonials: DEFAULT_TESTIMONIALS,
        stories: DEFAULT_STORIES,
        media: {},
      };
    }
  },
);

async function loadHomepageContent(): Promise<HomepageContent> {
  const supabase = publicClient();

  const [contentRes, slidesRes, testimonialsRes, storiesRes] = await Promise.all([
    supabase.from("app_settings").select("key, value"),
    supabase
      .from("hero_slides")
      .select("id, image_path, headline, subheadline, cta_label, cta_href")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("testimonials")
      .select("id, name, country, quote, rating, photo_path")
      .eq("is_published", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("success_stories")
      .select("id, title, couple_names, body, image_path")
      .eq("is_published", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  const sections = new Map<string, Record<string, unknown>>();
  for (const row of (contentRes.data ?? []) as unknown as Array<{
    key: string;
    value: Record<string, unknown> | null;
  }>) {
    sections.set(row.key, row.value ?? {});
  }

  const hero: HeroContent = { ...DEFAULT_HERO, ...(sections.get("hero") ?? {}) };
  const statsStored = sections.get("stats") as StatsContent | undefined;
  const stats: StatsContent =
    statsStored?.items && statsStored.items.length > 0 ? statsStored : DEFAULT_STATS;
  const slides: HeroSlide[] = (slidesRes.data ?? []).map((s) => ({
    id: s.id,
    imagePath: s.image_path,
    headline: s.headline,
    subheadline: s.subheadline,
    ctaLabel: s.cta_label,
    ctaHref: s.cta_href,
  }));

  const about: AboutContent = { ...DEFAULT_ABOUT, ...(sections.get("about") ?? {}) };

  const dbTestimonials: Testimonial[] = (testimonialsRes.data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    country: t.country,
    quote: t.quote,
    rating: t.rating,
    photoPath: t.photo_path,
  }));
  const testimonials = dbTestimonials.length > 0 ? dbTestimonials : DEFAULT_TESTIMONIALS;

  const dbStories: SuccessStory[] = (storiesRes.data ?? []).map((s) => ({
    id: s.id,
    title: s.title,
    coupleNames: s.couple_names,
    body: s.body,
    imagePath: s.image_path,
  }));
  const stories = dbStories.length > 0 ? dbStories : DEFAULT_STORIES;

  // Collect every storage path that needs a signed URL.
  const paths = new Set<string>();
  if (hero.imagePath) paths.add(hero.imagePath);
  for (const sl of slides) if (sl.imagePath) paths.add(sl.imagePath);
  if (about.imagePath) paths.add(about.imagePath);
  for (const t of testimonials) if (t.photoPath) paths.add(t.photoPath);
  for (const s of stories) if (s.imagePath) paths.add(s.imagePath);

  const media: Record<string, string> = {};
  if (paths.size > 0) {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrls([...paths], SIGN_EXPIRY);
    for (const item of data ?? []) {
      if (item.path && item.signedUrl) media[item.path] = item.signedUrl;
    }
  }

  return { hero, slides, stats, about, testimonials, stories, media };
}

export type UploadSiteMediaResult =
  | { ok: true; path: string; width: number; height: number }
  | { ok: false; error: string };

/**
 * Admin-only validated upload into the site-media bucket. Inspects real magic
 * bytes to defeat spoofed files, stores with a server-derived content type, and
 * registers the file in the media library.
 */
export const uploadSiteMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error("Expected form data");
    const file = data.get("file");
    if (!(file instanceof File)) throw new Error("No file provided");
    const folder = data.get("folder");
    const altText = data.get("alt_text");
    return {
      file,
      folder: typeof folder === "string" && folder ? folder : "general",
      altText: typeof altText === "string" ? altText : null,
    };
  })
  .handler(async ({ data, context }): Promise<UploadSiteMediaResult> => {
    const { file, folder, altText } = data;
    const { supabase, userId } = context;

    try {
      await requireServerAdmin(supabase, userId);
    } catch {
      return { ok: false, error: "Only admins can upload media." };
    }

    if (!ACCEPTED_MIME.has(file.type)) {
      return { ok: false, error: "Unsupported file type. Upload a JPG, PNG or WebP image." };
    }
    if (file.size > MAX_FILE_BYTES) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      return { ok: false, error: `Image is too large (${mb}MB). Maximum size is 10MB.` };
    }
    if (file.size === 0) {
      return { ok: false, error: "That file is empty. Please choose a valid image." };
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const info = getImageInfo(bytes);
    if (!info || !ACCEPTED_MIME.has(`image/${info.format}`)) {
      return { ok: false, error: "File contents don't match a supported image type." };
    }

    const cleanFolder = folder.replace(/[^a-z0-9-_]/gi, "").toLowerCase() || "general";
    const path = `${cleanFolder}/${crypto.randomUUID()}.${EXT_BY_FORMAT[info.format]}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: "31536000",
      upsert: false,
      contentType: `image/${info.format}`,
    });
    if (uploadError) {
      return { ok: false, error: "Upload failed. Please try again." };
    }

    const { error: insertError } = await supabase.from("media_library").insert({
      path,
      file_name: file.name.slice(0, 200),
      content_type: `image/${info.format}`,
      kind: "image",
      folder: cleanFolder,
      alt_text: altText,
      width: info.width,
      height: info.height,
      size_bytes: file.size,
      uploaded_by: userId,
    });
    if (insertError) {
      // Roll back the orphaned file.
      await supabase.storage.from(BUCKET).remove([path]);
      return { ok: false, error: "Could not register the upload. Please try again." };
    }

    return { ok: true, path, width: info.width, height: info.height };
  });
