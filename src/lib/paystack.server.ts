/**
 * Paystack server-only helpers. This file is import-protected (*.server.ts) and
 * must never be imported into client bundles. Load it via `await import()` inside
 * server-function / server-route handlers only.
 */

export const PAYSTACK_BASE = "https://api.paystack.co";

/** Branding metadata attached to every HeartConnect Paystack transaction. */
export function brandMetadata(planName: string) {
  return {
    website: "HeartConnect",
    product: "HeartConnect Membership",
    membership: planName,
    source_app: "heartconnect",
    domain: "royal-heart.com",
  };
}

type PaystackResponseEnvelope = {
  status?: boolean;
  message?: string;
};

type JsonRecord = Record<string, unknown>;
type MembershipTier = "free" | "premium" | "gold" | "platinum";

interface PaymentRow {
  id: string;
  user_id: string;
  plan_id: string | null;
  subscription_id: string | null;
  installment_id?: string | null;
  status: string | null;
  description: string | null;
  period_end: string | null;
  payment_method: string | null;
  amount_cents: number;
  currency: string;
  customer_email: string | null;
  invoice_number: string | null;
  reference: string | null;
  metadata: unknown;
}

interface SubscriptionPlanRow {
  id: string;
  name: string;
  tier: MembershipTier;
  billing_interval: string | null | undefined;
  interval_count: number | null;
}

interface SubscriptionTargetRow {
  id: string;
  current_period_end: string | null;
}

function secretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not configured.");
  return key;
}

async function paystackRequest<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const json = (await res.json().catch(() => null)) as PaystackResponseEnvelope | null;
  if (!res.ok || !json?.status) {
    throw new Error(json?.message || `Paystack request failed (${res.status}).`);
  }
  return json as T;
}

export interface InitArgs {
  email: string;
  /** Amount in the smallest currency unit (KES cents). */
  amountCents: number;
  currency: string;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
  /** Channels enabled for this checkout. */
  channels?: string[];
}

/** Initialize a Paystack transaction and return the hosted-checkout URL. */
export async function initializeTransaction(args: InitArgs) {
  const json = await paystackRequest<{
    data: { authorization_url: string; access_code: string; reference: string };
  }>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: args.email,
      amount: args.amountCents,
      currency: args.currency,
      reference: args.reference,
      callback_url: args.callbackUrl,
      metadata: args.metadata,
      channels: args.channels,
    }),
  });
  return json.data;
}

export interface PaystackVerifyData {
  status: string; // "success" | "failed" | "abandoned" | ...
  reference: string;
  amount: number;
  currency: string;
  channel: string | null;
  customer?: { email?: string };
  authorization?: { channel?: string; authorization_code?: string; reusable?: boolean };
  metadata?: Record<string, unknown>;
  paid_at?: string | null;
  id?: number;
}

/** Verify a transaction with Paystack (source of truth). */
export async function verifyTransaction(reference: string): Promise<PaystackVerifyData> {
  const json = await paystackRequest<{ data: PaystackVerifyData }>(
    `/transaction/verify/${encodeURIComponent(reference)}`,
  );
  return json.data;
}

/** Map a Paystack channel to our stored payment_method. */
export function mapPaymentMethod(channel: string | null | undefined): string {
  switch ((channel ?? "").toLowerCase()) {
    case "mobile_money":
    case "mobile_money_kes":
    case "mpesa":
      return "mpesa";
    case "card":
      return "card";
    case "apple_pay":
      return "apple_pay";
    case "bank":
    case "bank_transfer":
    case "dedicated_nuban":
      return "bank_transfer";
    case "pesalink":
      return "pesalink";
    default:
      return "other";
  }
}

function addInterval(from: Date, interval: string, count: number): Date {
  const d = new Date(from);
  if (interval === "year") d.setFullYear(d.getFullYear() + count);
  else if (interval === "week") d.setDate(d.getDate() + 7 * count);
  else if (interval === "day") d.setDate(d.getDate() + count);
  else d.setMonth(d.getMonth() + count);
  return d;
}

function invoiceNumber(): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `INV-${stamp}-${rand}`;
}

function safeRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function safeReferenceTail(reference: string | null | undefined): string | null {
  if (!reference) return null;
  return reference.length <= 8 ? reference : reference.slice(-8);
}

function normalizedEmail(value: string | null | undefined): string | null {
  const email = value?.trim().toLowerCase();
  return email || null;
}

function normalizedCurrency(value: string | null | undefined): string | null {
  const currency = value?.trim().toUpperCase();
  return currency || null;
}

function metadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function paymentLogContext(payment: PaymentRow | null, reference?: string | null) {
  return {
    paymentId: payment?.id ?? null,
    referenceTail: safeReferenceTail(payment?.reference ?? reference),
    userId: payment?.user_id ?? null,
    planId: payment?.plan_id ?? null,
    status: payment?.status ?? null,
  };
}

function logPaymentEvent(
  level: "warn" | "error" | "info",
  message: string,
  context: Record<string, unknown>,
) {
  const logger = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  logger(`[paystack-fulfillment] ${message}`, context);
}

function validateVerifiedTransaction(payment: PaymentRow, data: PaystackVerifyData): string[] {
  const errors: string[] = [];
  const metadata = safeRecord(data.metadata);
  const expectedCurrency = normalizedCurrency(payment.currency);
  const actualCurrency = normalizedCurrency(data.currency);
  const expectedEmail = normalizedEmail(payment.customer_email);
  const actualEmail = normalizedEmail(data.customer?.email);
  const metadataUserId = metadataString(metadata, "user_id");
  const metadataPlanId = metadataString(metadata, "plan_id");

  if (!payment.reference || data.reference !== payment.reference) {
    errors.push("reference_mismatch");
  }

  if (!Number.isFinite(data.amount) || Number(data.amount) !== Number(payment.amount_cents)) {
    errors.push("amount_mismatch");
  }

  if (!actualCurrency || !expectedCurrency || actualCurrency !== expectedCurrency) {
    errors.push("currency_mismatch");
  }

  if (!metadataUserId || metadataUserId !== payment.user_id) {
    errors.push("metadata_user_mismatch");
  }

  if (!payment.plan_id || !metadataPlanId || metadataPlanId !== payment.plan_id) {
    errors.push("metadata_plan_mismatch");
  }

  if (expectedEmail && actualEmail && expectedEmail !== actualEmail) {
    errors.push("customer_email_mismatch");
  }

  return errors;
}

async function markPaymentFailed(
  payment: PaymentRow,
  reason: string,
  extraMetadata: Record<string, unknown> = {},
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("payments")
    .update({
      status: "failed",
      metadata: {
        ...safeRecord(payment.metadata),
        ...extraMetadata,
        failure_reason: reason,
        failed_at: new Date().toISOString(),
      },
    })
    .eq("id", payment.id);
  if (error) throw error;
}

export interface FulfillResult {
  ok: boolean;
  status: "succeeded" | "failed" | "pending" | "already";
  tier?: string;
  planName?: string;
  periodEnd?: string | null;
  paymentMethod?: string;
}

/**
 * Idempotently fulfill a verified Paystack transaction:
 * activates the membership, records the payment method & branding metadata,
 * creates/extends the subscription, and applies the membership tier.
 * Used by both the verify server function and the webhook handler.
 */
export async function fulfillTransaction(data: PaystackVerifyData): Promise<FulfillResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Locate the pending payment we created at init time.
  const { data: payment } = await supabaseAdmin
    .from("payments")
    .select("*")
    .eq("reference", data.reference)
    .maybeSingle();

  if (!payment) {
    logPaymentEvent("warn", "verified transaction has no internal payment", {
      referenceTail: safeReferenceTail(data.reference),
      paystackStatus: data.status,
    });
    // Unknown reference — nothing we created; ignore safely.
    return { ok: false, status: "failed" };
  }

  const paymentRow = payment as PaymentRow;

  // Idempotency: already processed.
  if (paymentRow.status === "succeeded") {
    return {
      ok: true,
      status: "already",
      tier: undefined,
      planName: paymentRow.description ?? undefined,
      periodEnd: paymentRow.period_end,
      paymentMethod: paymentRow.payment_method ?? undefined,
    };
  }

  const method = mapPaymentMethod(data.channel ?? data.authorization?.channel);
  const userId = paymentRow.user_id as string;

  // Handle non-success outcomes (failed / abandoned / cancelled).
  if (data.status !== "success") {
    const { error } = await supabaseAdmin
      .from("payments")
      .update({
        status: data.status === "abandoned" ? "failed" : "failed",
        payment_method: method,
        provider_payment_id: data.id ? String(data.id) : null,
        metadata: { ...safeRecord(paymentRow.metadata), paystack_status: data.status },
      })
      .eq("id", paymentRow.id);
    if (error) throw error;
    return { ok: false, status: "failed", paymentMethod: method };
  }

  const validationErrors = validateVerifiedTransaction(paymentRow, data);
  if (validationErrors.length > 0) {
    await markPaymentFailed(paymentRow, "paystack_validation_failed", {
      paystack_status: data.status,
      fulfillment_validation_errors: validationErrors,
      paystack_id: data.id ?? null,
    });
    logPaymentEvent("warn", "verified transaction failed internal validation", {
      ...paymentLogContext(paymentRow),
      validationErrors,
    });
    return { ok: false, status: "failed", paymentMethod: method };
  }

  // Load the plan to size the membership period.
  if (!paymentRow.plan_id) {
    await markPaymentFailed(paymentRow, "missing_payment_plan");
    return { ok: false, status: "failed" };
  }
  const { data: plan } = await supabaseAdmin
    .from("subscription_plans")
    .select("*")
    .eq("id", paymentRow.plan_id)
    .maybeSingle();
  if (!plan) {
    await markPaymentFailed(paymentRow, "payment_plan_not_found");
    logPaymentEvent(
      "warn",
      "payment plan not found during fulfillment",
      paymentLogContext(paymentRow),
    );
    return { ok: false, status: "failed" };
  }

  const now = new Date();

  // ---- Installment payments (Gold Annual paid in 2 or 3 parts) ----
  if (paymentRow.installment_id) {
    return fulfillInstallment(paymentRow, plan, data, method, now);
  }

  // ---- Standard one-off payment ----
  // Card payments may recur; mobile money / bank are fixed-duration memberships.
  const isCard = method === "card" || method === "apple_pay";
  const fixedDays = plan.billing_interval === "year" ? 365 : 30;
  const periodEnd = isCard
    ? addInterval(now, plan.billing_interval ?? "month", plan.interval_count ?? 1)
    : new Date(now.getTime() + fixedDays * 86400000);
  const autoRenew = isCard && !!data.authorization?.reusable;

  // Cancel any previous live subscriptions for a clean switch.
  const { error: cancelError } = await supabaseAdmin
    .from("subscriptions")
    .update({ status: "canceled", canceled_at: now.toISOString() })
    .eq("user_id", userId)
    .in("status", ["active", "trialing", "past_due"]);
  if (cancelError) throw cancelError;

  const subMetadata = {
    ...brandMetadata(plan.name),
    payment_method: method,
    recurring: autoRenew,
    authorization_code: autoRenew ? (data.authorization?.authorization_code ?? null) : null,
  };

  const { data: sub, error: insertSubscriptionError } = await supabaseAdmin
    .from("subscriptions")
    .insert({
      user_id: userId,
      plan_id: plan.id,
      tier: plan.tier,
      status: "active",
      provider: "paystack",
      gateway: "paystack",
      payment_method: method,
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      auto_renew: autoRenew,
      cancel_at_period_end: !autoRenew,
      metadata: subMetadata,
    })
    .select("id")
    .single();
  if (insertSubscriptionError || !sub) {
    throw insertSubscriptionError ?? new Error("Subscription insert failed.");
  }

  // Finalize the payment record with method + branding metadata.
  const { error: updatePaymentError } = await supabaseAdmin
    .from("payments")
    .update({
      status: "succeeded",
      subscription_id: sub.id ?? paymentRow.subscription_id,
      payment_method: method,
      gateway: "paystack",
      provider_payment_id: data.id ? String(data.id) : null,
      customer_email: data.customer?.email ?? paymentRow.customer_email,
      invoice_number: paymentRow.invoice_number ?? invoiceNumber(),
      period_start: now.toISOString(),
      period_end: periodEnd.toISOString(),
      metadata: {
        ...safeRecord(paymentRow.metadata),
        payment_method: method,
        paystack_status: data.status,
        paystack_id: data.id ?? null,
      },
    })
    .eq("id", paymentRow.id);
  if (updatePaymentError) throw updatePaymentError;

  // Apply the membership tier.
  const { error: updateProfileError } = await supabaseAdmin
    .from("profiles")
    .update({ membership_tier: plan.tier })
    .eq("id", userId);
  if (updateProfileError) throw updateProfileError;
  const { createCommissionForPayment } = await import("@/lib/referrals.functions");
  await createCommissionForPayment({
    paymentId: paymentRow.id,
    userId,
    grossAmount: Number(data.amount ?? paymentRow.amount_cents) / 100,
    currency: data.currency || paymentRow.currency || "KES",
    tier: plan.tier,
  });

  return {
    ok: true,
    status: "succeeded",
    tier: plan.tier,
    planName: plan.name,
    periodEnd: periodEnd.toISOString(),
    paymentMethod: method,
  };
}

/** Each installment grants this many days of Gold access. */
const INSTALLMENT_GRANT_DAYS = 30;
const FULL_ANNUAL_DAYS = 365;

/**
 * Fulfill one installment of a multi-part annual plan. Each paid installment
 * grants 30 days of Gold. Full annual access (365 days from the first payment)
 * is only granted once every installment is paid. The plan is never marked as
 * fully paid until all installments are complete.
 */
async function fulfillInstallment(
  payment: PaymentRow,
  plan: SubscriptionPlanRow,
  data: PaystackVerifyData,
  method: string,
  now: Date,
): Promise<FulfillResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const userId = payment.user_id as string;
  const installmentId = payment.installment_id;
  if (!installmentId) return { ok: false, status: "failed", paymentMethod: method };

  const { data: inst } = await supabaseAdmin
    .from("payment_installments")
    .select("*")
    .eq("id", installmentId)
    .maybeSingle();
  if (!inst) return { ok: false, status: "failed", paymentMethod: method };

  const newPaid = inst.installments_paid + 1;
  const isFinal = newPaid >= inst.total_installments;
  const amountPaid = inst.amount_paid_cents + payment.amount_cents;

  const firstDate = new Date(inst.created_at);
  const fullAnnualEnd = new Date(firstDate.getTime() + FULL_ANNUAL_DAYS * 86400000);
  const grantEnd = new Date(now.getTime() + INSTALLMENT_GRANT_DAYS * 86400000);
  const periodEnd = isFinal ? fullAnnualEnd : grantEnd;
  const nextDue = isFinal ? null : grantEnd;

  const subMetadata = {
    ...brandMetadata(plan.name),
    payment_method: method,
    installment_plan: true,
    total_installments: inst.total_installments,
    installments_paid: newPaid,
    fully_paid: isFinal,
  };

  let subId: string | null = inst.subscription_id;
  if (subId) {
    const { error: updateSubscriptionError } = await supabaseAdmin
      .from("subscriptions")
      .update({
        status: "active",
        tier: plan.tier,
        provider: "paystack",
        gateway: "paystack",
        payment_method: method,
        current_period_end: periodEnd.toISOString(),
        auto_renew: false,
        cancel_at_period_end: isFinal,
        canceled_at: null,
        metadata: subMetadata,
      })
      .eq("id", subId);
    if (updateSubscriptionError) throw updateSubscriptionError;
  } else {
    const { error: cancelError } = await supabaseAdmin
      .from("subscriptions")
      .update({ status: "canceled", canceled_at: now.toISOString() })
      .eq("user_id", userId)
      .in("status", ["active", "trialing", "past_due"]);
    if (cancelError) throw cancelError;
    const { data: sub, error: insertSubscriptionError } = await supabaseAdmin
      .from("subscriptions")
      .insert({
        user_id: userId,
        plan_id: plan.id,
        tier: plan.tier,
        status: "active",
        provider: "paystack",
        gateway: "paystack",
        payment_method: method,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        auto_renew: false,
        cancel_at_period_end: isFinal,
        metadata: subMetadata,
      })
      .select("id")
      .single();
    if (insertSubscriptionError || !sub) {
      throw insertSubscriptionError ?? new Error("Installment subscription insert failed.");
    }
    subId = sub?.id ?? null;
  }

  const { error: updateInstallmentError } = await supabaseAdmin
    .from("payment_installments")
    .update({
      installments_paid: newPaid,
      amount_paid_cents: amountPaid,
      last_paid_at: now.toISOString(),
      next_due_at: nextDue ? nextDue.toISOString() : null,
      status: isFinal ? "completed" : "active",
      subscription_id: subId,
    })
    .eq("id", inst.id);
  if (updateInstallmentError) throw updateInstallmentError;

  const { error: updatePaymentError } = await supabaseAdmin
    .from("payments")
    .update({
      status: "succeeded",
      subscription_id: subId ?? payment.subscription_id,
      payment_method: method,
      gateway: "paystack",
      provider_payment_id: data.id ? String(data.id) : null,
      customer_email: data.customer?.email ?? payment.customer_email,
      invoice_number: payment.invoice_number ?? invoiceNumber(),
      period_start: now.toISOString(),
      period_end: periodEnd.toISOString(),
      metadata: {
        ...safeRecord(payment.metadata),
        payment_method: method,
        paystack_status: data.status,
        paystack_id: data.id ?? null,
        installment_number: newPaid,
        total_installments: inst.total_installments,
      },
    })
    .eq("id", payment.id);
  if (updatePaymentError) throw updatePaymentError;

  const { error: updateProfileError } = await supabaseAdmin
    .from("profiles")
    .update({ membership_tier: plan.tier })
    .eq("id", userId);
  if (updateProfileError) throw updateProfileError;
  const { createCommissionForPayment } = await import("@/lib/referrals.functions");
  await createCommissionForPayment({
    paymentId: payment.id,
    userId,
    grossAmount: Number(data.amount ?? payment.amount_cents) / 100,
    currency: data.currency || payment.currency || "KES",
    tier: plan.tier,
  });

  return {
    ok: true,
    status: "succeeded",
    tier: plan.tier,
    planName: plan.name,
    periodEnd: periodEnd.toISOString(),
    paymentMethod: method,
  };
}

/* ------------------------------------------------------------------ *
 * Webhook event handling                                              *
 * ------------------------------------------------------------------ */

/** Paystack events we act on. Everything else is acknowledged and ignored. */
const HANDLED_EVENTS = new Set([
  "charge.success",
  "charge.failed",
  "invoice.create",
  "invoice.update",
  "invoice.payment_failed",
  "subscription.create",
  "subscription.disable",
  "subscription.not_renew",
  "refund.processed",
  "refund.failed",
]);

export interface PaystackEvent {
  event?: string;
  data?: JsonRecord & {
    authorization?: { authorization_code?: string };
    customer?: { email?: string };
    paid?: boolean;
    reference?: string;
    status?: string;
    subscription?: { subscription_code?: string };
    subscription_code?: string;
    transaction?: { reference?: string };
    transaction_reference?: string;
  };
}

/** Resolve the app user id behind a Paystack customer email. */
async function findUserIdByEmail(email?: string | null): Promise<string | null> {
  if (!email) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("payments")
    .select("user_id")
    .eq("customer_email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.user_id as string) ?? null;
}

/**
 * Dispatch a verified Paystack webhook event to the right handler. The caller
 * has already verified the HMAC signature, so the payload is trusted; charge
 * events are still re-verified against Paystack as a second safety net.
 */
export async function handleWebhookEvent(
  event: PaystackEvent,
): Promise<FulfillResult | { ok: boolean; status: string }> {
  const name = event.event ?? "";
  if (!HANDLED_EVENTS.has(name)) return { ok: true, status: "ignored" };

  switch (name) {
    case "charge.success":
      return handleChargeSuccess(event);
    case "charge.failed":
      return handleChargeFailed(event);
    case "invoice.create":
      // Upcoming recurring charge notice — nothing to persist yet.
      return { ok: true, status: "ignored" };
    case "invoice.update":
      return handleInvoiceUpdate(event);
    case "invoice.payment_failed":
      return handleInvoicePaymentFailed(event);
    case "subscription.create":
      return handleSubscriptionCreate(event);
    case "subscription.disable":
    case "subscription.not_renew":
      return handleSubscriptionDisable(event);
    case "refund.processed":
      return handleRefundProcessed(event);
    case "refund.failed":
      return { ok: true, status: "ignored" };
    default:
      return { ok: true, status: "ignored" };
  }
}

/** charge.success — re-verify with Paystack, then fulfill idempotently. */
async function handleChargeSuccess(event: PaystackEvent): Promise<FulfillResult> {
  const reference = event.data?.reference as string | undefined;
  if (!reference) return { ok: false, status: "failed" };
  const data = await verifyTransaction(reference);
  return fulfillTransaction(data);
}

/** charge.failed — mark the pending payment as failed (no membership change). */
async function handleChargeFailed(event: PaystackEvent): Promise<{ ok: boolean; status: string }> {
  const reference = event.data?.reference as string | undefined;
  if (!reference) return { ok: false, status: "failed" };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: payment } = await supabaseAdmin
    .from("payments")
    .select("id, status, metadata, installment_id")
    .eq("reference", reference)
    .maybeSingle();
  if (!payment || payment.status === "succeeded") return { ok: true, status: "skipped" };

  await supabaseAdmin
    .from("payments")
    .update({
      status: "failed",
      metadata: { ...(payment.metadata as object), paystack_status: "failed" },
    })
    .eq("id", payment.id);

  // If this was an installment, flag it so reminders/downgrade can act on it.
  await supabaseAdmin
    .from("payment_installments")
    .update({ status: "overdue" })
    .eq("id", payment.installment_id ?? "00000000-0000-0000-0000-000000000000")
    .in("status", ["active"]);

  return { ok: true, status: "failed" };
}

/** invoice.update — recurring card renewal succeeded/failed for a subscription. */
async function handleInvoiceUpdate(event: PaystackEvent): Promise<{ ok: boolean; status: string }> {
  const d = event.data ?? {};
  const paid = d.paid === true || d.status === "success";
  const reference = d.transaction?.reference as string | undefined;

  // Successful recurring renewal — verify + fulfill to extend the period.
  if (paid && reference) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("payments")
      .select("id")
      .eq("reference", reference)
      .maybeSingle();
    if (existing) {
      const data = await verifyTransaction(reference);
      return fulfillTransaction(data);
    }
    // Renewal charges that we never created a pending row for are acknowledged.
    return { ok: true, status: "ignored" };
  }

  // Failed recurring invoice — flag the subscription as past_due.
  if (!paid) {
    return markSubscriptionPastDue(d.subscription?.subscription_code, d.customer?.email);
  }
  return { ok: true, status: "ignored" };
}

/** invoice.payment_failed — recurring charge could not be collected. */
async function handleInvoicePaymentFailed(
  event: PaystackEvent,
): Promise<{ ok: boolean; status: string }> {
  const d = event.data ?? {};
  return markSubscriptionPastDue(d.subscription?.subscription_code, d.customer?.email);
}

async function markSubscriptionPastDue(
  subscriptionCode?: string,
  email?: string,
): Promise<{ ok: boolean; status: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let query = supabaseAdmin
    .from("subscriptions")
    .update({ status: "past_due" })
    .in("status", ["active", "trialing"]);

  if (subscriptionCode) {
    query = query.eq("provider_subscription_id", subscriptionCode);
  } else {
    const userId = await findUserIdByEmail(email);
    if (!userId) return { ok: true, status: "skipped" };
    query = query.eq("user_id", userId).eq("gateway", "paystack");
  }
  await query;
  return { ok: true, status: "past_due" };
}

/** subscription.create — store the recurring subscription code + authorization. */
async function handleSubscriptionCreate(
  event: PaystackEvent,
): Promise<{ ok: boolean; status: string }> {
  const d = event.data ?? {};
  const subscriptionCode = d.subscription_code as string | undefined;
  const email = d.customer?.email as string | undefined;
  const authCode = d.authorization?.authorization_code as string | undefined;
  const userId = await findUserIdByEmail(email);
  if (!userId || !subscriptionCode) return { ok: true, status: "skipped" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("id, metadata")
    .eq("user_id", userId)
    .eq("gateway", "paystack")
    .in("status", ["active", "trialing", "past_due"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!sub) return { ok: true, status: "skipped" };

  await supabaseAdmin
    .from("subscriptions")
    .update({
      provider_subscription_id: subscriptionCode,
      auto_renew: true,
      cancel_at_period_end: false,
      metadata: {
        ...(sub.metadata as object),
        subscription_code: subscriptionCode,
        authorization_code: authCode ?? null,
        recurring: true,
      },
    })
    .eq("id", sub.id);

  return { ok: true, status: "updated" };
}

/** subscription.disable / not_renew — stop auto-renewal for the subscription. */
async function handleSubscriptionDisable(
  event: PaystackEvent,
): Promise<{ ok: boolean; status: string }> {
  const d = event.data ?? {};
  const subscriptionCode = d.subscription_code as string | undefined;
  const email = d.customer?.email as string | undefined;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let target: SubscriptionTargetRow | null = null;
  if (subscriptionCode) {
    const { data } = await supabaseAdmin
      .from("subscriptions")
      .select("id, current_period_end")
      .eq("provider_subscription_id", subscriptionCode)
      .in("status", ["active", "trialing", "past_due"])
      .maybeSingle();
    target = data as SubscriptionTargetRow | null;
  } else {
    const userId = await findUserIdByEmail(email);
    if (userId) {
      const { data } = await supabaseAdmin
        .from("subscriptions")
        .select("id, current_period_end")
        .eq("user_id", userId)
        .eq("gateway", "paystack")
        .in("status", ["active", "trialing", "past_due"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      target = data as SubscriptionTargetRow | null;
    }
  }
  if (!target) return { ok: true, status: "skipped" };

  // Past its period already → expire now; otherwise keep access until period end.
  const expired = target.current_period_end
    ? new Date(target.current_period_end).getTime() <= Date.now()
    : false;

  await supabaseAdmin
    .from("subscriptions")
    .update({
      auto_renew: false,
      cancel_at_period_end: true,
      status: expired ? "expired" : undefined,
      canceled_at: new Date().toISOString(),
    })
    .eq("id", target.id);

  return { ok: true, status: expired ? "expired" : "canceled" };
}

/** refund.processed — record the refund and downgrade the member to free. */
async function handleRefundProcessed(
  event: PaystackEvent,
): Promise<{ ok: boolean; status: string }> {
  const d = event.data ?? {};
  const reference = (d.transaction?.reference ?? d.transaction_reference) as string | undefined;
  if (!reference) return { ok: true, status: "skipped" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: payment } = await supabaseAdmin
    .from("payments")
    .select("id, user_id, subscription_id, metadata, status")
    .eq("reference", reference)
    .maybeSingle();
  if (!payment) return { ok: true, status: "skipped" };

  // Mark the original payment refunded.
  await supabaseAdmin
    .from("payments")
    .update({
      status: "refunded",
      metadata: {
        ...(payment.metadata as object),
        paystack_status: "refunded",
        refunded_at: new Date().toISOString(),
      },
    })
    .eq("id", payment.id);

  const userId = payment.user_id as string;

  // Expire the related subscription(s) and downgrade the profile to free.
  await supabaseAdmin
    .from("subscriptions")
    .update({
      status: "expired",
      auto_renew: false,
      cancel_at_period_end: true,
      canceled_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("gateway", "paystack")
    .in("status", ["active", "trialing", "past_due"]);

  // If a refund undoes an installment plan, stop it.
  await supabaseAdmin
    .from("payment_installments")
    .update({ status: "canceled" })
    .eq("user_id", userId)
    .in("status", ["active", "past_due"]);

  await supabaseAdmin.from("profiles").update({ membership_tier: "free" }).eq("id", userId);
  const { reverseCommissionForPayment } = await import("@/lib/referrals.functions");
  await reverseCommissionForPayment(payment.id);

  return { ok: true, status: "refunded" };
}

export { invoiceNumber };
