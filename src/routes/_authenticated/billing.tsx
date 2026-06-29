import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Loader2,
  Receipt,
  CalendarClock,
  RefreshCw,
  XCircle,
  Download,
  Crown,
  CreditCard,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import {
  cancelMySubscription,
  resumeMySubscription,
  setAutoRenew,
  reconcileMySubscription,
} from "@/lib/subscriptions.functions";
import { payNextInstallment } from "@/lib/paystack.functions";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { formatPrice, TIER_LABELS, type MembershipTier } from "@/lib/membership";
import {
  SUBSCRIPTION_STATUS_LABELS,
  type SubscriptionRow,
  type PaymentRow,
  type PlanRow,
  type InstallmentRow,
} from "@/lib/subscriptions";
import { downloadInvoice } from "@/lib/invoice";

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({ meta: [{ title: "Billing — HeartConnect" }] }),
  component: () => (
    <AppShell>
      <Billing />
    </AppShell>
  ),
});

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function Billing() {
  const { profile, refreshProfile } = useAuth();
  const reconcile = useServerFn(reconcileMySubscription);
  const cancelFn = useServerFn(cancelMySubscription);
  const resumeFn = useServerFn(resumeMySubscription);
  const autoRenewFn = useServerFn(setAutoRenew);
  const payNext = useServerFn(payNextInstallment);

  const [sub, setSub] = useState<SubscriptionRow | null>(null);
  const [plan, setPlan] = useState<PlanRow | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [installments, setInstallments] = useState<InstallmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [{ data: subRows }, { data: payRows }, { data: instRows }] = await Promise.all([
      supabase.from("subscriptions").select("*").order("created_at", { ascending: false }).limit(1),
      supabase.from("payments").select("*").order("created_at", { ascending: false }),
      supabase.from("payment_installments").select("*").order("created_at", { ascending: false }),
    ]);
    const s = ((subRows ?? [])[0] as SubscriptionRow) ?? null;
    setSub(s);
    setPayments((payRows ?? []) as PaymentRow[]);
    setInstallments((instRows ?? []) as InstallmentRow[]);
    if (s?.plan_id) {
      const { data: p } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("id", s.plan_id)
        .maybeSingle();
      setPlan((p as PlanRow) ?? null);
    } else {
      setPlan(null);
    }
    setLoading(false);
  };

  const handlePayNext = async (id: string) => {
    setBusy(true);
    try {
      const res = await payNext({ data: { installmentId: id, origin: window.location.origin } });
      if (res.authorizationUrl) {
        toast.message("Redirecting to secure checkout…");
        window.location.href = res.authorizationUrl;
        return;
      }
      throw new Error("Could not start checkout.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start the next installment.");
      setBusy(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await reconcile({});
        if (res?.changed) await refreshProfile();
      } catch {
        /* non-fatal */
      }
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tier = (profile?.membership_tier ?? "free") as MembershipTier;
  const live = sub && (sub.status === "active" || sub.status === "trialing");

  const handleCancel = async () => {
    setBusy(true);
    try {
      await cancelFn({});
      toast.success("Subscription will end at the end of your billing period.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to cancel.");
    } finally {
      setBusy(false);
    }
  };

  const handleResume = async () => {
    setBusy(true);
    try {
      await resumeFn({});
      toast.success("Subscription resumed.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to resume.");
    } finally {
      setBusy(false);
    }
  };

  const handleAutoRenew = async (value: boolean) => {
    setBusy(true);
    try {
      await autoRenewFn({ data: { autoRenew: value } });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="grid h-[50vh] place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Billing</h1>
        <p className="text-sm text-muted-foreground">
          Manage your membership, renewals, and invoices.
        </p>
      </div>

      {/* Current plan */}
      <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent text-accent-foreground">
              <Crown className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg font-semibold">{TIER_LABELS[tier]} Member</h2>
                {sub && (
                  <Badge variant={live ? "default" : "secondary"}>
                    {SUBSCRIPTION_STATUS_LABELS[sub.status] ?? sub.status}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {plan
                  ? `${formatPrice(plan.price_cents, plan.currency)} / ${plan.billing_interval}`
                  : "No active paid plan"}
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm" className="rounded-xl">
            <Link to="/premium" search={{ plan: undefined, period: undefined }}>
              {tier === "free" ? "View plans" : "Change plan"}
            </Link>
          </Button>
        </div>

        {sub && live && (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-border/70 p-4">
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarClock className="h-3.5 w-3.5" />
                {sub.cancel_at_period_end ? "Access ends" : "Renews on"}
              </p>
              <p className="mt-1 font-medium">{formatDate(sub.current_period_end)}</p>
              {sub.trial_end && new Date(sub.trial_end) > new Date() && (
                <p className="mt-1 text-xs text-success">Trial ends {formatDate(sub.trial_end)}</p>
              )}
            </div>
            <div className="rounded-2xl border border-border/70 p-4">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <RefreshCw className="h-4 w-4" /> Auto-renew
                </p>
                <Switch
                  checked={sub.auto_renew && !sub.cancel_at_period_end}
                  disabled={busy || sub.cancel_at_period_end}
                  onCheckedChange={handleAutoRenew}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {sub.cancel_at_period_end
                  ? "Your plan is set to cancel."
                  : sub.auto_renew
                    ? "Your plan renews automatically."
                    : "Your plan will not renew."}
              </p>
            </div>
          </div>
        )}

        {sub && live && (
          <div className="mt-4 flex flex-wrap gap-2">
            {sub.cancel_at_period_end ? (
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={handleResume}
                disabled={busy}
              >
                Resume subscription
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="rounded-xl text-destructive hover:text-destructive"
                onClick={handleCancel}
                disabled={busy}
              >
                <XCircle className="mr-1.5 h-4 w-4" /> Cancel subscription
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Installment plans */}
      {installments.length > 0 && (
        <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
          <h2 className="mb-4 flex items-center gap-2 font-semibold">
            <CreditCard className="h-4 w-4" /> Installment plans
          </h2>
          <div className="space-y-4">
            {installments.map((inst) => {
              const remaining = Math.max(0, inst.amount_total_cents - inst.amount_paid_cents);
              const pct = Math.round((inst.installments_paid / inst.total_installments) * 100);
              const canPay = inst.status === "active" || inst.status === "overdue";
              const done = inst.status === "completed";
              return (
                <div key={inst.id} className="rounded-2xl border border-border/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        Gold Annual — {inst.total_installments} installments
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {inst.installments_paid} of {inst.total_installments} paid ·{" "}
                        {formatPrice(inst.amount_paid_cents, inst.currency)} paid ·{" "}
                        {formatPrice(remaining, inst.currency)} remaining
                      </p>
                    </div>
                    <Badge
                      variant={
                        done ? "default" : inst.status === "overdue" ? "destructive" : "secondary"
                      }
                    >
                      {done ? "Completed" : inst.status === "overdue" ? "Overdue" : "In progress"}
                    </Badge>
                  </div>

                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {!done && (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        {inst.next_due_at
                          ? `Next payment due ${formatDate(inst.next_due_at)}`
                          : "Next installment ready"}
                        {inst.status === "overdue" && " · pay now to restore Gold"}
                      </p>
                      {canPay && (
                        <Button
                          size="sm"
                          className="rounded-xl"
                          disabled={busy}
                          onClick={() => handlePayNext(inst.id)}
                        >
                          Pay next installment (
                          {formatPrice(inst.installment_amount_cents, inst.currency)})
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Payment history */}
      <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
        <h2 className="mb-4 flex items-center gap-2 font-semibold">
          <Receipt className="h-4 w-4" /> Payment history
        </h2>
        {payments.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No payments yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Date</th>
                  <th className="py-2 pr-3 font-medium">Description</th>
                  <th className="py-2 pr-3 font-medium">Amount</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 font-medium">Invoice</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-border/50 last:border-0">
                    <td className="py-2.5 pr-3 whitespace-nowrap">{formatDate(p.created_at)}</td>
                    <td className="py-2.5 pr-3">{p.description ?? "Payment"}</td>
                    <td className="py-2.5 pr-3 tabular-nums">
                      {formatPrice(p.amount_cents, p.currency)}
                    </td>
                    <td className="py-2.5 pr-3">
                      <StatusPill status={p.status} />
                    </td>
                    <td className="py-2.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 px-2 text-xs"
                        onClick={() => downloadInvoice(p, profile?.display_name ?? null)}
                      >
                        <Download className="h-3.5 w-3.5" /> {p.invoice_number ?? "Receipt"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    succeeded: "bg-success/10 text-success",
    pending: "bg-amber-500/10 text-amber-600",
    failed: "bg-destructive/10 text-destructive",
    refunded: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${map[status] ?? "bg-muted text-muted-foreground"}`}
    >
      {status}
    </span>
  );
}
