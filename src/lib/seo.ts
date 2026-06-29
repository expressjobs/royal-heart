import { DEFAULT_SITE_SETTINGS } from "@/lib/cms-defaults";
import type { SiteSettingsContent } from "@/lib/cms-types";

export const SITE_URL = "https://royal-heart.com";

function baseUrl(settings?: SiteSettingsContent): string {
  return (settings?.seo.canonicalUrl || SITE_URL).replace(/\/$/, "");
}

export function absoluteUrl(path: string, settings?: SiteSettingsContent): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${baseUrl(settings)}${path.startsWith("/") ? path : `/${path}`}`;
}

export function pageSeo({
  settings = DEFAULT_SITE_SETTINGS,
  path = "/",
  title,
  description,
  ogTitle,
  ogDescription,
  ogImage,
  type = "website",
}: {
  settings?: SiteSettingsContent;
  path?: string;
  title?: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string | null;
  type?: "website" | "article";
}) {
  const finalTitle = title || settings.seo.title;
  const finalDescription = description || settings.seo.description;
  const finalOgTitle = ogTitle || settings.seo.ogTitle || finalTitle;
  const finalOgDescription = ogDescription || settings.seo.ogDescription || finalDescription;
  const canonical = absoluteUrl(path, settings);
  const image = ogImage || settings.seo.ogImageUrl || absoluteUrl("/og-image.png", settings);

  return {
    meta: [
      { title: finalTitle },
      { name: "description", content: finalDescription },
      { property: "og:site_name", content: settings.brand.siteName },
      { property: "og:title", content: finalOgTitle },
      { property: "og:description", content: finalOgDescription },
      { property: "og:type", content: type },
      { property: "og:url", content: canonical },
      { property: "og:image", content: image },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: finalOgTitle },
      { name: "twitter:description", content: finalOgDescription },
      { name: "twitter:image", content: image },
    ],
    links: [{ rel: "canonical", href: canonical }],
  };
}
