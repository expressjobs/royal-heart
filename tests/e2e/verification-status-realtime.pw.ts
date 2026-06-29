import { test, expect } from "@playwright/test";
import {
  readSupabaseEnv,
  mintTestSession,
  pngBuffer,
  VALID_PNG_500_B64,
  getTestUserId,
  setVerificationStatus,
  ensureProfile,
  cleanupVerification,
} from "./helpers";

/**
 * Real-time UI coverage for the verification flow. Drives the actual Settings
 * UI as the signed-in test user and asserts that the verification status
 * surface reacts live to:
 *   1. submitting a selfie            -> "pending"
 *   2. an admin rejection             -> "rejected"
 *   3. an admin approval              -> "approved" (profile badge flips)
 *
 * The status is exposed via `data-verification-status` on the section so the
 * assertions are independent of copy changes. Admin actions are simulated with
 * the service role (a PATCH on verification_requests), which is exactly what
 * the real admin screen does, and the change is delivered to the browser via
 * Supabase Realtime — no page reload happens between assertions.
 */

const env = readSupabaseEnv();

test.skip(!env, "Supabase service credentials not available for e2e auth");

test.describe("verification status updates in real time", () => {
  let userId: string;

  test.beforeAll(async () => {
    const e = env!;
    await mintTestSession(e); // ensure the confirmed test user exists
    const id = await getTestUserId(e);
    if (!id) throw new Error("Could not resolve test user id");
    userId = id;
    await ensureProfile(e, userId);
    await cleanupVerification(e, userId);
  });

  test.afterAll(async () => {
    if (env && userId) await cleanupVerification(env, userId);
  });

  test("reflects pending, rejected and approved without a reload", async ({ browser }) => {
    const e = env!;
    // Fresh session minted inside the test so the bearer token is current.
    const session = await mintTestSession(e);

    const context = await browser.newContext();
    const page = await context.newPage();

    // Establish the localhost origin, inject the session, then load Settings.
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.evaluate(([k, v]) => window.localStorage.setItem(k, v), [
      e.storageKey,
      JSON.stringify(session),
    ] as const);
    await page.goto("/settings", { waitUntil: "domcontentloaded" });

    const section = page.getByTestId("verification-section");
    await section.waitFor({ timeout: 15_000 });

    // No request yet -> the form (status "none") is shown.
    await expect(section).toHaveAttribute("data-verification-status", "none", {
      timeout: 15_000,
    });

    // 1. Submit a valid selfie through the real UI. The server function creates
    //    a pending request and the component reflects it immediately.
    await page.setInputFiles('input[type="file"]', {
      name: "selfie.png",
      mimeType: "image/png",
      buffer: pngBuffer(VALID_PNG_500_B64),
    });
    await expect(section).toHaveAttribute("data-verification-status", "pending", {
      timeout: 20_000,
    });

    // 2. Admin rejects -> realtime pushes the change, UI flips to "rejected"
    //    with NO navigation/reload.
    await setVerificationStatus(e, userId, "rejected", "Please retake in better lighting.");
    await expect(section).toHaveAttribute("data-verification-status", "rejected", {
      timeout: 20_000,
    });

    // 3. Admin approves -> the DB trigger sets profiles.is_verified, the
    //    component refreshes the profile and the UI flips to "approved".
    await setVerificationStatus(e, userId, "approved");
    await expect(section).toHaveAttribute("data-verification-status", "approved", {
      timeout: 20_000,
    });

    await context.close();
  });
});
