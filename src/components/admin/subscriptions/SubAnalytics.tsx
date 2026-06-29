import { useEffect, useMemo, useState } from "react";
import { CreditCard, TrendingUp, Users, Wallet, RotateCcw } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { TIER_COLORS, TIER_LABELS, formatPrice, type MembershipTier } from "@/lib/membership";
import { PanelLoader, StatCard } from "@/components/admin/shared";

interface SubLite {
  status: string;
  tier: MembershipTier;
  plan: { price_cents: number; billing_interval: string; interval_count: number } | null;
}
interface PayLite {
  amount_cents: number;
  status: string;
  kind: string;
  created_at: string;
}

const INTERVAL_MONTHS: Record<string, number> = {
  day: 1 / 30,
  week: 7 / 30,
  month: 1,
  quarter: 3,
  year: 12,
};

function monthlyValue(p: {
  price_cents: number;
  billing_interval: string;
  interval_count: number;
}): number {
  const months = (INTERVAL_MONTHS[p.billing_interval] ?? 1) * Math.max(1, p.interval_count);
  return p.price_cents / 100 / months;
}

export function SubAnalytics() {
  const [subs, setSubs] = useState<SubLite[]>([]);
  const [pays, setPays] = useState<PayLite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: subRows }, { data: payRows }] = await Promise.all([
        supabase
          .from("subscriptions")
          .select(
            "status, tier, plan:subscription_plans(price_cents, billing_interval, interval_count)",
          ),
        supabase.from("payments").select("amount_cents, status, kind, created_at"),
      ]);
      setSubs((subRows ?? []) as unknown as SubLite[]);
      setPays((payRows ?? []) as PayLite[]);
      setLoading(false);
    })();
  }, []);

  const stats = useMemo(() => {
    const activeSubs = subs.filter((s) => s.status === "active" || s.status === "trialing");
    let mrr = 0;
    const byTier: Record<string, number> = {};
    activeSubs.forEach((s) => {
      if (s.plan) mrr += monthlyValue(s.plan);
      byTier[s.tier] = (byTier[s.tier] ?? 0) + 1;
    });
    const succeeded = pays.filter((p) => p.status === "succeeded" && p.kind === "charge");
    const refunds = pays.filter((p) => p.status === "refunded" && p.kind === "refund");
    const grossCents = succeeded.reduce((a, p) => a + p.amount_cents, 0);
    const refundCents = refunds.reduce((a, p) => a + Math.abs(p.amount_cents), 0);

    const now = Date.now();
    const last30 = succeeded
      .filter((p) => now - new Date(p.created_at).getTime() < 30 * 86400000)
      .reduce((a, p) => a + p.amount_cents, 0);

    const tierData = (["gold", "platinum"] as MembershipTier[])
      .map((t) => ({ name: TIER_LABELS[t], tier: t, count: byTier[t] ?? 0 }))
      .filter((d) => d.count > 0);

    return {
      mrr,
      arr: mrr * 12,
      active: activeSubs.length,
      grossCents,
      refundCents,
      netCents: grossCents - refundCents,
      last30,
      tierData,
    };
  }, [subs, pays]);

  if (loading) return <PanelLoader />;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={TrendingUp}
          label="Monthly recurring (MRR)"
          value={`$${stats.mrr.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          accent="gold"
        />
        <StatCard
          icon={Wallet}
          label="Annual run-rate (ARR)"
          value={`$${stats.arr.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          accent="gold"
        />
        <StatCard icon={Users} label="Active subscribers" value={stats.active} accent="platinum" />
        <StatCard
          icon={CreditCard}
          label="Revenue (30d)"
          value={formatPrice(stats.last30)}
          accent="primary"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={Wallet} label="Gross collected" value={formatPrice(stats.grossCents)} />
        <StatCard
          icon={RotateCcw}
          label="Refunded"
          value={formatPrice(stats.refundCents)}
          accent="destructive"
        />
        <StatCard
          icon={TrendingUp}
          label="Net revenue"
          value={formatPrice(stats.netCents)}
          accent="gold"
        />
      </div>

      <div className="rounded-3xl border border-border bg-card p-5">
        <h3 className="mb-4 font-semibold">Active subscribers by plan</h3>
        {stats.tierData.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No active subscribers yet.
          </p>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.tierData} margin={{ left: -10, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted))" }}
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {stats.tierData.map((d) => (
                    <Cell key={d.tier} fill={TIER_COLORS[d.tier]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
