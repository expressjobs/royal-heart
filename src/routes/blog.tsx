import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/SiteFooter";
import { listPublishedPosts } from "@/lib/blog.functions";

const blogListQuery = queryOptions({
  queryKey: ["blog", "list"],
  queryFn: () => listPublishedPosts(),
  staleTime: 60 * 1000,
});

export const Route = createFileRoute("/blog")({
  loader: ({ context }) => context.queryClient.ensureQueryData(blogListQuery),
  head: () => ({
    meta: [
      { title: "Blog — HeartConnect" },
      {
        name: "description",
        content:
          "Dating tips, success stories, and relationship advice from the HeartConnect team.",
      },
      { property: "og:title", content: "Blog — HeartConnect" },
      {
        property: "og:description",
        content:
          "Dating tips, success stories, and relationship advice from the HeartConnect team.",
      },
      { property: "og:url", content: "https://royal-heart.com/blog" },
    ],
    links: [{ rel: "canonical", href: "https://royal-heart.com/blog" }],
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
      <header className="border-b border-border/60">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Logo />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild variant="ghost" className="rounded-full">
              <Link to="/">
                <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Home
              </Link>
            </Button>
          </div>
        </div>
      </header>
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
  const { data: posts } = useSuspenseQuery(blogListQuery);

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
