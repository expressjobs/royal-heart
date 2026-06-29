import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireServerAdmin } from "@/lib/server-auth";
import { structuredAdminError, type StructuredAdminError } from "@/lib/admin-errors";

const PROVIDERS = ["stripe", "paypal", "mpesa", "airtel", "manual"] as const;

/** Safe list of payment providers for the checkout UI (no config / secrets exposed). */
export const listEnabledProviders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("payment_provider_settings")
      .select("provider, display_name, is_enabled, sort_order")
      .order("sort_order");
    return (data ?? []) as {
      provider: string;
      display_name: string;
      is_enabled: boolean;
      sort_order: number;
    }[];
  });

function addInterval(from: Date, interval: string, count: number): Date {
  const d = new Date(from);
  switch (interval) {
    case "day":
      d.setDate(d.getDate() + count);
      break;
    case "week":
      d.setDate(d.getDate() + 7 * count);
      break;
    case "month":
      d.setMonth(d.getMonth() + count);
      break;
    case "quarter":
      d.setMonth(d.getMonth() + 3 * count);
      break;
    case "year":
      d.setFullYear(d.getFullYear() + count);
      break;
    default:
      d.setMonth(d.getMonth() + count);
  }
  return d;
}

function invoiceNumber(): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `INV-${stamp}-${rand}`;
}

interface CouponRow {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  max_redemptions: number | null;
  times_redeemed: number;
  plan_id: string | null;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
}

function evalCoupon(
  coupon: CouponRow | null,
  planId: string,
  priceCents: number,
): { valid: boolean; message: string; discountCents: number } {
  if (!coupon) return { valid: false, message: "Coupon not found.", discountCents: 0 };
  if (!coupon.is_active)
    return { valid: false, message: "This coupon is no longer active.", discountCents: 0 };
  const now = Date.now();
  if (coupon.valid_from && new Date(coupon.valid_from).getTime() > now)
    return { valid: false, message: "This coupon is not active yet.", discountCents: 0 };
  if (coupon.valid_until && new Date(coupon.valid_until).getTime() < now)
    return { valid: false, message: "This coupon has expired.", discountCents: 0 };
  if (coupon.max_redemptions != null && coupon.times_redeemed >= coupon.max_redemptions)
    return { valid: false, message: "This coupon has reached its usage limit.", discountCents: 0 };
  if (coupon.plan_id && coupon.plan_id !== planId)
    return {
      valid: false,
      message: "This coupon does not apply to the selected plan.",
      discountCents: 0,
    };

  let discount = 0;
  if (coupon.discount_type === "percent") {
    discount = Math.round((priceCents * Number(coupon.discount_value)) / 100);
  } else {
    discount = Math.round(Number(coupon.discount_value) * 100);
  }
  discount = Math.max(0, Math.min(discount, priceCents));
  return { valid: true, message: "Coupon applied.", discountCents: discount };
}

/** Preview a coupon's effect on a plan price (server-validated, never trusts the client). */
export const validateCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string; planId: string }) =>
    z.object({ code: z.string().trim().min(1).max(60), planId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: plan } = await supabaseAdmin
      .from("subscription_plans")
      .select("price_cents, currency")
      .eq("id", data.planId)
      .maybeSingle();
    if (!plan) return { valid: false, message: "Plan not found.", discountCents: 0, finalCents: 0 };

    const { data: coupon } = await supabaseAdmin
      .from("coupons")
      .select("*")
      .ilike("code", data.code.trim())
      .maybeSingle();

    const res = evalCoupon(coupon as CouponRow | null, data.planId, plan.price_cents);
    return {
      valid: res.valid,
      message: res.message,
      discountCents: res.discountCents,
      finalCents: Math.max(0, plan.price_cents - res.discountCents),
    };
  });

/**
 * Create / change a subscription. Runs server-side with the service role so it can
 * apply the membership tier (which members cannot change themselves). Stripe is the
 * active gateway in test mode; other providers are recorded as pending until connected.
 */
export const checkoutSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { planId: string; provider: string; couponCode?: string | null }) =>
    z
      .object({
        planId: z.string().uuid(),
        provider: z.enum(PROVIDERS),
        couponCode: z.string().trim().max(60).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: plan, error: planErr } = await supabaseAdmin
      .from("subscription_plans")
      .select("*")
      .eq("id", data.planId)
      .eq("is_active", true)
      .maybeSingle();
    if (planErr || !plan) throw new Error("Plan not available.");

    // Downgrade to Free: clear any active subscription, set tier free.
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
      return { ok: true, status: "active", tier: plan.tier, requiresExternalPayment: false };
    }

    // Determine provider availability.
    const { data: providerRow } = await supabaseAdmin
      .from("payment_provider_settings")
      .select("is_enabled")
      .eq("provider", data.provider)
      .maybeSingle();
    const providerEnabled = data.provider === "manual" ? false : (providerRow?.is_enabled ?? false);

    // Validate coupon server-side.
    let discountCents = 0;
    let appliedCode: string | null = null;
    if (data.couponCode && data.couponCode.trim()) {
      const { data: coupon } = await supabaseAdmin
        .from("coupons")
        .select("*")
        .ilike("code", data.couponCode.trim())
        .maybeSingle();
      const res = evalCoupon(coupon as CouponRow | null, data.planId, plan.price_cents);
      if (!res.valid) throw new Error(res.message);
      discountCents = res.discountCents;
      appliedCode = (coupon as CouponRow).code;
      await supabaseAdmin
        .from("coupons")
        .update({ times_redeemed: (coupon as CouponRow).times_redeemed + 1 })
        .eq("id", (coupon as CouponRow).id);
    }

    const amountCents = Math.max(0, plan.price_cents - discountCents);
    const now = new Date();
    const trialing = plan.trial_days > 0;
    const trialEnd = trialing ? new Date(now.getTime() + plan.trial_days * 86400000) : null;
    const periodEnd = trialing
      ? trialEnd!
      : addInterval(now, plan.billing_interval, plan.interval_count);

    // Cancel previous active subscriptions for a clean switch.
    await supabaseAdmin
      .from("subscriptions")
      .update({ status: "canceled", canceled_at: now.toISOString() })
      .eq("user_id", userId)
      .in("status", ["active", "trialing", "past_due"]);

    // Never activate a paid plan without a verified payment. Only free trials and
    // zero-cost plans activate immediately; real charges go through Paystack
    // checkout (initPaystackCheckout) and activate on verified payment / webhook.
    const activateNow = trialing || amountCents === 0;
    const subStatus = trialing ? "trialing" : activateNow ? "active" : "past_due";

    const { data: sub, error: subErr } = await supabaseAdmin
      .from("subscriptions")
      .insert({
        user_id: userId,
        plan_id: plan.id,
        tier: plan.tier,
        status: subStatus,
        provider: data.provider,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        trial_end: trialEnd?.toISOString() ?? null,
        auto_renew: true,
        cancel_at_period_end: false,
      })
      .select("id")
      .single();
    if (subErr || !sub) throw new Error("Could not create subscription.");

    // Record the payment / invoice.
    const paymentStatus =
      activateNow && amountCents > 0 ? "succeeded" : amountCents === 0 ? "succeeded" : "pending";
    await supabaseAdmin.from("payments").insert({
      user_id: userId,
      subscription_id: sub.id,
      plan_id: plan.id,
      provider: data.provider,
      amount_cents: amountCents,
      currency: plan.currency,
      status: paymentStatus,
      kind: "charge",
      description: `${plan.name} — ${plan.billing_interval}`,
      coupon_code: appliedCode,
      invoice_number: invoiceNumber(),
      period_start: now.toISOString(),
      period_end: periodEnd.toISOString(),
    });

    // Apply the membership tier when the subscription is live.
    if (subStatus === "active" || subStatus === "trialing") {
      await supabaseAdmin.from("profiles").update({ membership_tier: plan.tier }).eq("id", userId);
    }

    return {
      ok: true,
      status: subStatus,
      tier: plan.tier,
      requiresExternalPayment: !activateNow,
      providerEnabled,
    };
  });

/** Member cancels their own subscription (stays active until the period ends). */
export const cancelMySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("subscriptions")
      .update({
        cancel_at_period_end: true,
        auto_renew: false,
        canceled_at: new Date().toISOString(),
      })
      .eq("user_id", context.userId)
      .in("status", ["active", "trialing", "past_due"]);
    if (error) throw new Error("Could not cancel subscription.");
    return { ok: true };
  });

/** Member resumes a subscription they had scheduled for cancellation. */
export const resumeMySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("subscriptions")
      .update({ cancel_at_period_end: false, auto_renew: true, canceled_at: null })
      .eq("user_id", context.userId)
      .in("status", ["active", "trialing", "past_due"]);
    if (error) throw new Error("Could not resume subscription.");
    return { ok: true };
  });

/** Toggle auto-renew on the member's own subscription. */
export const setAutoRenew = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { autoRenew: boolean }) => z.object({ autoRenew: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("subscriptions")
      .update({ auto_renew: data.autoRenew })
      .eq("user_id", context.userId)
      .in("status", ["active", "trialing", "past_due"]);
    if (error) throw new Error("Could not update auto-renew.");
    return { ok: true };
  });

/** Expire the member's subscription if its period has ended; downgrade to Free. */
export const reconcileMySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date();

    // Installment overdue: if the next installment is past due, downgrade to Free
    // and flag the plan overdue until the member resumes payment.
    const { data: inst } = await supabaseAdmin
      .from("payment_installments")
      .select("id, next_due_at, status")
      .eq("user_id", context.userId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (inst && inst.next_due_at && new Date(inst.next_due_at).getTime() < now.getTime()) {
      await supabaseAdmin
        .from("payment_installments")
        .update({ status: "overdue" })
        .eq("id", inst.id);
      await supabaseAdmin
        .from("subscriptions")
        .update({ status: "past_due" })
        .eq("user_id", context.userId)
        .in("status", ["active", "trialing"]);
      await supabaseAdmin
        .from("profiles")
        .update({ membership_tier: "free" })
        .eq("id", context.userId);
      return { changed: true, tier: "free" };
    }

    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("id, current_period_end, status, cancel_at_period_end")
      .eq("user_id", context.userId)
      .in("status", ["active", "trialing", "past_due"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!sub) return { changed: false };
    const ended =
      sub.current_period_end && new Date(sub.current_period_end).getTime() < now.getTime();
    if (ended && sub.cancel_at_period_end) {
      await supabaseAdmin.from("subscriptions").update({ status: "expired" }).eq("id", sub.id);
      await supabaseAdmin
        .from("profiles")
        .update({ membership_tier: "free" })
        .eq("id", context.userId);
      return { changed: true, tier: "free" };
    }
    return { changed: false };
  });

/** Admin: refund a payment and (optionally) downgrade the member. */
export const refundPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { paymentId: string; downgrade?: boolean }) =>
    z.object({ paymentId: z.string().uuid(), downgrade: z.boolean().optional() }).parse(d),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{ ok: true } | ({ ok: false; error: string } & StructuredAdminError)> => {
      try {
        await requireServerAdmin(context.supabase, context.userId);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: pay, error: loadError } = await supabaseAdmin
          .from("payments")
          .select("*")
          .eq("id", data.paymentId)
          .maybeSingle();
        if (loadError) throw structuredAdminError(loadError, "payment.load");
        if (!pay) throw structuredAdminError(new Error("Payment not found."), "payment.load");
        if (pay.status === "refunded") {
          throw structuredAdminError(new Error("Payment already refunded."), "payment.validate");
        }

        const { error: updatePaymentError } = await supabaseAdmin
          .from("payments")
          .update({ status: "refunded" })
          .eq("id", pay.id);
        if (updatePaymentError) throw structuredAdminError(updatePaymentError, "payment.refund");
        const { error: insertRefundError } = await supabaseAdmin.from("payments").insert({
          user_id: pay.user_id,
          subscription_id: pay.subscription_id,
          plan_id: pay.plan_id,
          provider: pay.provider,
          amount_cents: -Math.abs(pay.amount_cents),
          currency: pay.currency,
          status: "refunded",
          kind: "refund",
          description: `Refund for ${pay.invoice_number ?? pay.id}`,
          invoice_number: invoiceNumber(),
        });
        if (insertRefundError) throw structuredAdminError(insertRefundError, "refund.insert");

        if (data.downgrade) {
          if (pay.subscription_id) {
            const { error: cancelSubscriptionError } = await supabaseAdmin
              .from("subscriptions")
              .update({ status: "canceled", canceled_at: new Date().toISOString() })
              .eq("id", pay.subscription_id);
            if (cancelSubscriptionError) {
              throw structuredAdminError(cancelSubscriptionError, "subscription.cancel");
            }
          }
          const { error: downgradeError } = await supabaseAdmin
            .from("profiles")
            .update({ membership_tier: "free" })
            .eq("id", pay.user_id);
          if (downgradeError) throw structuredAdminError(downgradeError, "profile.downgrade");
        }
        return { ok: true };
      } catch (error) {
        const structured = structuredAdminError(error, "payment.refund", "Refund failed.");
        return { ok: false, ...structured, error: structured.message };
      }
    },
  );
