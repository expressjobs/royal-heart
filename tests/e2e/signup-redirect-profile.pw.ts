import { test, expect } from "@playwright/test";
import {
  readSupabaseEnv,
  ensureSignupFlowUser,
  mintSignupFlowSession,
  deleteProfile,
  getProfile,
  waitForProfile,
  completeOnboarding,
} from "./helpers";

/**
 * Integration coverage for the email-confirmation flow:
 *
 *   sign up -> confirm via email link -> emailRedirectTo lands on /discover
 *
 * A user who confirms their account through the email link arrives at
 * /discover with a valid session but WITHOUT ever running the login/onboarding
 * setup path, so no `profiles` row may exist yet. This regression suite proves:
 *
 *   1. Landing on /discover with no profile row auto-creates one in the DB,
 *      and the app advances to onboarding instead of hanging on a spinner.
 *   2. Once the profile exists and onboarding is complete, the My Profile page
 *      renders its editor (it never gets stuck on the infinite spinner that the
 *      original `if (!profile) <Spinner/>` bug produced).
 *
 * The session is injected into localStorage exactly the way the real Supabase
 * redirect would populate it, so the AuthContext bootstrap path is exercised
 * end-to-end in the browser.
 */

const env = readSupabaseEnv();

test.skip(!env, "Supabase service credentials not available for e2e auth");

test.describe("email-confirmation redirect to /discover", () => {
  let userId: string;

  test.beforeAll(async () => {
    userId = await ensureSignupFlowUser(env!);
  });

  test("auto-creates the profile row and never hangs on a spinner", async ({ browser }) => {
    const e = env!;
    // Simulate a brand-new confirmed account: no profile row exists yet.
    await deleteProfile(e, userId);
    expect(await getProfile(e, userId)).toBeNull();

    const session = await mintSignupFlowSession(e);

    const context = await browser.newContext();
    const page = await context.newPage();

    // Establish the localhost origin, inject the session (as the email-redirect
    // would), then navigate to the emailRedirectTo target.
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.evaluate(([k, v]) => window.localStorage.setItem(k, v), [
      e.storageKey,
      JSON.stringify(session),
    ] as const);
    await page.goto("/discover", { waitUntil: "domcontentloaded" });

    // The app must auto-create the profile row for this freshly-confirmed user.
    const created = await waitForProfile(e, userId);
    expect(created.id).toBe(userId);

    // A brand-new profile is not onboarded yet, so the app routes to onboarding
    // rather than getting stuck on an infinite loading spinner.
    await page.waitForURL("**/onboarding", { timeout: 20_000 });
    await expect(page).toHaveURL(/\/onboarding$/);

    await context.close();
  });

  test("renders the My Profile page once the profile is set up", async ({ browser }) => {
    const e = env!;
    // Ensure the profile exists and onboarding is complete so /profile renders
    // the editor instead of redirecting back into onboarding. completeOnboarding
    // requires the row to exist, so recreate it first if a prior test cleared it.
    if (!(await getProfile(e, userId))) {
      const setupSession = await mintSignupFlowSession(e);
      const setupCtx = await browser.newContext();
      const setupPage = await setupCtx.newPage();
      await setupPage.goto("/", { waitUntil: "domcontentloaded" });
      await setupPage.evaluate(([k, v]) => window.localStorage.setItem(k, v), [
        e.storageKey,
        JSON.stringify(setupSession),
      ] as const);
      await setupPage.goto("/discover", { waitUntil: "domcontentloaded" });
      await waitForProfile(e, userId);
      await setupCtx.close();
    }
    await completeOnboarding(e, userId);

    const session = await mintSignupFlowSession(e);

    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.evaluate(([k, v]) => window.localStorage.setItem(k, v), [
      e.storageKey,
      JSON.stringify(session),
    ] as const);
    await page.goto("/profile", { waitUntil: "domcontentloaded" });

    // The editor heading must appear — proving the page resolved its loading
    // state and rendered real content (not the perpetual spinner).
    await expect(page.getByRole("heading", { name: "My Profile" })).toBeVisible({
      timeout: 20_000,
    });

    // The display-name input is part of the editor body, confirming the full
    // form rendered rather than an error/empty state.
    await page.getByRole("tab", { name: "Details" }).click();
    await expect(page.getByLabel("Display name")).toBeVisible({ timeout: 10_000 });

    await context.close();
  });
});
