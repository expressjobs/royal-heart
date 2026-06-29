import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireServerAdmin } from "@/lib/server-auth";

/** Default channels offered at checkout (matches Kenyan Paystack availability). */
const DEFAULT_CHANNELS = ["mobile_money", "card", "bank", "bank_transfer", "apple_pay", "ussd"];

function newReference(): string {
  return `HC-${Date.now()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

function invoiceNumber(): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `INV-${stamp}-${rand}`;
}

/**
 * Start a Paystack checkout for a plan. Creates a pending payment row tagged with
 * HeartConnect branding metadata and returns the hosted checkout URL so the client
 * can redirect the member to pay via M-Pesa, card, Apple Pay, or bank transfer.
 */
export const initPaystackCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { planId: string; origin: string; installments?: number }) =>
    z
      .object({
        planId: z.string().uuid(),
        origin: z.string().url(),
        installments: z.number().int().min(1).max(3).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const email = (context.claims as { email?: string }).email;
    if (!email) throw new Error("Your account has no email address for payment.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { initializeTransaction, brandMetadata } = await import("./paystack.server");

    const { data: plan } = await supabaseAdmin
      .from("subscription_plans")
      .select("*")
      .eq("id", data.planId)
      .eq("is_active", true)
      .maybeSingle();
    if (!plan) throw new Error("Plan not available.");

    // Free plan: downgrade immediately, no Paystack needed.
    if (plan.tier === "free" || plan.price_cents === 0) {
      await supabaseAdmin
        .from("subscriptions")
        .update({
          status: "canceled",
          auto_renew: false,
          cancel_at_period_end: true,
          canceled_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .in("status", ["active", "trialing", "past_due"]);
      await supabaseAdmin.from("profiles").update({ membership_tier: plan.tier }).eq("id", userId);
      return {
        free: true,
        authorizationUrl: null as string | null,
        reference: null as string | null,
      };
    }

    const currency = plan.currency || "KES";

    // Installments are only available for the annual plan; 2 or 3 parts.
    const wantsInstallments = (data.installments ?? 1) > 1;
    const installmentCount =
      plan.billing_interval === "year" ? Math.min(Math.max(data.installments ?? 1, 1), 3) : 1;
    const isInstallment = wantsInstallments && installmentCount > 1;

    // The first installment is the per-installment amount; one-off pays the full price.
    const perInstallment = Math.floor(plan.price_cents / installmentCount);
    const firstAmount = isInstallment ? perInstallment : plan.price_cents;

    let installmentId: string | null = null;
    if (isInstallment) {
      const { data: inst } = await supabaseAdmin
        .from("payment_installments")
        .insert({
          user_id: userId,
          plan_id: plan.id,
          total_installments: installmentCount,
          installments_paid: 0,
          amount_total_cents: plan.price_cents,
          amount_paid_cents: 0,
          installment_amount_cents: perInstallment,
          currency,
          status: "active",
          metadata: brandMetadata(plan.name),
        })
        .select("id")
        .single();
      installmentId = inst?.id ?? null;
    }

    const reference = newReference();
    const metadata = {
      ...brandMetadata(plan.name),
      user_id: userId,
      plan_id: plan.id,
      billing_interval: plan.billing_interval,
      installment_plan: isInstallment,
      installment_number: isInstallment ? 1 : null,
      total_installments: installmentCount,
      // Paystack renders custom_fields on the dashboard / receipt.
      custom_fields: [
        { display_name: "Website", variable_name: "website", value: "HeartConnect" },
        { display_name: "Membership", variable_name: "membership", value: plan.name },
        { display_name: "Domain", variable_name: "domain", value: "royal-heart.com" },
        ...(isInstallment
          ? [
              {
                display_name: "Installment",
                variable_name: "installment",
                value: `1 of ${installmentCount}`,
              },
            ]
          : []),
      ],
    };

    const description = isInstallment
      ? `${plan.name} — installment 1 of ${installmentCount}`
      : plan.name;

    // Record the pending payment up front (idempotency anchor for verify + webhook).
    await supabaseAdmin.from("payments").insert({
      user_id: userId,
      plan_id: plan.id,
      provider: "paystack",
      gateway: "paystack",
      amount_cents: firstAmount,
      currency,
      status: "pending",
      kind: "charge",
      description,
      reference,
      customer_email: email,
      invoice_number: invoiceNumber(),
      installment_id: installmentId,
      installment_number: isInstallment ? 1 : null,
      metadata,
    });

    const init = await initializeTransaction({
      email,
      amountCents: firstAmount,
      currency,
      reference,
      callbackUrl: `${data.origin}/payment-success?reference=${reference}`,
      metadata,
      channels: DEFAULT_CHANNELS,
    });

    return { free: false, authorizationUrl: init.authorization_url, reference };
  });

/**
 * Continue an active installment plan: charge the next installment via Paystack.
 * Returns a hosted-checkout URL for the member to complete the next payment.
 */
export const payNextInstallment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { installmentId: string; origin: string }) =>
    z.object({ installmentId: z.string().uuid(), origin: z.string().url() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const email = (context.claims as { email?: string }).email;
    if (!email) throw new Error("Your account has no email address for payment.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { initializeTransaction, brandMetadata } = await import("./paystack.server");

    const { data: inst } = await supabaseAdmin
      .from("payment_installments")
      .select("*")
      .eq("id", data.installmentId)
      .maybeSingle();
    if (!inst || inst.user_id !== userId) throw new Error("Installment plan not found.");
    if (inst.status === "completed")
      throw new Error("This installment plan is already fully paid.");
    if (inst.installments_paid >= inst.total_installments)
      throw new Error("All installments are paid.");

    // Block duplicate pending charges for the same installment plan.
    const { data: pendingRows } = await supabaseAdmin
      .from("payments")
      .select("id")
      .eq("installment_id", inst.id)
      .eq("status", "pending");
    if (pendingRows && pendingRows.length > 0) {
      throw new Error(
        "You already have a pending installment payment. Complete or cancel it first.",
      );
    }

    if (!inst.plan_id) throw new Error("Plan not available.");
    const { data: plan } = await supabaseAdmin
      .from("subscription_plans")
      .select("*")
      .eq("id", inst.plan_id)
      .maybeSingle();
    if (!plan) throw new Error("Plan not available.");

    const nextNumber = inst.installments_paid + 1;
    const isFinal = nextNumber >= inst.total_installments;
    const currency = inst.currency || "KES";
    // Final installment settles whatever remains so rounding never leaves a balance.
    const amount = isFinal
      ? inst.amount_total_cents - inst.amount_paid_cents
      : inst.installment_amount_cents;

    const reference = newReference();
    const metadata = {
      ...brandMetadata(plan.name),
      user_id: userId,
      plan_id: plan.id,
      billing_interval: plan.billing_interval,
      installment_plan: true,
      installment_number: nextNumber,
      total_installments: inst.total_installments,
      custom_fields: [
        { display_name: "Website", variable_name: "website", value: "HeartConnect" },
        { display_name: "Membership", variable_name: "membership", value: plan.name },
        { display_name: "Domain", variable_name: "domain", value: "royal-heart.com" },
        {
          display_name: "Installment",
          variable_name: "installment",
          value: `${nextNumber} of ${inst.total_installments}`,
        },
      ],
    };

    await supabaseAdmin.from("payments").insert({
      user_id: userId,
      plan_id: plan.id,
      provider: "paystack",
      gateway: "paystack",
      amount_cents: amount,
      currency,
      status: "pending",
      kind: "charge",
      description: `${plan.name} — installment ${nextNumber} of ${inst.total_installments}`,
      reference,
      customer_email: email,
      invoice_number: invoiceNumber(),
      installment_id: inst.id,
      installment_number: nextNumber,
      metadata,
    });

    const init = await initializeTransaction({
      email,
      amountCents: amount,
      currency,
      reference,
      callbackUrl: `${data.origin}/payment-success?reference=${reference}`,
      metadata,
      channels: DEFAULT_CHANNELS,
    });

    return { authorizationUrl: init.authorization_url, reference };
  });

/**
 * Verify a Paystack transaction after redirect and activate the membership.
 * Idempotent — safe to call alongside the webhook.
 */
export const verifyPaystackCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { reference: string }) =>
    z.object({ reference: z.string().trim().min(4).max(120) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifyTransaction, fulfillTransaction } = await import("./paystack.server");

    // Ensure the reference belongs to this member.
    const { data: payment } = await supabaseAdmin
      .from("payments")
      .select("user_id, status, payment_method, period_end, description")
      .eq("reference", data.reference)
      .maybeSingle();
    if (!payment || payment.user_id !== context.userId) {
      throw new Error("Transaction not found.");
    }

    const verifyData = await verifyTransaction(data.reference);
    const result = await fulfillTransaction(verifyData);
    return result;
  });

interface AdminTransaction {
  id: string;
  created_at: string;
  user_id: string;
  member: string;
  email: string | null;
  plan: string | null;
  amount_cents: number;
  currency: string;
  reference: string | null;
  payment_method: string | null;
  status: string;
  website: string;
}

/** Admin: full transaction ledger with HeartConnect branding for each row. */
export const listPaystackTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminTransaction[]> => {
    await requireServerAdmin(context.supabase, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: pays } = await supabaseAdmin
      .from("payments")
      .select(
        "id, created_at, user_id, description, amount_cents, currency, reference, payment_method, status, customer_email, metadata",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    const rows = pays ?? [];

    const ids = [...new Set(rows.map((r) => r.user_id))];
    const nameMap: Record<string, string> = {};
    if (ids.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, display_name")
        .in("id", ids);
      (profs ?? []).forEach((p) => {
        nameMap[p.id] = p.display_name ?? "Member";
      });
    }

    return rows.map((r) => ({
      id: r.id,
      created_at: r.created_at,
      user_id: r.user_id,
      member: nameMap[r.user_id] ?? "Member",
      email: r.customer_email ?? null,
      plan: r.description ?? null,
      amount_cents: r.amount_cents,
      currency: r.currency,
      reference: r.reference ?? null,
      payment_method: r.payment_method ?? null,
      status: r.status,
      website: (r.metadata as { website?: string } | null)?.website ?? "HeartConnect",
    }));
  });
