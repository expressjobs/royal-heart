import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/SiteFooter";
import { getPublishedPost, type PublicPost } from "@/lib/blog.functions";

const postQuery = (slug: string) =>
  queryOptions({
    queryKey: ["blog", "post", slug],
    queryFn: () => getPublishedPost({ data: { slug } }),
    staleTime: 60 * 1000,
  });

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ context, params }) => {
    const post = await context.queryClient.ensureQueryData(postQuery(params.slug));
    if (!post) throw notFound();
    return post;
  },
  head: ({ loaderData }) => {
    const post = loaderData as PublicPost | undefined;
    if (!post) return { meta: [{ title: "Blog — HeartConnect" }] };
    const title = post.seoTitle || `${post.title} — HeartConnect`;
    const description =
      post.seoDescription || post.excerpt || "Read more on the HeartConnect blog.";
    const url = `https://royal-heart.com/blog/${post.slug}`;
    const meta = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { property: "og:url", content: url },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
    ];
    if (post.coverUrl) {
      meta.push(
        { property: "og:image", content: post.coverUrl },
        { name: "twitter:image", content: post.coverUrl },
      );
    }
    return { meta, links: [{ rel: "canonical", href: url }] };
  },
  component: BlogPostPage,
  errorComponent: () => (
    <PostShell>
      <p className="text-center text-muted-foreground">Couldn't load this post.</p>
    </PostShell>
  ),
  notFoundComponent: () => (
    <PostShell>
      <p className="text-center text-muted-foreground">
        This post doesn't exist or isn't published.
      </p>
    </PostShell>
  ),
});

function PostShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Logo />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild variant="ghost" className="rounded-full">
              <Link to="/blog">
                <ArrowLeft aria-hidden="true" className="h-4 w-4" /> All posts
              </Link>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-14">{children}</main>
      <SiteFooter />
    </div>
  );
}

function BlogPostPage() {
  const post = Route.useLoaderData();

  // Keep the cache warm / consistent on client navigation.
  useSuspenseQuery(postQuery(post.slug));

  return (
    <PostShell>
      <article className="space-y-6">
        <header className="space-y-3 text-center">
          {post.publishedAt && (
            <p className="text-sm text-muted-foreground">
              {new Date(post.publishedAt).toLocaleDateString()}
            </p>
          )}
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
            {post.title}
          </h1>
          {post.excerpt && (
            <p className="mx-auto max-w-xl text-lg text-muted-foreground">{post.excerpt}</p>
          )}
        </header>
        {post.coverUrl && (
          <img src={post.coverUrl} alt={post.title} className="w-full rounded-3xl object-cover" />
        )}
        {post.body && (
          <div className="prose-info whitespace-pre-wrap text-[15px] leading-relaxed text-muted-foreground">
            {post.body}
          </div>
        )}
      </article>
    </PostShell>
  );
}
