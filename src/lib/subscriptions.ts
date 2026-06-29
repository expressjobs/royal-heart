import type { Database } from "@/integrations/supabase/types";

export type PlanRow = Database["public"]["Tables"]["subscription_plans"]["Row"];
export type SubscriptionRow = Database["public"]["Tables"]["subscriptions"]["Row"];
export type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];
export type CouponRow = Database["public"]["Tables"]["coupons"]["Row"];
export type ProviderRow = Database["public"]["Tables"]["payment_provider_settings"]["Row"];
export type InstallmentRow = Database["public"]["Tables"]["payment_installments"]["Row"];

export type PaymentProvider = "stripe" | "paypal" | "mpesa" | "airtel" | "manual" | "paystack";
export type PaymentGateway = "paystack" | "stripe";

export const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  trialing: "Trial",
  active: "Active",
  past_due: "Payment pending",
  canceled: "Canceled",
  expired: "Expired",
};

export function planFeatures(plan: Pick<PlanRow, "features" | "highlights">): string[] {
  const raw = (plan.highlights ?? plan.features) as unknown;
  if (Array.isArray(raw)) return raw.map((x) => String(x));
  return [];
}

export function isSubscriptionLive(sub: SubscriptionRow | null): boolean {
  if (!sub) return false;
  return sub.status === "active" || sub.status === "trialing";
}
