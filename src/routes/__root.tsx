import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import "@fontsource-variable/fraunces";
import "@fontsource-variable/plus-jakarta-sans";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "../contexts/AuthContext";
import { ThemeProvider } from "../contexts/ThemeContext";
import { Toaster } from "../components/ui/sonner";
import { captureReferralVisit } from "@/lib/referrals.functions";

const SITE_URL = "https://royal-heart.com";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "HeartConnect — Dating for Serious Relationships" },
      {
        name: "description",
        content:
          "HeartConnect is a modern dating platform for people seeking meaningful, lasting relationships. Create your profile, discover verified matches, and connect safely.",
      },
      { name: "author", content: "HeartConnect" },
      { property: "og:site_name", content: "HeartConnect" },
      { property: "og:title", content: "HeartConnect — Dating for Serious Relationships" },
      {
        property: "og:description",
        content:
          "Meet genuine, verified people looking for real connection. Smart matching, real-time chat, and safety-first design.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/` },
      { property: "og:image", content: `${SITE_URL}/og-image.png` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      {
        property: "og:image:alt",
        content: "HeartConnect — Verified. Safe. Meaningful Relationships.",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@HeartConnect" },
      { name: "twitter:title", content: "HeartConnect — Dating for Serious Relationships" },
      {
        name: "twitter:description",
        content:
          "Meet genuine, verified people looking for real connection. Smart matching, real-time chat, and safety-first design.",
      },
      { name: "twitter:image", content: `${SITE_URL}/og-image.png` },
      { name: "theme-color", content: "#ec286e" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icon-512.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/site.webmanifest" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "HeartConnect",
          url: SITE_URL,
          logo: `${SITE_URL}/icon-512.png`,
          description:
            "A modern dating platform for people seeking meaningful, lasting relationships.",
          sameAs: ["https://twitter.com/HeartConnect"],
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "HeartConnect",
          url: SITE_URL,
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const isLocalhost = ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
    if (window.location.protocol !== "https:" && !isLocalhost) return;

    const registerServiceWorker = () => {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" });
    };

    if (document.readyState === "complete") {
      registerServiceWorker();
      return;
    }

    window.addEventListener("load", registerServiceWorker, { once: true });
    return () => window.removeEventListener("load", registerServiceWorker);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("ref");
    if (!code || localStorage.getItem("heartconnect_referral_code")) return;
    void captureReferralVisit({
      data: {
        code,
        sourceUrl: window.location.href,
        landingPath: window.location.pathname,
      },
    }).then((result) => {
      if (!result.ok || !result.code) return;
      localStorage.setItem("heartconnect_referral_code", result.code);
      localStorage.setItem("heartconnect_referral_source", window.location.href);
      document.cookie = `heartconnect_referral_code=${encodeURIComponent(result.code)}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax`;
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <Outlet />
          <Toaster />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
