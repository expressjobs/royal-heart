import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BadgeCheck,
  Bot,
  Flag,
  Heart,
  MessageSquare,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { TIER_COLORS, TIER_LABELS, TIER_PRICE, type MembershipTier } from "@/lib/membership";
import { LocationHeatmap } from "@/components/admin/LocationHeatmap";
import { EmptyState, PanelLoader, StatCard } from "@/components/admin/shared";

interface ProfileLite {
  membership_tier: MembershipTier;
  is_verified: boolean;
  is_featured: boolean;
  created_at: string;
  last_active: string;
  location_country: string | null;
  is_demo_profile: boolean;
}

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function AdminOverview() {
  const [profiles, setProfiles] = useState<ProfileLite[]>([]);
  const [counts, setCounts] = useState({ matches: 0, messages: 0, reports: 0, pending: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: profs }, { count: matches }, { count: messages }, { data: reportRows }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select(
              "membership_tier, is_verified, is_featured, created_at, last_active, location_country, is_demo_profile",
            ),
          supabase.from("matches").select("id", { count: "exact", head: true }),
          supabase.from("messages").select("id", { count: "exact", head: true }),
          supabase.from("reports").select("status"),
        ]);
      setProfiles((profs ?? []) as ProfileLite[]);
      setCounts({
        matches: matches ?? 0,
        messages: messages ?? 0,
        reports: reportRows?.length ?? 0,
        pending: (reportRows ?? []).filter((r) => r.status === "pending").length,
      });
      setLoading(false);
    })();
  }, []);

  const metrics = useMemo(() => {
    // Official statistics count REAL registered members only. Demo profiles are
    // tracked separately and never mixed into real user numbers.
    const real = profiles.filter((p) => !p.is_demo_profile);
    const demoCount = profiles.length - real.length;
    const total = real.length;
    const verified = real.filter((p) => p.is_verified).length;
    const tierCounts: Record<MembershipTier, number> = {
      free: 0,
      premium: 0,
      gold: 0,
      platinum: 0,
    };
    real.forEach((p) => {
      tierCounts[p.membership_tier] = (tierCounts[p.membership_tier] ?? 0) + 1;
    });
    const mrr =
      tierCounts.premium * TIER_PRICE.premium +
      tierCounts.gold * TIER_PRICE.gold +
      tierCounts.platinum * TIER_PRICE.platinum;
    const now = Date.now();
    const activeWeek = real.filter(
      (p) => now - new Date(p.last_active).getTime() < 7 * 86400000,
    ).length;
    const new7 = real.filter((p) => now - new Date(p.created_at).getTime() < 7 * 86400000).length;

    // Signups over last 30 days
    const days: { date: string; signups: number }[] = [];
    const byDay = new Map<string, number>();
    real.forEach((p) => {
      const k = dayKey(new Date(p.created_at));
      byDay.set(k, (byDay.get(k) ?? 0) + 1);
    });
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * 86400000);
      const k = dayKey(d);
      days.push({
        date: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        signups: byDay.get(k) ?? 0,
      });
    }

    const tierData = (["free", "gold", "platinum"] as MembershipTier[])
      .map((t) => ({
        name: TIER_LABELS[t],
        tier: t,
        value: t === "gold" ? tierCounts.gold + tierCounts.premium : tierCounts[t],
      }))
      .filter((d) => d.value > 0);

    const byCountry = new Map<string, number>();
    real.forEach((p) => {
      const c = p.location_country || "Unknown";
      byCountry.set(c, (byCountry.get(c) ?? 0) + 1);
    });
    const topCountries = [...byCountry.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({ name, value }));

    return {
      total,
      verified,
      tierCounts,
      mrr,
      activeWeek,
      new7,
      days,
      tierData,
      topCountries,
      demoCount,
    };
  }, [profiles]);

  if (loading) return <PanelLoader />;

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label="Total members"
          value={metrics.total}
          hint={`${metrics.new7} new this week`}
        />
        <StatCard icon={Activity} label="Active (7d)" value={metrics.activeWeek} accent="primary" />
        <StatCard icon={Heart} label="Matches" value={counts.matches} />
        <StatCard icon={MessageSquare} label="Messages" value={counts.messages} />
        <StatCard
          icon={BadgeCheck}
          label="Verified members"
          value={metrics.verified}
          accent="platinum"
        />
        <StatCard
          icon={TrendingUp}
          label="Est. monthly revenue"
          value={`$${metrics.mrr.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          accent="gold"
          hint={`${metrics.tierCounts.gold + metrics.tierCounts.platinum} paid members`}
        />
        <StatCard
          icon={Sparkles}
          label="Gold + Platinum"
          value={metrics.tierCounts.gold + metrics.tierCounts.platinum}
          accent="gold"
        />
        <StatCard icon={Flag} label="Pending reports" value={counts.pending} accent="destructive" />
        <StatCard
          icon={Bot}
          label="Demo profiles"
          value={metrics.demoCount}
          hint="Launch seed · not counted as members"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-3xl border border-border bg-card p-5 lg:col-span-2">
          <h3 className="mb-4 font-semibold">New members (last 30 days)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.days} margin={{ left: -20, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="signupFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  interval={4}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="signups"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#signupFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-5">
          <h3 className="mb-4 font-semibold">Membership mix</h3>
          {metrics.tierData.length === 0 ? (
            <EmptyState>No members yet.</EmptyState>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={metrics.tierData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={2}
                  >
                    {metrics.tierData.map((d) => (
                      <Cell key={d.tier} fill={TIER_COLORS[d.tier]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <ul className="mt-2 space-y-1.5 text-sm">
            {metrics.tierData.map((d) => (
              <li key={d.tier} className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: TIER_COLORS[d.tier] }}
                  />
                  {d.name}
                </span>
                <span className="font-medium tabular-nums">{d.value}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <LocationHeatmap />
    </div>
  );
}
