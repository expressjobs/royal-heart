/**
 * Helpers for the verification-upload e2e tests.
 *
 * These tests assert that the `submitVerification` server function rejects
 * invalid selfies SERVER-SIDE, independent of the browser-side checks. To do
 * that we need an authenticated session and a way to call the server function
 * endpoint with payloads the UI would normally block.
 */

export interface SupabaseEnv {
  url: string;
  serviceKey: string;
  publishableKey: string;
  projectRef: string;
  storageKey: string;
}

/** Reads the Supabase env needed to mint a test session, or null if unavailable. */
export function readSupabaseEnv(): SupabaseEnv | null {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !serviceKey || !publishableKey) return null;
  const projectRef = new URL(url).hostname.split(".")[0];
  return {
    url: url.replace(/\/$/, ""),
    serviceKey,
    publishableKey,
    projectRef,
    storageKey: `sb-${projectRef}-auth-token`,
  };
}

const TEST_EMAIL = "selfie-validation-test@heartconnect.demo";
const TEST_PASSWORD = "Test-Selfie-9281!";

/**
 * Ensures a confirmed test user exists and returns a fresh session object
 * (the value the supabase-js client stores in localStorage).
 */
export async function mintTestSession(env: SupabaseEnv): Promise<Record<string, unknown>> {
  // Create (or reuse) a confirmed user — ignore "already exists".
  await fetch(`${env.url}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: env.serviceKey,
      Authorization: `Bearer ${env.serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
    }),
  });

  const res = await fetch(`${env.url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: env.publishableKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  });
  if (!res.ok) {
    throw new Error(`Failed to mint test session: ${res.status} ${await res.text()}`);
  }
  const session = (await res.json()) as Record<string, unknown>;
  if (!session.access_token) throw new Error("Token response had no access_token");
  return session;
}

/** Email used for the "victim" account in cross-user authorization tests. */
export const VICTIM_EMAIL = "selfie-victim-test@heartconnect.demo";
const VICTIM_PASSWORD = "Test-Victim-7163!";

/** Creates (or reuses) a confirmed user with the given credentials. */
export async function ensureConfirmedUser(
  env: SupabaseEnv,
  email: string,
  password: string,
): Promise<void> {
  await fetch(`${env.url}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: env.serviceKey,
      Authorization: `Bearer ${env.serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
}

/** Resolves a user's auth id by email (service role), or null if absent. */
export async function getUserIdByEmail(env: SupabaseEnv, email: string): Promise<string | null> {
  const res = await fetch(`${env.url}/auth/v1/admin/users?filter=${encodeURIComponent(email)}`, {
    headers: { apikey: env.serviceKey, Authorization: `Bearer ${env.serviceKey}` },
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { users?: Array<{ id: string; email: string }> };
  return (body.users ?? []).find((u) => u.email === email)?.id ?? null;
}

/** Ensures the victim account exists and returns its auth id. */
export async function ensureVictimUser(env: SupabaseEnv): Promise<string> {
  await ensureConfirmedUser(env, VICTIM_EMAIL, VICTIM_PASSWORD);
  const id = await getUserIdByEmail(env, VICTIM_EMAIL);
  if (!id) throw new Error("Could not resolve victim user id");
  return id;
}

// Solid-color PNGs generated offline. A 500×500 image passes every check and is
// used to capture the real server-function URL; the 100×100 image is a real,
// valid PNG that is simply below the minimum resolution.
export const VALID_PNG_500_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAfQAAAH0CAIAAABEtEjdAAAG+ElEQVR4nO3UQQ3AIADAwDGFyEEOUjFBQtLcKeirY839AdDyvw4A4D5zBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gCBzBwgyd4AgcwcIMneAIHMHCDJ3gKADLXYFUAlUfikAAAAASUVORK5CYII=";

// A real 400×400 PNG — exactly the minimum accepted resolution (boundary case).
export const BOUNDARY_PNG_400_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAZAAAAGQCAIAAAAP3aGbAAAFNklEQVR4nO3UQQ3AIADAwDGFyEEisrDAjzS5U9BXx1z7Ayj4XwcA3DIsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgIwD6wgEsLdxcU0AAAAASUVORK5CYII=";

export const SMALL_PNG_100_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAIAAAD/gAIDAAAA60lEQVR4nO3QQQ3AIADAQEDh5CAHqbOwvsiSOwVN537O4Jt1O+BPzArMCswKzArMCswKzArMCswKzArMCswKzArMCswKzArMCswKzArMCswKzArMCswKzArMCswKzArMCswKzArMCswKzArMCswKzArMCswKzArMCswKzArMCswKzArMCswKzArMCswKzArMCswKzArMCswKzArMCswKzArMCswKzArMCswKzArMCswKzArMCswKzArMCswKzArMCswKzArMCswKzArMCswKzArMCswKzArMCswKzArMCswKzArMCswKzArMCl7E6QIw0tiFNgAAAABJRU5ErkJggg==";

/** Decodes a base64 PNG to a Buffer usable as a FormData file. */
export function pngBuffer(base64: string): Buffer {
  return Buffer.from(base64, "base64");
}

/** Returns the auth user id for the shared test account (or null if absent). */
export async function getTestUserId(env: SupabaseEnv): Promise<string | null> {
  const res = await fetch(
    `${env.url}/auth/v1/admin/users?filter=${encodeURIComponent(TEST_EMAIL)}`,
    {
      headers: { apikey: env.serviceKey, Authorization: `Bearer ${env.serviceKey}` },
    },
  );
  if (!res.ok) return null;
  const body = (await res.json()) as { users?: Array<{ id: string; email: string }> };
  const user = (body.users ?? []).find((u) => u.email === TEST_EMAIL);
  return user?.id ?? null;
}

/**
 * Reads the test user's verification requests via the service role (bypasses RLS).
 */
export async function listVerificationRequests(
  env: SupabaseEnv,
  userId: string,
): Promise<Array<{ id: string; status: string; photo_path: string }>> {
  const res = await fetch(
    `${env.url}/rest/v1/verification_requests?user_id=eq.${userId}&select=id,status,photo_path`,
    {
      headers: {
        apikey: env.serviceKey,
        Authorization: `Bearer ${env.serviceKey}`,
      },
    },
  );
  if (!res.ok) {
    throw new Error(`Failed to list verification requests: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as Array<{ id: string; status: string; photo_path: string }>;
}

/**
 * Lists objects stored under a user's folder in the profile-photos bucket
 * (service role, bypasses RLS). Returns the object names found.
 */
export async function listStorageObjects(env: SupabaseEnv, userId: string): Promise<string[]> {
  const res = await fetch(`${env.url}/storage/v1/object/list/profile-photos`, {
    method: "POST",
    headers: {
      apikey: env.serviceKey,
      Authorization: `Bearer ${env.serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prefix: `${userId}/`,
      limit: 1000,
      offset: 0,
      sortBy: { column: "name", order: "asc" },
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to list storage objects: ${res.status} ${await res.text()}`);
  }
  const items = (await res.json()) as Array<{ name: string }>;
  // The list API can include a synthetic placeholder row for empty folders.
  return items.map((i) => i.name).filter((n) => n && n !== ".emptyFolderPlaceholder");
}

/**
 * Updates the status (and optional note) of the test user's verification
 * request(s) via the service role — simulating an admin approval/rejection.
 * Returns the number of rows affected as reported by PostgREST.
 */
export async function setVerificationStatus(
  env: SupabaseEnv,
  userId: string,
  status: "pending" | "approved" | "rejected",
  note?: string,
): Promise<void> {
  const body: Record<string, unknown> = { status };
  if (note !== undefined) body.note = note;
  const res = await fetch(`${env.url}/rest/v1/verification_requests?user_id=eq.${userId}`, {
    method: "PATCH",
    headers: {
      apikey: env.serviceKey,
      Authorization: `Bearer ${env.serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Failed to set verification status: ${res.status} ${await res.text()}`);
  }
}

/**
 * Ensures a `profiles` row exists for the given user (service role). The
 * approval flow flips `is_verified` on this row, so it must exist for the
 * verified state to surface in the UI.
 */
export async function ensureProfile(env: SupabaseEnv, userId: string): Promise<void> {
  const res = await fetch(`${env.url}/rest/v1/profiles`, {
    method: "POST",
    headers: {
      apikey: env.serviceKey,
      Authorization: `Bearer ${env.serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    // onboarding_complete=true so AppShell renders Settings instead of
    // redirecting the test user into the onboarding flow.
    body: JSON.stringify({ id: userId, is_verified: false, onboarding_complete: true }),
  });
  if (!res.ok) {
    throw new Error(`Failed to ensure profile: ${res.status} ${await res.text()}`);
  }
}

/** Removes verification rows and stored selfies for the test user (service role). */
export async function cleanupVerification(env: SupabaseEnv, userId: string): Promise<void> {
  const rows = await listVerificationRequests(env, userId);
  const paths = rows.map((r) => r.photo_path).filter(Boolean);
  if (paths.length > 0) {
    await fetch(`${env.url}/storage/v1/object/profile-photos`, {
      method: "DELETE",
      headers: {
        apikey: env.serviceKey,
        Authorization: `Bearer ${env.serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prefixes: paths }),
    });
  }
  await fetch(`${env.url}/rest/v1/verification_requests?user_id=eq.${userId}`, {
    method: "DELETE",
    headers: {
      apikey: env.serviceKey,
      Authorization: `Bearer ${env.serviceKey}`,
      Prefer: "return=minimal",
    },
  });
  // Reset the verified flag so realtime-status runs start from a clean slate.
  await fetch(`${env.url}/rest/v1/profiles?id=eq.${userId}`, {
    method: "PATCH",
    headers: {
      apikey: env.serviceKey,
      Authorization: `Bearer ${env.serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ is_verified: false }),
  });
}

// ---------------------------------------------------------------------------
// Helpers for the email-confirmation (emailRedirectTo -> /discover) flow.
// A brand-new account confirmed via the email link lands on /discover WITHOUT
// ever having run the login/onboarding setup path, so it may have no profile
// row yet. These helpers let the test mint a session for a dedicated account
// and inspect/reset its profile row via the service role (bypassing RLS).
// ---------------------------------------------------------------------------

/** Dedicated account for the signup -> email confirm -> /discover flow. */
export const SIGNUP_FLOW_EMAIL = "signup-redirect-test@heartconnect.demo";
const SIGNUP_FLOW_PASSWORD = "Test-Signup-5527!";

/**
 * Mints a fresh session for an arbitrary confirmed account (the value the
 * supabase-js client stores in localStorage). Creates the user if needed.
 */
export async function mintSessionForUser(
  env: SupabaseEnv,
  email: string,
  password: string,
): Promise<Record<string, unknown>> {
  await ensureConfirmedUser(env, email, password);
  const res = await fetch(`${env.url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: env.publishableKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`Failed to mint session for ${email}: ${res.status} ${await res.text()}`);
  }
  const session = (await res.json()) as Record<string, unknown>;
  if (!session.access_token) throw new Error("Token response had no access_token");
  return session;
}

/** Convenience: mints a session for the dedicated signup-flow account. */
export async function mintSignupFlowSession(env: SupabaseEnv): Promise<Record<string, unknown>> {
  return mintSessionForUser(env, SIGNUP_FLOW_EMAIL, SIGNUP_FLOW_PASSWORD);
}

/** Returns the signup-flow account's auth id, creating the user if needed. */
export async function ensureSignupFlowUser(env: SupabaseEnv): Promise<string> {
  await ensureConfirmedUser(env, SIGNUP_FLOW_EMAIL, SIGNUP_FLOW_PASSWORD);
  const id = await getUserIdByEmail(env, SIGNUP_FLOW_EMAIL);
  if (!id) throw new Error("Could not resolve signup-flow user id");
  return id;
}

/** Fetches a single profile row via the service role, or null if absent. */
export async function getProfile(
  env: SupabaseEnv,
  userId: string,
): Promise<{ id: string; onboarding_complete: boolean; display_name: string | null } | null> {
  const res = await fetch(
    `${env.url}/rest/v1/profiles?id=eq.${userId}&select=id,onboarding_complete,display_name`,
    { headers: { apikey: env.serviceKey, Authorization: `Bearer ${env.serviceKey}` } },
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch profile: ${res.status} ${await res.text()}`);
  }
  const rows = (await res.json()) as Array<{
    id: string;
    onboarding_complete: boolean;
    display_name: string | null;
  }>;
  return rows[0] ?? null;
}

/**
 * Polls for a profile row to appear, returning it once present. Throws if it
 * never appears within the timeout. Used to assert the app auto-creates the
 * row after the user lands on /discover.
 */
export async function waitForProfile(
  env: SupabaseEnv,
  userId: string,
  timeoutMs = 15_000,
): Promise<{ id: string; onboarding_complete: boolean; display_name: string | null }> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const row = await getProfile(env, userId);
    if (row) return row;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Profile row for ${userId} was not created within ${timeoutMs}ms`);
}

/** Deletes the profile row for a user via the service role (idempotent). */
export async function deleteProfile(env: SupabaseEnv, userId: string): Promise<void> {
  const res = await fetch(`${env.url}/rest/v1/profiles?id=eq.${userId}`, {
    method: "DELETE",
    headers: {
      apikey: env.serviceKey,
      Authorization: `Bearer ${env.serviceKey}`,
      Prefer: "return=minimal",
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to delete profile: ${res.status} ${await res.text()}`);
  }
}

/**
 * Marks a profile as fully onboarded (service role) so the app renders the
 * main shell instead of redirecting into the onboarding flow.
 */
export async function completeOnboarding(
  env: SupabaseEnv,
  userId: string,
  displayName = "Redirect Tester",
): Promise<void> {
  const res = await fetch(`${env.url}/rest/v1/profiles?id=eq.${userId}`, {
    method: "PATCH",
    headers: {
      apikey: env.serviceKey,
      Authorization: `Bearer ${env.serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      onboarding_complete: true,
      display_name: displayName,
      gender: "woman",
      interested_in: ["men"],
      birth_date: "1995-01-01",
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to complete onboarding: ${res.status} ${await res.text()}`);
  }
}
