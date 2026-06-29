import { useEffect, useState } from "react";
import {
  Activity,
  BarChart3,
  Heart,
  Loader2,
  MousePointerClick,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, PanelLoader, StatCard } from "@/components/admin/shared";

interface MatchingAnalyticsData {
  total_recommendations: number;
  recommended_users: number;
  avg_compatibility: number;
  likes: number;
  passes: number;
  matches: number;
  match_rate: number;
  rec_shown: number;
  rec_clicked: number;
  rec_ctr: number;
  score_distribution: { bucket: number; count: number }[];
  signals_by_type: Record<string, number>;
}

const SIGNAL_LABELS: Record<string, string> = {
  view: "Profile views",
  like: "Likes",
  pass: "Passes",
  superlike: "Super likes",
  match: "Matches",
  chat_open: "Chats opened",
  message_sent: "Messages sent",
  recommendation_shown: "Recs shown",
  recommendation_clicked: "Recs clicked",
  recommendation_dismissed: "Recs dismissed",
};

export function MatchingAnalytics() {
  const [data, setData] = useState<MatchingAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.rpc("matching_analytics", { _days: 30 }).then(({ data }) => {
      if (!active) return;
      setData((data as unknown as MatchingAnalyticsData) ?? null);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <PanelLoader />;
  if (!data || Object.keys(data).length === 0)
    return <EmptyState>Matching analytics aren't available.</EmptyState>;

  const dist = (data.score_distribution ?? []).map((d) => ({
    range: `${d.bucket}–${d.bucket + 19}%`,
    count: d.count,
  }));
  const signals = Object.entries(data.signals_by_type ?? {})
    .map(([k, c]) => ({ name: SIGNAL_LABELS[k] ?? k, count: c }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Sparkles}
          label="Recommendations (30d)"
          value={data.total_recommendations}
        />
        <StatCard
          icon={TrendingUp}
          label="Avg compatibility"
          value={`${data.avg_compatibility}%`}
          accent="gold"
        />
        <StatCard icon={Heart} label="Matches (30d)" value={data.matches} />
        <StatCard
          icon={Activity}
          label="Match rate"
          value={`${data.match_rate}%`}
          hint="Matches per like"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Members recommended" value={data.recommended_users} />
        <StatCard icon={Heart} label="Likes (30d)" value={data.likes} />
        <StatCard
          icon={MousePointerClick}
          label="Rec click-through"
          value={`${data.rec_ctr}%`}
          hint={`${data.rec_clicked} / ${data.rec_shown} shown`}
        />
        <StatCard icon={BarChart3} label="Passes (30d)" value={data.passes} />
      </div>

      <div className="rounded-3xl border border-border bg-card p-5">
        <h3 className="mb-4 font-semibold">Compatibility score distribution</h3>
        {dist.length === 0 ? (
          <EmptyState>No compatibility scores recorded yet.</EmptyState>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={dist}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis
                dataKey="range"
                tick={{ fontSize: 11 }}
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
                }}
              />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="rounded-3xl border border-border bg-card p-5">
        <h3 className="mb-4 font-semibold">Engagement signals (last 30 days)</h3>
        {signals.length === 0 ? (
          <EmptyState>No interaction signals recorded yet.</EmptyState>
        ) : (
          <ul className="space-y-2">
            {signals.map((s) => {
              const max = signals[0].count || 1;
              return (
                <li key={s.name} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 truncate text-sm">{s.name}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(s.count / max) * 100}%` }}
                    />
                  </div>
                  <span className="w-12 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                    {s.count}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
