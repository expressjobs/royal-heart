import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, Clock, ShieldAlert, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PanelLoader } from "@/components/admin/shared";

type Row = {
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewed_at: string | null;
};

interface Stats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  approvalRate: number;
  avgReviewHours: number | null;
  flagged: number;
  last7d: number;
}

function computeStats(rows: Row[], flagged: number): Stats {
  const total = rows.length;
  const pending = rows.filter((r) => r.status === "pending").length;
  const approved = rows.filter((r) => r.status === "approved").length;
  const rejected = rows.filter((r) => r.status === "rejected").length;
  const reviewed = approved + rejected;

  const reviewDurations = rows
    .filter((r) => r.reviewed_at)
    .map(
      (r) =>
        (new Date(r.reviewed_at as string).getTime() - new Date(r.created_at).getTime()) / 36e5,
    )
    .filter((h) => h >= 0);
  const avgReviewHours =
    reviewDurations.length > 0
      ? reviewDurations.reduce((a, b) => a + b, 0) / reviewDurations.length
      : null;

  const weekAgo = Date.now() - 7 * 24 * 36e5;
  const last7d = rows.filter((r) => new Date(r.created_at).getTime() >= weekAgo).length;

  return {
    total,
    pending,
    approved,
    rejected,
    approvalRate: reviewed > 0 ? Math.round((approved / reviewed) * 100) : 0,
    avgReviewHours,
    flagged,
    last7d,
  };
}

function StatCard({
  label,
  value,
  sub,
  icon,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  tone?: "default" | "warn";
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className={tone === "warn" ? "text-amber-500" : "text-primary"}>{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function VerificationAnalytics() {
  const [stats, setStats] = useState<Stats | null>(null);

  const load = useCallback(async () => {
    const [{ data }, { data: reviews }] = await Promise.all([
      supabase.from("verification_requests").select("status, created_at, reviewed_at"),
      supabase.from("verification_review").select("fraud_score"),
    ]);
    const flagged = (reviews ?? []).filter((r) => (r.fraud_score ?? 0) > 0).length;
    setStats(computeStats((data ?? []) as Row[], flagged));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!stats) return <PanelLoader />;

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        label="Pending"
        value={String(stats.pending)}
        sub={`${stats.last7d} new this week`}
        icon={<Clock className="h-4 w-4" />}
      />
      <StatCard
        label="Approval rate"
        value={`${stats.approvalRate}%`}
        sub={`${stats.approved} approved · ${stats.rejected} rejected`}
        icon={<BadgeCheck className="h-4 w-4" />}
      />
      <StatCard
        label="Avg review time"
        value={stats.avgReviewHours == null ? "—" : `${stats.avgReviewHours.toFixed(1)}h`}
        sub={`${stats.total} total requests`}
        icon={<TrendingUp className="h-4 w-4" />}
      />
      <StatCard
        label="Fraud-flagged"
        value={String(stats.flagged)}
        sub="needs closer review"
        icon={<ShieldAlert className="h-4 w-4" />}
        tone={stats.flagged > 0 ? "warn" : "default"}
      />
    </div>
  );
}
