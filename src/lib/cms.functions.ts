import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";
import { requireServerSuperAdmin } from "@/lib/server-auth";
import { writeAdminAuditWarning } from "@/lib/admin-audit";
import { safeHref } from "@/lib/utils";
import { getImageInfo } from "./image-validation";
import {
  DEFAULT_ABOUT,
  DEFAULT_FEATURES,
  DEFAULT_FOOTER,
  DEFAULT_HERO,
  DEFAULT_INFO_PAGES,
  DEFAULT_STATS,
  DEFAULT_STORIES,
  DEFAULT_TESTIMONIALS,
} from "./cms-defaults";
import type {
  AboutContent,
  FeaturesContent,
  FooterContent,
  HeroContent,
  HeroSlide,
  HomepageContent,
  InfoPageContent,
  StatsContent,
  SuccessStory,
  Testimonial,
} from "./cms-types";

const BUCKET = "site-media";
const SIGN_EXPIRY = 60 * 60; // 1h (regenerated each request)
const ACCEPTED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
const EXT_BY_FORMAT: Record<string, string> = { jpeg: "jpg", png: "png", webp: "webp" };

type JsonObject = Record<string, unknown>;
type CmsTableKind = "hero_slides" | "testimonials" | "success_stories" | "blog_posts";

export interface CmsMutationResult {
  ok: boolean;
  error?: string;
}

export interface AdminCmsSnapshot {
  sections: {
    hero: HeroContent;
    stats: StatsContent;
    about: AboutContent;
    features: FeaturesContent;
    footer: FooterContent;
    pages: Record<string, InfoPageContent>;
  };
  slides: Database["public"]["Tables"]["hero_slides"]["Row"][];
  testimonials: Database["public"]["Tables"]["testimonials"]["Row"][];
  stories: Database["public"]["Tables"]["success_stories"]["Row"][];
  posts: Database["public"]["Tables"]["blog_posts"]["Row"][];
}

export interface MediaLibraryItem {
  path: string;
  file_name: string;
  alt_text: string | null;
}

function publicClient() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  return createClient<Database>(process.env.SUPABASE_URL!, key!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};
}

function mergeSection<T extends JsonObject>(fallback: T, value: unknown): T {
  return { ...fallback, ...asObject(value) } as T;
}

function mergeStats(value: unknown): StatsContent {
  const merged = mergeSection(
    DEFAULT_STATS as unknown as JsonObject,
    value,
  ) as unknown as StatsContent;
  return Array.isArray(merged.items) && merged.items.length > 0 ? merged : DEFAULT_STATS;
}

function mergeFeatures(value: unknown): FeaturesContent {
  const merged = mergeSection(
    DEFAULT_FEATURES as unknown as JsonObject,
    value,
  ) as unknown as FeaturesContent;
  return {
    ...DEFAULT_FEATURES,
    ...merged,
    items:
      Array.isArray(merged.items) && merged.items.length > 0
        ? merged.items
        : DEFAULT_FEATURES.items,
  };
}

function mergeFooter(value: unknown): FooterContent {
  const merged = mergeSection(
    DEFAULT_FOOTER as unknown as JsonObject,
    value,
  ) as unknown as FooterContent;
  return {
    ...DEFAULT_FOOTER,
    ...merged,
    columns:
      Array.isArray(merged.columns) && merged.columns.length > 0
        ? merged.columns
        : DEFAULT_FOOTER.columns,
  };
}

function mergeInfoPage(slug: string, value: unknown): InfoPageContent {
  const fallback = DEFAULT_INFO_PAGES[slug] ?? DEFAULT_INFO_PAGES.about;
  const merged = mergeSection(
    fallback as unknown as JsonObject,
    value,
  ) as unknown as InfoPageContent;
  const fallbackSections =
    Array.isArray(merged.sections) && merged.sections.length > 0
      ? merged.sections.map((section, index) => {
          const fallbackSection = fallback.sections[index];
          return {
            title: section.title?.trim() || fallbackSection?.title || "Information",
            body: section.body?.trim() || fallbackSection?.body || "",
            bullets:
              Array.isArray(section.bullets) && section.bullets.length > 0
                ? section.bullets
                : (fallbackSection?.bullets ?? []),
          };
        })
      : fallback.sections;
  return {
    ...fallback,
    ...merged,
    eyebrow: merged.eyebrow?.trim() || fallback.eyebrow,
    title: merged.title?.trim() || fallback.title,
    intro: merged.intro?.trim() || fallback.intro,
    sections: fallbackSections,
    contactChannels: Array.isArray(merged.contactChannels)
      ? merged.contactChannels
      : fallback.contactChannels,
    reportAbuse:
      merged.reportAbuse && typeof merged.reportAbuse === "object"
        ? { ...fallback.reportAbuse, ...merged.reportAbuse }
        : fallback.reportAbuse,
  };
}

function normalizeSectionData(data: unknown): Json {
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  return data as Json;
}

function cmsFailure(error: unknown, fallback = "CMS action failed."): CmsMutationResult {
  const message = describeSupabaseError(error, fallback);
  return { ok: false, error: message };
}

async function assertSuperAdmin(context: { supabase: unknown; userId: string }) {
  await requireServerSuperAdmin(
    context.supabase as Parameters<typeof requireServerSuperAdmin>[0],
    context.userId,
  );
}

async function auditCms(
  supabaseAdmin: Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"],
  actorId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  details?: Record<string, unknown>,
) {
  await writeAdminAuditWarning(supabaseAdmin, {
    actorId,
    action,
    entityType,
    entityId,
    details,
  });
}

/**
 * Public homepage content. Reads admin-managed overrides from site_content and
 * falls back to production-safe code defaults for any section that is empty.
 */
export const getHomepageContent = createServerFn({ method: "GET" }).handler(
  async (): Promise<HomepageContent> => {
    try {
      return await loadHomepageContent();
    } catch {
      return {
        hero: DEFAULT_HERO,
        slides: [],
        stats: DEFAULT_STATS,
        about: DEFAULT_ABOUT,
        features: DEFAULT_FEATURES,
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
    supabase
      .from("site_content")
      .select("section, data")
      .in("section", ["hero", "stats", "about", "features"]),
    supabase
      .from("hero_slides")
      .select("id, image_path, headline, subheadline, cta_label, cta_href")
      .eq("is_published", true)
      .or(`starts_at.is.null,starts_at.lte.${new Date().toISOString()}`)
      .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`)
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

  const sections = new Map<string, unknown>();
  for (const row of contentRes.data ?? []) sections.set(row.section, row.data);

  const hero = mergeSection(
    DEFAULT_HERO as unknown as JsonObject,
    sections.get("hero"),
  ) as unknown as HeroContent;
  const stats = mergeStats(sections.get("stats"));
  const about = mergeSection(
    DEFAULT_ABOUT as unknown as JsonObject,
    sections.get("about"),
  ) as unknown as AboutContent;
  const features = mergeFeatures(sections.get("features"));

  const slides: HeroSlide[] = (slidesRes.data ?? []).map((slide) => ({
    id: slide.id,
    imagePath: slide.image_path,
    headline: slide.headline,
    subheadline: slide.subheadline,
    ctaLabel: slide.cta_label,
    ctaHref: slide.cta_href,
  }));

  const dbTestimonials: Testimonial[] = (testimonialsRes.data ?? []).map((testimonial) => ({
    id: testimonial.id,
    name: testimonial.name,
    country: testimonial.country,
    quote: testimonial.quote,
    rating: testimonial.rating,
    photoPath: testimonial.photo_path,
  }));
  const testimonials = dbTestimonials.length > 0 ? dbTestimonials : DEFAULT_TESTIMONIALS;

  const dbStories: SuccessStory[] = (storiesRes.data ?? []).map((story) => ({
    id: story.id,
    title: story.title,
    coupleNames: story.couple_names,
    body: story.body,
    imagePath: story.image_path,
  }));
  const stories = dbStories.length > 0 ? dbStories : DEFAULT_STORIES;

  const paths = new Set<string>();
  if (hero.imagePath) paths.add(hero.imagePath);
  for (const slide of slides) if (slide.imagePath) paths.add(slide.imagePath);
  if (about.imagePath) paths.add(about.imagePath);
  for (const testimonial of testimonials)
    if (testimonial.photoPath) paths.add(testimonial.photoPath);
  for (const story of stories) if (story.imagePath) paths.add(story.imagePath);

  const media: Record<string, string> = {};
  if (paths.size > 0) {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrls([...paths], SIGN_EXPIRY);
    for (const item of data ?? []) {
      if (item.path && item.signedUrl) media[item.path] = item.signedUrl;
    }
  }

  return { hero, slides, stats, about, features, testimonials, stories, media };
}

export const getFooterContent = createServerFn({ method: "GET" }).handler(
  async (): Promise<FooterContent> => {
    try {
      const { data } = await publicClient()
        .from("site_content")
        .select("data")
        .eq("section", "footer")
        .maybeSingle();
      return mergeFooter(data?.data);
    } catch {
      return DEFAULT_FOOTER;
    }
  },
);

export const getInfoPageContent = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => {
    const slug =
      typeof input === "object" && input ? String((input as { slug?: unknown }).slug) : "";
    if (!DEFAULT_INFO_PAGES[slug]) throw new Error("Unknown page.");
    return { slug };
  })
  .handler(async ({ data }): Promise<InfoPageContent> => {
    try {
      const { data: row } = await publicClient()
        .from("site_content")
        .select("data")
        .eq("section", `page:${data.slug}`)
        .maybeSingle();
      return mergeInfoPage(data.slug, row?.data);
    } catch {
      return mergeInfoPage(data.slug, {});
    }
  });

export const getSuperAdminCmsSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminCmsSnapshot> => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [contentRes, slidesRes, testimonialsRes, storiesRes, postsRes] = await Promise.all([
      supabaseAdmin.from("site_content").select("section, data"),
      supabaseAdmin
        .from("hero_slides")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("testimonials")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("success_stories")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabaseAdmin.from("blog_posts").select("*").order("created_at", { ascending: false }),
    ]);

    const sections = new Map<string, unknown>();
    for (const row of contentRes.data ?? []) sections.set(row.section, row.data);

    return {
      sections: {
        hero: mergeSection(
          DEFAULT_HERO as unknown as JsonObject,
          sections.get("hero"),
        ) as unknown as HeroContent,
        stats: mergeStats(sections.get("stats")),
        about: mergeSection(
          DEFAULT_ABOUT as unknown as JsonObject,
          sections.get("about"),
        ) as unknown as AboutContent,
        features: mergeFeatures(sections.get("features")),
        footer: mergeFooter(sections.get("footer")),
        pages: Object.fromEntries(
          Object.keys(DEFAULT_INFO_PAGES).map((slug) => [
            slug,
            mergeInfoPage(slug, sections.get(`page:${slug}`)),
          ]),
        ),
      },
      slides: slidesRes.data ?? [],
      testimonials: testimonialsRes.data ?? [],
      stories: storiesRes.data ?? [],
      posts: postsRes.data ?? [],
    };
  });

export const saveSiteContentSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const raw = input as { section?: unknown; data?: unknown };
    const section = typeof raw?.section === "string" ? raw.section : "";
    const allowed = new Set([
      "hero",
      "stats",
      "about",
      "features",
      "footer",
      ...Object.keys(DEFAULT_INFO_PAGES).map((slug) => `page:${slug}`),
    ]);
    if (!allowed.has(section)) throw new Error("Unsupported content section.");
    return { section, data: normalizeSectionData(raw.data) };
  })
  .handler(async ({ data, context }): Promise<CmsMutationResult> => {
    let supabaseAdmin:
      | Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"]
      | null = null;

    try {
      await assertSuperAdmin(context);
    } catch (error) {
      return cmsFailure(error, "CMS save blocked: current user is not a super admin.");
    }

    try {
      ({ supabaseAdmin } = await import("@/integrations/supabase/client.server"));
    } catch (error) {
      return cmsFailure(error, "CMS save blocked: server admin client is not configured.");
    }

    try {
      const { error } = await supabaseAdmin
        .from("site_content")
        .upsert({ section: data.section, data: data.data }, { onConflict: "section" });
      if (error) {
        console.error("[cms-save] site_content upsert failed", {
          section: data.section,
          ...supabaseErrorFields(error),
        });
        return {
          ok: false,
          error: `CMS save failed while writing site_content (${data.section}): ${describeSupabaseError(
            error,
            "Unknown Supabase write error.",
          )}`,
        };
      }
    } catch (error) {
      console.error("[cms-save] site_content upsert threw", {
        section: data.section,
        error: describeSupabaseError(error, "Unknown site_content write error."),
      });
      return cmsFailure(
        error,
        `CMS save failed while writing site_content (${data.section}).`,
      );
    }

    try {
      await auditCms(supabaseAdmin, context.userId, "cms.section.save", "site_content", data.section);
    } catch (error) {
      console.warn("[cms-save] audit failed after site_content save", {
        section: data.section,
        error: describeSupabaseError(error, "Unknown audit error."),
      });
    }

    return { ok: true };
  });

export const listSuperAdminMediaLibrary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MediaLibraryItem[]> => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("media_library")
      .select("path, file_name, alt_text")
      .order("created_at", { ascending: false })
      .limit(60);
    return data ?? [];
  });

export const deleteSiteMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const path =
      typeof (input as { path?: unknown })?.path === "string"
        ? (input as { path: string }).path
        : "";
    if (!path || path.includes("..")) throw new Error("Invalid media path.");
    return { path };
  })
  .handler(async ({ data, context }): Promise<CmsMutationResult> => {
    try {
      await assertSuperAdmin(context);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin.from("media_library").delete().eq("path", data.path);
      if (error) throw error;
      await supabaseAdmin.storage.from(BUCKET).remove([data.path]);
      await auditCms(supabaseAdmin, context.userId, "cms.media.delete", "media_library", data.path);
      return { ok: true };
    } catch (error) {
      return cmsFailure(error, "Could not delete image.");
    }
  });

function validateTableKind(value: unknown): CmsTableKind {
  if (
    value === "hero_slides" ||
    value === "testimonials" ||
    value === "success_stories" ||
    value === "blog_posts"
  ) {
    return value;
  }
  throw new Error("Unsupported CMS table.");
}

function cleanHrefValue(value: unknown): string | null {
  if (value == null || value === "") return null;
  const href = String(value).trim();
  if (!safeHref(href)) throw new Error("Links must be relative paths or http(s) URLs.");
  return href;
}

export const createCmsRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const kind = validateTableKind((input as { kind?: unknown })?.kind);
    return { kind };
  })
  .handler(async ({ data, context }): Promise<CmsMutationResult & { id?: string }> => {
    try {
      await assertSuperAdmin(context);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      let createdId: string | undefined;

      if (data.kind === "hero_slides") {
        const { data: row, error } = await supabaseAdmin
          .from("hero_slides")
          .insert({ headline: "New slide", sort_order: 0 })
          .select("id")
          .single();
        if (error) throw error;
        createdId = row.id;
      } else if (data.kind === "testimonials") {
        const { data: row, error } = await supabaseAdmin
          .from("testimonials")
          .insert({
            name: "New testimonial",
            quote: "Share what this member loved about HeartConnect.",
            rating: 5,
            sort_order: 0,
          })
          .select("id")
          .single();
        if (error) throw error;
        createdId = row.id;
      } else if (data.kind === "success_stories") {
        const { data: row, error } = await supabaseAdmin
          .from("success_stories")
          .insert({
            title: "New success story",
            body: "Tell the story of how this couple met on HeartConnect.",
            sort_order: 0,
          })
          .select("id")
          .single();
        if (error) throw error;
        createdId = row.id;
      } else {
        const slug = `untitled-post-${Date.now().toString(36)}`;
        const { data: row, error } = await supabaseAdmin
          .from("blog_posts")
          .insert({ title: "Untitled post", slug, status: "draft", author_id: context.userId })
          .select("id")
          .single();
        if (error) throw error;
        createdId = row.id;
      }

      await auditCms(
        supabaseAdmin,
        context.userId,
        "cms.record.create",
        data.kind,
        createdId ?? null,
      );
      return { ok: true, id: createdId };
    } catch (error) {
      return cmsFailure(error, "Could not create record.");
    }
  });

export const updateCmsRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const raw = input as { kind?: unknown; id?: unknown; patch?: unknown };
    const kind = validateTableKind(raw.kind);
    const id = typeof raw.id === "string" ? raw.id : "";
    if (!id) throw new Error("Record id is required.");
    return { kind, id, patch: asObject(raw.patch) };
  })
  .handler(async ({ data, context }): Promise<CmsMutationResult> => {
    try {
      await assertSuperAdmin(context);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      if (data.kind === "hero_slides") {
        const patch = {
          image_path:
            data.patch.image_path === ""
              ? null
              : (data.patch.image_path as string | null | undefined),
          headline:
            data.patch.headline === "" ? null : (data.patch.headline as string | null | undefined),
          subheadline:
            data.patch.subheadline === ""
              ? null
              : (data.patch.subheadline as string | null | undefined),
          cta_label:
            data.patch.cta_label === ""
              ? null
              : (data.patch.cta_label as string | null | undefined),
          cta_href:
            data.patch.cta_href === undefined ? undefined : cleanHrefValue(data.patch.cta_href),
          is_published:
            data.patch.is_published === undefined ? undefined : Boolean(data.patch.is_published),
          starts_at:
            data.patch.starts_at === ""
              ? null
              : (data.patch.starts_at as string | null | undefined),
          ends_at:
            data.patch.ends_at === "" ? null : (data.patch.ends_at as string | null | undefined),
        };
        if (
          patch.starts_at &&
          patch.ends_at &&
          new Date(patch.ends_at) <= new Date(patch.starts_at)
        ) {
          throw new Error("End time must be after the start time.");
        }
        const { error } = await supabaseAdmin.from("hero_slides").update(patch).eq("id", data.id);
        if (error) throw error;
      } else if (data.kind === "testimonials") {
        const rating = Number(data.patch.rating ?? 5);
        if (!Number.isFinite(rating) || rating < 1 || rating > 5)
          throw new Error("Rating must be 1-5.");
        const { error } = await supabaseAdmin
          .from("testimonials")
          .update({
            name: String(data.patch.name ?? ""),
            country: data.patch.country ? String(data.patch.country) : null,
            quote: String(data.patch.quote ?? ""),
            rating,
            photo_path: data.patch.photo_path ? String(data.patch.photo_path) : null,
            is_published: Boolean(data.patch.is_published),
          })
          .eq("id", data.id);
        if (error) throw error;
      } else if (data.kind === "success_stories") {
        const { error } = await supabaseAdmin
          .from("success_stories")
          .update({
            title: String(data.patch.title ?? ""),
            couple_names: data.patch.couple_names ? String(data.patch.couple_names) : null,
            body: String(data.patch.body ?? ""),
            image_path: data.patch.image_path ? String(data.patch.image_path) : null,
            is_published: Boolean(data.patch.is_published),
          })
          .eq("id", data.id);
        if (error) throw error;
      } else {
        const slug = String(data.patch.slug ?? data.patch.title ?? "")
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-")
          .slice(0, 80);
        if (!slug) throw new Error("Blog slug is required.");
        const status = data.patch.status === "published" ? "published" : "draft";
        const publishedAt =
          status === "published"
            ? ((data.patch.published_at as string | null | undefined) ?? new Date().toISOString())
            : null;
        const { error } = await supabaseAdmin
          .from("blog_posts")
          .update({
            title: String(data.patch.title ?? ""),
            slug,
            excerpt: data.patch.excerpt ? String(data.patch.excerpt) : null,
            body: data.patch.body ? String(data.patch.body) : null,
            cover_path: data.patch.cover_path ? String(data.patch.cover_path) : null,
            status,
            published_at: publishedAt,
            seo_title: data.patch.seo_title ? String(data.patch.seo_title) : null,
            seo_description: data.patch.seo_description ? String(data.patch.seo_description) : null,
          })
          .eq("id", data.id);
        if (error) throw error;
      }

      await auditCms(supabaseAdmin, context.userId, "cms.record.update", data.kind, data.id);
      return { ok: true };
    } catch (error) {
      return cmsFailure(error, "Could not update record.");
    }
  });

export const deleteCmsRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const raw = input as { kind?: unknown; id?: unknown };
    const kind = validateTableKind(raw.kind);
    const id = typeof raw.id === "string" ? raw.id : "";
    if (!id) throw new Error("Record id is required.");
    return { kind, id };
  })
  .handler(async ({ data, context }): Promise<CmsMutationResult> => {
    try {
      await assertSuperAdmin(context);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin.from(data.kind).delete().eq("id", data.id);
      if (error) throw error;
      await auditCms(supabaseAdmin, context.userId, "cms.record.delete", data.kind, data.id);
      return { ok: true };
    } catch (error) {
      return cmsFailure(error, "Could not delete record.");
    }
  });

export const reorderCmsRecords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const raw = input as { kind?: unknown; ids?: unknown };
    const kind = validateTableKind(raw.kind);
    if (kind === "blog_posts") throw new Error("Blog posts are not manually ordered.");
    const ids = Array.isArray(raw.ids)
      ? raw.ids.filter((id): id is string => typeof id === "string")
      : [];
    return { kind, ids };
  })
  .handler(async ({ data, context }): Promise<CmsMutationResult> => {
    try {
      await assertSuperAdmin(context);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await Promise.all(
        data.ids.map((id, sort_order) =>
          supabaseAdmin
            .from(data.kind)
            .update({ sort_order } as never)
            .eq("id", id),
        ),
      );
      await auditCms(supabaseAdmin, context.userId, "cms.records.reorder", data.kind, null);
      return { ok: true };
    } catch (error) {
      return cmsFailure(error, "Could not reorder records.");
    }
  });

export type UploadSiteMediaResult =
  | { ok: true; path: string; width: number; height: number; warning?: string }
  | { ok: false; error: string };

function supabaseErrorFields(error: unknown): {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
} {
  if (error && typeof error === "object" && "message" in error) {
    const err = error as {
      code?: unknown;
      message?: unknown;
      details?: unknown;
      hint?: unknown;
    };
    return {
      code: typeof err.code === "string" ? err.code : undefined,
      message: typeof err.message === "string" ? err.message : undefined,
      details: typeof err.details === "string" ? err.details : undefined,
      hint: typeof err.hint === "string" ? err.hint : undefined,
    };
  }
  return {};
}

function describeSupabaseError(error: unknown, fallback = "Unknown Supabase error"): string {
  const fields = supabaseErrorFields(error);
  if (fields.message) {
    return [
      fields.code ? `${fields.code}: ${fields.message}` : fields.message,
      fields.details ? `Details: ${fields.details}` : null,
      fields.hint ? `Hint: ${fields.hint}` : null,
    ]
      .filter(Boolean)
      .join(" ");
  }
  return error instanceof Error ? error.message : fallback;
}

/**
 * Super-admin-only validated upload into the site-media bucket.
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

    try {
      await assertSuperAdmin(context);
    } catch {
      return { ok: false, error: "Only super admins can upload media." };
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: uploadError } = await supabaseAdmin.storage.from(BUCKET).upload(path, bytes, {
      cacheControl: "31536000",
      upsert: false,
      contentType: `image/${info.format}`,
    });
    if (uploadError) {
      const message = describeSupabaseError(uploadError);
      console.error("[cms-media-upload] Supabase Storage upload failed", {
        bucket: BUCKET,
        path,
        userId: context.userId,
        message,
        name: uploadError.name,
        status: "status" in uploadError ? uploadError.status : undefined,
        statusCode: "statusCode" in uploadError ? uploadError.statusCode : undefined,
      });
      return { ok: false, error: `Storage upload failed: ${message}` };
    }

    const { error: insertError } = await supabaseAdmin.from("media_library").insert({
      path,
      file_name: file.name.slice(0, 200),
      content_type: `image/${info.format}`,
      kind: "image",
      folder: cleanFolder,
      alt_text: altText,
      width: info.width,
      height: info.height,
      size_bytes: file.size,
      uploaded_by: context.userId,
    });
    if (insertError) {
      const message = describeSupabaseError(insertError);
      console.warn("[cms-media-upload] Media registry insert failed after storage upload", {
        bucket: BUCKET,
        path,
        userId: context.userId,
        message,
        code: insertError.code,
        details: insertError.details,
        hint: insertError.hint,
      });
      return {
        ok: true,
        path,
        width: info.width,
        height: info.height,
        warning: `Image uploaded, but the media library registry was not updated: ${message}`,
      };
    }

    try {
      await auditCms(supabaseAdmin, context.userId, "cms.media.upload", "media_library", path);
    } catch (auditError) {
      console.warn("[cms-media-upload] Audit write failed after storage upload", {
        path,
        userId: context.userId,
        message: describeSupabaseError(auditError),
      });
    }
    return { ok: true, path, width: info.width, height: info.height };
  });
