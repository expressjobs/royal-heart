import { useEffect, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { refundPayment } from "@/lib/subscriptions.functions";
import { formatPrice, TIER_LABELS, type MembershipTier } from "@/lib/membership";
import type { PaymentRow, SubscriptionRow } from "@/lib/subscriptions";
import { PanelLoader } from "@/components/admin/shared";
import { Button } from "@/components/ui/button";

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function SubscriberList() {
  const runRefund = useServerFn(refundPayment);
  const [subs, setSubs] = useState<SubscriptionRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const [{ data: subRows, error: subError }, { data: payRows, error: payError }] =
      await Promise.all([
        supabase
          .from("subscriptions")
          .select("*")
          .in("status", ["active", "trialing", "past_due"])
          .order("created_at", { ascending: false }),
        supabase.from("payments").select("*").order("created_at", { ascending: false }).limit(50),
      ]);
    if (subError || payError) {
      toast.error(subError?.message ?? payError?.message ?? "Could not load subscriptions.");
      setLoading(false);
      return;
    }
    const s = (subRows ?? []) as SubscriptionRow[];
    const p = (payRows ?? []) as PaymentRow[];
    setSubs(s);
    setPayments(p);
    const ids = [...new Set([...s.map((x) => x.user_id), ...p.map((x) => x.user_id)])];
    if (ids.length) {
      const { data: profs, error: profileError } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", ids);
      if (profileError) {
        toast.error(profileError.message);
      }
      const map: Record<string, string> = {};
      (profs ?? []).forEach((pr) => {
        map[pr.id] = pr.display_name ?? "Member";
      });
      setNames(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const refund = async (pay: PaymentRow) => {
    if (
      !confirm(
        `Refund ${formatPrice(pay.amount_cents, pay.currency)} and downgrade member to Free?`,
      )
    )
      return;
    setBusy(pay.id);
    try {
      const result = await runRefund({ data: { paymentId: pay.id, downgrade: true } });
      if (!result.ok) {
        const detail = [
          result.message || result.error,
          result.stage ? `Stage: ${result.stage}` : null,
          result.code ? `Code: ${result.code}` : null,
          result.details ? `Details: ${result.details}` : null,
          result.hint ? `Hint: ${result.hint}` : null,
        ]
          .filter(Boolean)
          .join(" | ");
        toast.error(detail || "Refund failed.");
        return;
      }
      toast.success("Payment refunded.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Refund failed.");
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <PanelLoader />;

  return (
    <div className="space-y-8">
      <div>
        <h3 className="mb-3 font-semibold">Active subscribers ({subs.length})</h3>
        {subs.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No active subscribers yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="p-3 font-medium">Member</th>
                  <th className="p-3 font-medium">Plan</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium">Renews / ends</th>
                  <th className="p-3 font-medium">Provider</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => (
                  <tr key={s.id} className="border-b border-border/50 last:border-0">
                    <td className="p-3">{names[s.user_id] ?? "Member"}</td>
                    <td className="p-3">{TIER_LABELS[s.tier as MembershipTier]}</td>
                    <td className="p-3 capitalize">{s.status}</td>
                    <td className="p-3 whitespace-nowrap">{formatDate(s.current_period_end)}</td>
                    <td className="p-3 capitalize">{s.provider}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-3 font-semibold">Recent transactions</h3>
        {payments.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No transactions yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="p-3 font-medium">Date</th>
                  <th className="p-3 font-medium">Member</th>
                  <th className="p-3 font-medium">Amount</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium">Invoice</th>
                  <th className="p-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-border/50 last:border-0">
                    <td className="p-3 whitespace-nowrap">{formatDate(p.created_at)}</td>
                    <td className="p-3">{names[p.user_id] ?? "Member"}</td>
                    <td className="p-3 tabular-nums">{formatPrice(p.amount_cents, p.currency)}</td>
                    <td className="p-3 capitalize">{p.status}</td>
                    <td className="p-3 font-mono text-xs">{p.invoice_number ?? "—"}</td>
                    <td className="p-3">
                      {p.kind === "charge" && p.status === "succeeded" && p.amount_cents > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 px-2 text-xs text-destructive"
                          onClick={() => refund(p)}
                          disabled={busy === p.id}
                        >
                          {busy === p.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="h-3.5 w-3.5" />
                          )}
                          Refund
                        </Button>
                      )}
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
