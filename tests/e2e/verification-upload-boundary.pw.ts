import { test, expect, type Browser } from "@playwright/test";
import {
  readSupabaseEnv,
  mintTestSession,
  pngBuffer,
  VALID_PNG_500_B64,
  BOUNDARY_PNG_400_B64,
  getTestUserId,
  listVerificationRequests,
  cleanupVerification,
  type SupabaseEnv,
} from "./helpers";

/**
 * Boundary coverage: a selfie at exactly the minimum 400×400 resolution must be
 * ACCEPTED (the server check rejects only width/height < 400), and a `pending`
 * verification request must be recorded. This suite mutates data and cleans up.
 */

const env = readSupabaseEnv();

// Skip cleanly in environments without Supabase service credentials.
test.skip(!env, "Supabase service credentials not available for e2e auth");

/** Drives the real Settings UI once to discover the build-specific server-fn URL. */
async function captureServerFnUrl(
  browser: Browser,
  e: SupabaseEnv,
  session: Record<string, unknown>,
): Promise<string> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(([k, v]) => window.localStorage.setItem(k, v), [
    e.storageKey,
    JSON.stringify(session),
  ] as const);
  await page.goto("/settings", { waitUntil: "domcontentloaded" });
  await page.getByText("Request verification").waitFor({ timeout: 15_000 });

  let capturedUrl: string | null = null;
  await context.route("**/*", async (route) => {
    const req = route.request();
    const headers = req.headers();
    const isServerFn =
      req.method() === "POST" && "x-tsr-serverfn" in headers && !req.url().includes("supabase");
    if (isServerFn && !capturedUrl) {
      capturedUrl = req.url();
      // Abort so this discovery step never creates a real request.
      await route.abort();
    } else {
      await route.continue();
    }
  });

  await page.setInputFiles('input[type="file"]', {
    name: "selfie.png",
    mimeType: "image/png",
    buffer: pngBuffer(VALID_PNG_500_B64),
  });
  await expect.poll(() => capturedUrl, { timeout: 10_000 }).not.toBeNull();
  await context.close();
  return capturedUrl!;
}

test.describe("verification selfie minimum-resolution boundary", () => {
  let serverFnUrl: string;
  let accessToken: string;
  let userId: string;

  test.beforeAll(async ({ browser }) => {
    const e = env!;
    const session = await mintTestSession(e);
    accessToken = session.access_token as string;
    const id = await getTestUserId(e);
    if (!id) throw new Error("Could not resolve test user id");
    userId = id;
    // Start from a clean slate so assertions are deterministic.
    await cleanupVerification(e, userId);
    serverFnUrl = await captureServerFnUrl(browser, e, session);
  });

  test.afterAll(async () => {
    if (env && userId) await cleanupVerification(env, userId);
  });

  test("accepts a 400×400 selfie and records a pending request", async ({ request }) => {
    const res = await request.post(serverFnUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "x-tsr-serverFn": "true",
      },
      multipart: {
        file: {
          name: "selfie-400.png",
          mimeType: "image/png",
          buffer: pngBuffer(BOUNDARY_PNG_400_B64), // real, exactly 400×400 PNG
        },
      },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.text();
    // Server function returns the serialized result { ok: true, request: {...} }.
    expect(body).toContain('"ok"');
    expect(body).toContain('"request"');
    expect(body).toContain('"pending"');
    // The 400×400 image must NOT trip the low-resolution rejection.
    expect(body).not.toContain("resolution is too low");

    // Confirm the row really landed in the database with pending status.
    const rows = await listVerificationRequests(env!, userId);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.every((r) => r.status === "pending")).toBeTruthy();
    expect(rows.every((r) => r.photo_path.startsWith(`${userId}/`))).toBeTruthy();
  });
});
