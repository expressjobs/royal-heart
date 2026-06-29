import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getSiteSettingsContent } from "@/lib/cms.functions";
import { listPublishedPosts } from "@/lib/blog.functions";
import { pageSeo } from "@/lib/seo";

const blogListQuery = queryOptions({
  queryKey: ["blog", "list"],
  queryFn: () => listPublishedPosts(),
  staleTime: 60 * 1000,
});

const siteSettingsQuery = queryOptions({
  queryKey: ["site-settings"],
  queryFn: () => getSiteSettingsContent(),
  staleTime: 60 * 1000,
});

export const Route = createFileRoute("/blog")({
  loader: async ({ context }) => ({
    posts: await context.queryClient.ensureQueryData(blogListQuery),
    siteSettings: await context.queryClient.ensureQueryData(siteSettingsQuery),
  }),
  head: ({ loaderData }) =>
    pageSeo({
      settings: loaderData?.siteSettings,
      path: "/blog",
      title: `Blog - ${loaderData?.siteSettings.brand.siteName ?? "HeartConnect"}`,
      description:
        "Dating tips, success stories, and relationship advice from the HeartConnect team.",
      ogTitle: `Blog - ${loaderData?.siteSettings.brand.siteName ?? "HeartConnect"}`,
      ogDescription:
        "Dating tips, success stories, and relationship advice from the HeartConnect team.",
    }),
  component: BlogIndex,
  errorComponent: () => (
    <BlogShell>
      <p className="text-center text-muted-foreground">Couldn't load posts right now.</p>
    </BlogShell>
  ),
  notFoundComponent: () => (
    <BlogShell>
      <p className="text-center text-muted-foreground">Nothing here.</p>
    </BlogShell>
  ),
});

function BlogShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <section className="bg-gradient-warm">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center md:py-20">
          <span className="text-sm font-semibold uppercase tracking-wide text-primary">Blog</span>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight md:text-5xl">
            Stories &amp; relationship advice
          </h1>
        </div>
      </section>
      <main className="mx-auto max-w-5xl px-4 py-14">{children}</main>
      <SiteFooter />
    </div>
  );
}

function BlogIndex() {
  const { posts } = Route.useLoaderData();
  useSuspenseQuery(blogListQuery);

  return (
    <BlogShell>
      {posts.length === 0 ? (
        <p className="text-center text-muted-foreground">
          No posts published yet — check back soon.
        </p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <Link
              key={p.id}
              to="/blog/$slug"
              params={{ slug: p.slug }}
              className="group overflow-hidden rounded-3xl border border-border bg-card transition-shadow hover:shadow-lg"
            >
              {p.coverUrl ? (
                <img
                  src={p.coverUrl}
                  alt={p.title}
                  className="h-44 w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="h-44 w-full bg-gradient-warm" />
              )}
              <div className="p-5">
                {p.publishedAt && (
                  <p className="text-xs text-muted-foreground">
                    {new Date(p.publishedAt).toLocaleDateString()}
                  </p>
                )}
                <h2 className="mt-1 font-display text-lg font-semibold group-hover:text-primary">
                  {p.title}
                </h2>
                {p.excerpt && (
                  <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{p.excerpt}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </BlogShell>
  );
}

