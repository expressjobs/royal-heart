import { test, expect, type Browser } from "@playwright/test";
import {
  readSupabaseEnv,
  mintTestSession,
  pngBuffer,
  VALID_PNG_500_B64,
  getTestUserId,
  ensureVictimUser,
  listVerificationRequests,
  listStorageObjects,
  cleanupVerification,
  type SupabaseEnv,
} from "./helpers";

/**
 * Cross-user authorization: an authenticated attacker must not be able to
 * create a verification selfie / request that belongs to a DIFFERENT user.
 *
 * Two attack surfaces are exercised, both using the attacker's real token:
 *   1. Direct Supabase Storage + Data API calls targeting the victim's
 *      user_id  -> rejected by RLS, nothing written.
 *   2. The submitVerification server function with a forged `user_id` field
 *      -> the field is ignored; identity is pinned to the bearer token, so
 *      nothing lands in the victim's storage folder or DB rows.
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

test.describe("cross-user selfie upload is rejected", () => {
  let serverFnUrl: string;
  let attackerToken: string;
  let attackerId: string;
  let victimId: string;

  test.beforeAll(async ({ browser }) => {
    const e = env!;
    const session = await mintTestSession(e);
    attackerToken = session.access_token as string;
    const id = await getTestUserId(e);
    if (!id) throw new Error("Could not resolve attacker user id");
    attackerId = id;
    victimId = await ensureVictimUser(e);
    // Clean slate for both accounts.
    await cleanupVerification(e, attackerId);
    await cleanupVerification(e, victimId);
    serverFnUrl = await captureServerFnUrl(browser, e, session);
  });

  test.afterAll(async () => {
    if (env) {
      await cleanupVerification(env, attackerId);
      await cleanupVerification(env, victimId);
    }
  });

  test("direct storage upload to the victim's folder is blocked by RLS", async () => {
    const e = env!;
    const res = await fetch(`${e.url}/storage/v1/object/profile-photos/${victimId}/attack.png`, {
      method: "POST",
      headers: {
        apikey: e.publishableKey,
        Authorization: `Bearer ${attackerToken}`,
        "Content-Type": "image/png",
      },
      body: pngBuffer(VALID_PNG_500_B64),
    });
    expect(res.ok).toBeFalsy();
    expect([400, 401, 403]).toContain(res.status);

    // Nothing landed in the victim's storage folder.
    expect(await listStorageObjects(e, victimId)).toHaveLength(0);
  });

  test("direct verification_requests insert for the victim is blocked by RLS", async () => {
    const e = env!;
    const res = await fetch(`${e.url}/rest/v1/verification_requests`, {
      method: "POST",
      headers: {
        apikey: e.publishableKey,
        Authorization: `Bearer ${attackerToken}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        user_id: victimId,
        photo_path: `${victimId}/forged.png`,
      }),
    });
    expect(res.ok).toBeFalsy();
    expect([401, 403]).toContain(res.status);

    // No row was created for the victim.
    expect(await listVerificationRequests(e, victimId)).toHaveLength(0);
  });

  test("server function ignores a forged user_id and never writes to the victim", async ({
    request,
  }) => {
    const e = env!;
    // Send a valid selfie but try to pin it to the victim via an extra field.
    const res = await request.post(serverFnUrl, {
      headers: {
        Authorization: `Bearer ${attackerToken}`,
        "x-tsr-serverFn": "true",
      },
      multipart: {
        user_id: victimId, // forged — server must ignore this
        file: {
          name: "selfie.png",
          mimeType: "image/png",
          buffer: pngBuffer(VALID_PNG_500_B64),
        },
      },
    });

    // The call may succeed, but only as the ATTACKER — never the victim.
    const body = await res.text();
    expect(body).toContain('"pending"');

    // Victim has no rows and no stored objects.
    expect(await listVerificationRequests(e, victimId)).toHaveLength(0);
    expect(await listStorageObjects(e, victimId)).toHaveLength(0);

    // The created record (if any) belongs to the attacker, scoped to their folder.
    const attackerRows = await listVerificationRequests(e, attackerId);
    expect(attackerRows.every((r) => r.photo_path.startsWith(`${attackerId}/`))).toBeTruthy();
  });
});
