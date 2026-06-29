import { test, expect, type Browser, type APIRequestContext } from "@playwright/test";
import {
  readSupabaseEnv,
  mintTestSession,
  pngBuffer,
  VALID_PNG_500_B64,
  SMALL_PNG_100_B64,
  getTestUserId,
  listVerificationRequests,
  listStorageObjects,
  cleanupVerification,
  type SupabaseEnv,
} from "./helpers";

/**
 * Confirms that REJECTED selfie uploads have no side effects: nothing is
 * written to Supabase Storage and no `pending` verification request rows are
 * created. Validation runs before the storage upload and DB insert, so an
 * invalid file must never leave a trace.
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

test.describe("rejected selfie uploads leave no trace", () => {
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

  async function submit(
    request: APIRequestContext,
    file: { name: string; mimeType: string; buffer: Buffer },
  ): Promise<string> {
    const res = await request.post(serverFnUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "x-tsr-serverFn": "true",
      },
      multipart: { file },
    });
    return res.text();
  }

  test("no storage object or pending request after rejected uploads", async ({ request }) => {
    // Sanity: clean slate before we begin.
    expect(await listVerificationRequests(env!, userId)).toHaveLength(0);
    expect(await listStorageObjects(env!, userId)).toHaveLength(0);

    // Wrong MIME type.
    expect(
      await submit(request, {
        name: "note.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("not an image"),
      }),
    ).toContain("Unsupported file type");

    // Oversized file (>8MB).
    expect(
      await submit(request, {
        name: "huge.png",
        mimeType: "image/png",
        buffer: Buffer.alloc(9 * 1024 * 1024),
      }),
    ).toContain("too large");

    // Too-small resolution (real 100×100 PNG).
    expect(
      await submit(request, {
        name: "tiny.png",
        mimeType: "image/png",
        buffer: pngBuffer(SMALL_PNG_100_B64),
      }),
    ).toContain("resolution is too low");

    // Valid MIME but corrupted bytes.
    expect(
      await submit(request, {
        name: "corrupted.png",
        mimeType: "image/png",
        buffer: Buffer.from("definitely not a png \x00\x01\x02\x03"),
      }),
    ).toContain("couldn't read that image");

    // After every rejection: storage and DB must remain empty for this user.
    const rows = await listVerificationRequests(env!, userId);
    expect(rows, "no verification_requests rows should be created").toHaveLength(0);

    const objects = await listStorageObjects(env!, userId);
    expect(objects, "no objects should be stored in profile-photos").toHaveLength(0);
  });
});
