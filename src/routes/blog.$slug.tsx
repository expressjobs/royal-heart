import { createFileRoute, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getPublishedPost } from "@/lib/blog.functions";
import { getSiteSettingsContent } from "@/lib/cms.functions";
import { pageSeo } from "@/lib/seo";

const postQuery = (slug: string) =>
  queryOptions({
    queryKey: ["blog", "post", slug],
    queryFn: () => getPublishedPost({ data: { slug } }),
    staleTime: 60 * 1000,
  });

const siteSettingsQuery = queryOptions({
  queryKey: ["site-settings"],
  queryFn: () => getSiteSettingsContent(),
  staleTime: 60 * 1000,
});

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ context, params }) => {
    const post = await context.queryClient.ensureQueryData(postQuery(params.slug));
    if (!post) throw notFound();
    return {
      post,
      siteSettings: await context.queryClient.ensureQueryData(siteSettingsQuery),
    };
  },
  head: ({ loaderData }) => {
    if (!loaderData?.post) return pageSeo({ path: "/blog" });
    const { post, siteSettings } = loaderData;
    const siteName = siteSettings.brand.siteName || "HeartConnect";
    const title = post.seoTitle || `${post.title} - ${siteName}`;
    const description =
      post.seoDescription || post.excerpt || "Read more on the HeartConnect blog.";

    return pageSeo({
      settings: siteSettings,
      path: `/blog/${post.slug}`,
      title,
      description,
      ogTitle: title,
      ogDescription: description,
      ogImage: post.coverUrl,
      type: "article",
    });
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
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-14">{children}</main>
      <SiteFooter />
    </div>
  );
}

function BlogPostPage() {
  const { post } = Route.useLoaderData();

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

