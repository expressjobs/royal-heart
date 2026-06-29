import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

const PROTECTED_PATH_PREFIXES = [
  "/admin",
  "/billing",
  "/discover",
  "/explore",
  "/likes",
  "/matches",
  "/messages",
  "/notifications",
  "/onboarding",
  "/payment-success",
  "/premium",
  "/profile",
  "/recommendations",
  "/search",
  "/settings",
];

const SECURITY_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "Content-Security-Policy": [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://cloudflareinsights.com https://static.cloudflareinsights.com",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; "),
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(self), payment=(self)",
  "X-Content-Type-Options": "nosniff",
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isDocumentNavigation(request: Request): boolean {
  const accept = request.headers.get("accept") ?? "";
  const mode = request.headers.get("sec-fetch-mode") ?? "";
  return request.method === "GET" && (mode === "navigate" || accept.includes("text/html"));
}

function shouldRedirectProtectedDocument(request: Request): boolean {
  if (!isDocumentNavigation(request)) return false;
  const { pathname } = new URL(request.url);
  return PROTECTED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      if (shouldRedirectProtectedDocument(request)) {
        return withSecurityHeaders(Response.redirect(new URL("/auth", request.url), 302));
      }
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return withSecurityHeaders(await normalizeCatastrophicSsrResponse(response));
    } catch (error) {
      console.error(error);
      return withSecurityHeaders(
        new Response(renderErrorPage(), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      );
    }
  },
};
