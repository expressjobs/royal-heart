import { test, expect, type Browser } from "@playwright/test";
import {
  readSupabaseEnv,
  mintTestSession,
  pngBuffer,
  VALID_PNG_500_B64,
  SMALL_PNG_100_B64,
  type SupabaseEnv,
} from "./helpers";

/**
 * Verifies that the `submitVerification` server function rejects invalid
 * selfies SERVER-SIDE — i.e. even when the browser-side validation is bypassed
 * and the endpoint is called directly with a forged payload.
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
      // Abort so no real verification request is actually created.
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

test.describe("verification selfie server-side validation", () => {
  let serverFnUrl: string;
  let accessToken: string;

  test.beforeAll(async ({ browser }) => {
    const e = env!;
    const session = await mintTestSession(e);
    accessToken = session.access_token as string;
    serverFnUrl = await captureServerFnUrl(browser, e, session);
  });

  async function submit(
    request: import("@playwright/test").APIRequestContext,
    file: { name: string; mimeType: string; buffer: Buffer },
  ) {
    const res = await request.post(serverFnUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "x-tsr-serverFn": "true",
      },
      multipart: { file },
    });
    return res.text();
  }

  test("rejects a wrong MIME type", async ({ request }) => {
    const body = await submit(request, {
      name: "note.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("not an image"),
    });
    expect(body).toContain("Unsupported file type");
  });

  test("rejects an oversized file", async ({ request }) => {
    const body = await submit(request, {
      name: "huge.png",
      mimeType: "image/png",
      buffer: Buffer.alloc(9 * 1024 * 1024), // 9MB > 8MB limit
    });
    expect(body).toContain("too large");
  });

  test("rejects a too-small resolution", async ({ request }) => {
    const body = await submit(request, {
      name: "tiny.png",
      mimeType: "image/png",
      buffer: pngBuffer(SMALL_PNG_100_B64), // real 100×100 PNG
    });
    expect(body).toContain("resolution is too low");
  });

  test("rejects a valid MIME type with corrupted/unparseable image bytes", async ({ request }) => {
    // Declared as a PNG, but the bytes are garbage with no valid image
    // signature, so server-side byte inspection (getImageInfo) returns null.
    const body = await submit(request, {
      name: "corrupted.png",
      mimeType: "image/png",
      buffer: Buffer.from("this is not a real png, just random bytes \x00\x01\x02\x03"),
    });
    expect(body).toContain("couldn't read that image");
  });

  test("rejects a PNG header followed by corrupted bytes", async ({ request }) => {
    // Correct PNG magic bytes but a truncated/garbled body, so dimension
    // parsing fails and the server still rejects the upload.
    const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const garbage = Buffer.from([0xde, 0xad, 0xbe, 0xef, 0x00, 0x11, 0x22, 0x33]);
    const body = await submit(request, {
      name: "broken.png",
      mimeType: "image/png",
      buffer: Buffer.concat([pngMagic, garbage]),
    });
    expect(body).toContain("couldn't read that image");
  });

  test("accepts a valid selfie is NOT part of this suite (would mutate data)", async () => {
    // Intentionally only negative cases are asserted here so the suite never
    // creates real verification rows. The happy path is covered by unit/UI flow.
    expect(serverFnUrl).toContain("/_serverFn/");
  });
});
