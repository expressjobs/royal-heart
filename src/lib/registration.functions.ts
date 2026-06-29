import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { isDisposableEmail } from "@/lib/registration";
import { attachReferralSignup } from "@/lib/referrals.functions";
import { GENDER_VALUES, normalizeGender } from "@/lib/gender";

const profilesTable = "profiles" as never;
const registrationAuditTable = "registration_audit" as never;
const identifierLocksTable = "auth_identifier_locks" as never;
const loginHistoryTable = "login_history" as never;
const authUserLookupTable = "auth_user_lookup" as never;

const attemptSchema = z.object({
  email: z.string().trim().email().max(255),
  phoneCountryCode: z.string().trim().max(8).optional(),
  phoneNumber: z.string().trim().max(32).optional(),
  eventType: z.enum(["signup_attempt", "login_attempt", "password_reset_request"]),
});

const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(24, "Username must be 24 characters or fewer")
  .regex(/^[a-zA-Z0-9_]+$/, "Use letters, numbers, and underscores only")
  .transform((value) => value.toLowerCase());

const availabilitySchema = z.object({
  email: z.string().trim().email().max(255).optional(),
  username: usernameSchema.optional(),
});

const loginIdentifierSchema = z.object({
  identifier: z.string().trim().min(3).max(255),
});

function normalizePhone(countryCode?: string, phoneNumber?: string) {
  const cc = (countryCode ?? "").replace(/[^\d+]/g, "");
  const number = (phoneNumber ?? "").replace(/\D/g, "");
  return number ? `${cc}${number}` : "";
}

function requestIp(): string | null {
  const request = getRequest();
  const forwarded = request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    forwarded ||
    request?.headers.get("cf-connecting-ip") ||
    request?.headers.get("x-real-ip") ||
    null
  );
}

async function sha256(value: string) {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

async function findAuthUserByEmail(supabaseAdmin: unknown, email: string) {
  const client = supabaseAdmin as {
    from: (table: typeof authUserLookupTable) => {
      select: (columns: string) => {
        eq: (
          column: string,
          value: string,
        ) => {
          maybeSingle: () => Promise<{
            data: { user_id: string; email: string; email_confirmed_at: string | null } | null;
          }>;
          limit: (count: number) => Promise<{
            data: Array<{
              user_id: string;
              email: string;
              email_confirmed_at: string | null;
            }> | null;
          }>;
        };
      };
    };
  };
  const { data } = await client
    .from(authUserLookupTable)
    .select("user_id, email, email_confirmed_at")
    .eq("email_lower", email.trim().toLowerCase())
    .maybeSingle();
  return data
    ? { id: data.user_id, email: data.email, email_confirmed_at: data.email_confirmed_at }
    : null;
}

function friendlyLockMessage(lockedUntil: string | null | undefined) {
  if (!lockedUntil) return "Too many attempts. Please try again later.";
  const minutes = Math.max(1, Math.ceil((new Date(lockedUntil).getTime() - Date.now()) / 60000));
  return `Too many attempts. Please try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

export interface RegistrationDecision {
  ok: boolean;
  reason: string | null;
  auditId: string | null;
}

export const inspectRegistrationAttempt = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => attemptSchema.parse(data))
  .handler(async ({ data }): Promise<RegistrationDecision> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const emailHash = await sha256(data.email);
    const normalizedPhone = normalizePhone(data.phoneCountryCode, data.phoneNumber);
    const phoneHash = normalizedPhone ? await sha256(normalizedPhone) : null;
    const ip = requestIp();
    const ipHash = ip ? await sha256(ip) : null;
    const request = getRequest();
    const userAgent = request?.headers.get("user-agent")?.slice(0, 500) ?? null;
    const reasons: string[] = [];

    if (data.eventType === "signup_attempt" && isDisposableEmail(data.email)) {
      reasons.push("Disposable email domain");
    }

    if (data.eventType === "signup_attempt" && normalizedPhone) {
      const { data: phoneMatches } = await supabaseAdmin
        .from(profilesTable)
        .select("id")
        .eq("phone_country_code", data.phoneCountryCode ?? "")
        .eq("phone_number", data.phoneNumber ?? "")
        .limit(1);
      if ((phoneMatches ?? []).length > 0) reasons.push("Phone number already in use");
    }

    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count: emailAttempts } = await supabaseAdmin
      .from(registrationAuditTable)
      .select("id", { count: "exact", head: true })
      .eq("email_hash", emailHash)
      .eq("event_type", data.eventType)
      .gte("created_at", since);

    const { count: ipAttempts } = ipHash
      ? await supabaseAdmin
          .from(registrationAuditTable)
          .select("id", { count: "exact", head: true })
          .eq("ip_hash", ipHash)
          .eq("event_type", data.eventType)
          .gte("created_at", since)
      : { count: 0 };

    const limit =
      data.eventType === "password_reset_request" ? 4 : data.eventType === "login_attempt" ? 12 : 5;
    if ((emailAttempts ?? 0) >= limit || (ipAttempts ?? 0) >= limit * 2) {
      reasons.push("Too many recent attempts");
    }

    const blocked = reasons.length > 0;
    const { data: audit } = await supabaseAdmin
      .from(registrationAuditTable)
      .insert({
        email_hash: emailHash,
        phone_hash: phoneHash,
        ip_hash: ipHash,
        user_agent: userAgent,
        event_type:
          blocked && data.eventType === "signup_attempt" ? "signup_blocked" : data.eventType,
        reason: blocked ? reasons.join("; ") : null,
        metadata: {
          has_phone: Boolean(normalizedPhone),
          domain: data.email.split("@")[1]?.toLowerCase() ?? null,
        },
      } as never)
      .select("id")
      .maybeSingle();

    return {
      ok: !blocked,
      reason: blocked
        ? "We could not create this account. Please use a permanent email and try again later."
        : null,
      auditId: (audit as { id?: string } | null)?.id ?? null,
    };
  });

export const checkAuthAvailability = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => availabilitySchema.parse(data))
  .handler(
    async ({
      data,
    }): Promise<{ emailAvailable: boolean | null; usernameAvailable: boolean | null }> => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      let emailAvailable: boolean | null = null;
      let usernameAvailable: boolean | null = null;

      if (data.email) {
        const existing = await findAuthUserByEmail(supabaseAdmin, data.email);
        emailAvailable = !existing;
      }

      if (data.username) {
        const { data: existing } = await supabaseAdmin
          .from(profilesTable)
          .select("id")
          .eq("username", data.username)
          .limit(1);
        usernameAvailable = (existing ?? []).length === 0;
      }

      return { emailAvailable, usernameAvailable };
    },
  );

export const preparePasswordLogin = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => loginIdentifierSchema.parse(data))
  .handler(
    async ({ data }): Promise<{ ok: boolean; email: string | null; reason: string | null }> => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const identifier = data.identifier.trim().toLowerCase();
      const identifierHash = await sha256(identifier);

      const { data: lock } = await supabaseAdmin
        .from(identifierLocksTable)
        .select("locked_until")
        .eq("identifier_hash", identifierHash)
        .maybeSingle();
      const lockedUntil = (lock as { locked_until?: string | null } | null)?.locked_until ?? null;
      if (lockedUntil && new Date(lockedUntil).getTime() > Date.now()) {
        return { ok: false, email: null, reason: friendlyLockMessage(lockedUntil) };
      }

      let userId: string | null = null;
      let email = identifier.includes("@") ? identifier : null;

      if (!email) {
        const { data: profile } = await supabaseAdmin
          .from(profilesTable)
          .select("id, account_locked_until")
          .eq("username", identifier)
          .maybeSingle();
        userId = (profile as { id?: string | null } | null)?.id ?? null;
        const accountLockedUntil =
          (profile as { account_locked_until?: string | null } | null)?.account_locked_until ??
          null;
        if (accountLockedUntil && new Date(accountLockedUntil).getTime() > Date.now()) {
          return { ok: false, email: null, reason: friendlyLockMessage(accountLockedUntil) };
        }
        if (userId) {
          const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
          email = authUser.user?.email?.toLowerCase() ?? null;
        }
      } else {
        const authUser = await findAuthUserByEmail(supabaseAdmin, email);
        userId = authUser?.id ?? null;
        if (userId) {
          const { data: profile } = await supabaseAdmin
            .from(profilesTable)
            .select("account_locked_until")
            .eq("id", userId)
            .maybeSingle();
          const accountLockedUntil =
            (profile as { account_locked_until?: string | null } | null)?.account_locked_until ??
            null;
          if (accountLockedUntil && new Date(accountLockedUntil).getTime() > Date.now()) {
            return { ok: false, email: null, reason: friendlyLockMessage(accountLockedUntil) };
          }
        }
      }

      return { ok: true, email, reason: null };
    },
  );

export const recordPasswordLoginFailure = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => loginIdentifierSchema.parse(data))
  .handler(async ({ data }): Promise<{ locked: boolean; reason: string | null }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const identifier = data.identifier.trim().toLowerCase();
    const identifierHash = await sha256(identifier);
    const ip = requestIp();
    const ipHash = ip ? await sha256(ip) : null;
    const request = getRequest();
    const userAgent = request?.headers.get("user-agent")?.slice(0, 500) ?? null;
    const lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const { data: currentLock } = await supabaseAdmin
      .from(identifierLocksTable)
      .select("failed_attempts")
      .eq("identifier_hash", identifierHash)
      .maybeSingle();
    const nextAttempts =
      ((currentLock as { failed_attempts?: number } | null)?.failed_attempts ?? 0) + 1;
    const shouldLock = nextAttempts >= 5;

    await supabaseAdmin.from(identifierLocksTable).upsert(
      {
        identifier_hash: identifierHash,
        failed_attempts: nextAttempts,
        locked_until: shouldLock ? lockedUntil : null,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "identifier_hash" },
    );

    let userId: string | null = null;
    if (identifier.includes("@")) {
      userId = (await findAuthUserByEmail(supabaseAdmin, identifier))?.id ?? null;
    } else {
      const { data: profile } = await supabaseAdmin
        .from(profilesTable)
        .select("id")
        .eq("username", identifier)
        .maybeSingle();
      userId = (profile as { id?: string | null } | null)?.id ?? null;
    }

    if (userId) {
      const { data: profile } = await supabaseAdmin
        .from(profilesTable)
        .select("failed_login_attempts")
        .eq("id", userId)
        .maybeSingle();
      const profileAttempts =
        ((profile as { failed_login_attempts?: number } | null)?.failed_login_attempts ?? 0) + 1;
      await supabaseAdmin
        .from(profilesTable)
        .update({
          failed_login_attempts: profileAttempts,
          account_locked_until: profileAttempts >= 5 ? lockedUntil : null,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", userId);

      await supabaseAdmin.from(loginHistoryTable).insert({
        user_id: userId,
        event_type: profileAttempts >= 5 ? "account_locked" : "failed_login",
        success: false,
        failure_reason: profileAttempts >= 5 ? "temporary_lock" : "invalid_credentials",
        identifier_hash: identifierHash,
        ip_hash: ipHash,
        ip_address: ip,
        user_agent: userAgent,
      } as never);
    }

    return {
      locked: shouldLock,
      reason: shouldLock ? friendlyLockMessage(lockedUntil) : null,
    };
  });

export const completePasswordLogin = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        identifier: z.string().trim().min(3).max(255),
        emailVerified: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const identifierHash = await sha256(data.identifier);
    const ip = requestIp();
    const ipHash = ip ? await sha256(ip) : null;
    const request = getRequest();

    await supabaseAdmin
      .from(profilesTable)
      .update({
        failed_login_attempts: 0,
        account_locked_until: null,
        last_login_at: new Date().toISOString(),
        email_verified: data.emailVerified ?? true,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", data.userId);

    await supabaseAdmin.from(identifierLocksTable).delete().eq("identifier_hash", identifierHash);

    await supabaseAdmin.from(loginHistoryTable).insert({
      user_id: data.userId,
      event_type: "login",
      success: true,
      identifier_hash: identifierHash,
      ip_hash: ipHash,
      ip_address: ip,
      user_agent: request?.headers.get("user-agent")?.slice(0, 500) ?? null,
    } as never);

    return { ok: true };
  });

export const completeRegistrationAudit = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        auditId: z.string().uuid().nullable().optional(),
        userId: z.string().uuid(),
        email: z.string().trim().email().max(255),
        firstName: z.string().trim().min(1).max(80).optional(),
        lastName: z.string().trim().min(1).max(80).optional(),
        username: usernameSchema.optional(),
        dateOfBirth: z.string().trim().min(8).max(10).optional(),
        gender: z.enum(GENDER_VALUES).optional(),
        phoneCountryCode: z.string().trim().max(8).optional(),
        phoneNumber: z.string().trim().max(32).optional(),
        referralCode: z.string().trim().max(80).optional(),
        referralSourceUrl: z.string().trim().max(1000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const emailHash = await sha256(data.email);
    const normalizedPhone = normalizePhone(data.phoneCountryCode, data.phoneNumber);
    const phoneHash = normalizedPhone ? await sha256(normalizedPhone) : null;

    await supabaseAdmin.from(registrationAuditTable).insert({
      user_id: data.userId,
      email_hash: emailHash,
      phone_hash: phoneHash,
      event_type: "signup_created",
      reason: null,
      metadata: { source_audit_id: data.auditId ?? null },
    } as never);

    const now = new Date().toISOString();
    const displayName = [data.firstName, data.lastName].filter(Boolean).join(" ").trim() || null;
    await supabaseAdmin.from(profilesTable).upsert(
      {
        id: data.userId,
        display_name: displayName,
        username: data.username ?? null,
        birth_date: data.dateOfBirth ?? null,
        gender: normalizeGender(data.gender),
        phone_country_code: data.phoneCountryCode ?? null,
        phone_number: data.phoneNumber ?? null,
        age_attested_at: data.dateOfBirth ? now : null,
        terms_accepted_at: now,
        privacy_accepted_at: now,
        email_verified: false,
        updated_at: now,
      } as never,
      { onConflict: "id" },
    );

    await attachReferralSignup({
      userId: data.userId,
      referralCode: data.referralCode,
      sourceUrl: data.referralSourceUrl,
    });

    return { ok: true };
  });
