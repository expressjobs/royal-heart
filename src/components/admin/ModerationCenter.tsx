import { useEffect, useMemo, useState } from "react";
import {
  Activity as ActivityIcon,
  AlertOctagon,
  Ban,
  CheckCircle2,
  Clock,
  Flag,
  ShieldAlert,
  ShieldX,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, PanelLoader, StatCard } from "@/components/admin/shared";
import { ModerationQueue } from "@/components/admin/ModerationQueue";
import {
  CATEGORY_LABELS,
  SEVERITY_BADGE,
  SEVERITY_LABELS,
  fetchModerationActivity,
  fetchModerationReports,
  fetchModerationStats,
  isActiveBan,
  type ModerationActivity,
  type ModerationReport,
  type ModerationStats,
  type ReportCategory,
} from "@/lib/moderation";

const ACTION_LABELS: Record<string, string> = {
  "moderation.suspend7": "Suspended a member (7 days)",
  "moderation.suspend30": "Suspended a member (30 days)",
  "moderation.ban": "Permanently banned a member",
  "moderation.restore": "Restored a member",
  "moderation.warn": "Warned a member",
  "banner.create": "Created a banner",
  "banner.update": "Updated a banner",
  "banner.delete": "Deleted a banner",
  "blog.create": "Created a blog post",
  "blog.update": "Updated a blog post",
  "blog.delete": "Deleted a blog post",
  "settings.update": "Updated site settings",
  "role.update": "Changed a user role",
};

function Overview() {
  const [stats, setStats] = useState<ModerationStats | null>(null);
  const [activity, setActivity] = useState<ModerationActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [s, a] = await Promise.all([fetchModerationStats(), fetchModerationActivity(8)]);
        setStats(s);
        setActivity(a);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const categoryData = useMemo(() => {
    if (!stats) return [];
    return (Object.keys(stats.by_category) as ReportCategory[])
      .map((c) => ({ name: CATEGORY_LABELS[c] ?? c, value: stats.by_category[c] }))
      .sort((a, b) => b.value - a.value);
  }, [stats]);

  if (loading || !stats) return <PanelLoader />;

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Clock} label="Pending reports" value={stats.pending} accent="destructive" />
        <StatCard
          icon={AlertOctagon}
          label="Critical (open)"
          value={stats.critical}
          accent="destructive"
        />
        <StatCard icon={Flag} label="In review" value={stats.reviewing} />
        <StatCard
          icon={CheckCircle2}
          label="Resolved today"
          value={stats.resolved_today}
          accent="primary"
        />
        <StatCard icon={Ban} label="Suspended members" value={stats.suspended} accent="gold" />
        <StatCard icon={ShieldX} label="Banned members" value={stats.banned} accent="destructive" />
        <StatCard icon={ShieldAlert} label="Warnings (7d)" value={stats.warnings_7d} />
        <StatCard
          icon={CheckCircle2}
          label="Total resolved"
          value={stats.resolved}
          accent="primary"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-border bg-card p-5">
          <h3 className="mb-4 font-semibold">Reports by category</h3>
          {categoryData.length === 0 ? (
            <EmptyState>No reports yet.</EmptyState>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fontSize: 11 }}
                    stroke="var(--muted-foreground)"
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={90}
                    tick={{ fontSize: 11 }}
                    stroke="var(--muted-foreground)"
                  />
                  <Tooltip
                    cursor={{ fill: "var(--muted)" }}
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="value" fill="var(--primary)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-border bg-card p-5">
          <h3 className="mb-4 font-semibold">Recent moderator activity</h3>
          {activity.length === 0 ? (
            <EmptyState>No moderation actions yet.</EmptyState>
          ) : (
            <ul className="space-y-2.5">
              {activity.map((a) => (
                <li key={a.id} className="flex items-start gap-3 text-sm">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <div>
                    <p>{ACTION_LABELS[a.action] ?? a.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.actor_name} · {new Date(a.created_at).toLocaleString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

interface FlaggedAccount {
  reported_id: string;
  reported_name: string;
  total: number;
  reporters: number;
  banned: boolean;
  topSeverity: ModerationReport["severity"];
  categories: string[];
  lastAt: string;
}

const SEV_RANK: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };

function Flagged() {
  const [accounts, setAccounts] = useState<FlaggedAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const reports = await fetchModerationReports();
        const byUser = new Map<string, ModerationReport[]>();
        reports.forEach((r) => {
          const arr = byUser.get(r.reported_id) ?? [];
          arr.push(r);
          byUser.set(r.reported_id, arr);
        });
        const flagged: FlaggedAccount[] = [];
        byUser.forEach((rs, id) => {
          const reporters = new Set(rs.map((r) => r.reporter_id)).size;
          if (reporters < 2 && rs.length < 3) return;
          const top = rs.reduce(
            (acc, r) => (SEV_RANK[r.severity] > SEV_RANK[acc] ? r.severity : acc),
            rs[0].severity,
          );
          flagged.push({
            reported_id: id,
            reported_name: rs[0].reported_name,
            total: rs.length,
            reporters,
            banned: rs.some((r) => isActiveBan(r.reported_is_banned, r.reported_banned_until)),
            topSeverity: top,
            categories: [...new Set(rs.map((r) => CATEGORY_LABELS[r.category]))],
            lastAt: rs
              .map((r) => r.created_at)
              .sort()
              .slice(-1)[0],
          });
        });
        flagged.sort((a, b) => b.reporters - a.reporters || b.total - a.total);
        setAccounts(flagged);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <PanelLoader />;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Members automatically flagged for review: reported by multiple people or with repeated
        reports. Open the <span className="font-medium text-foreground">Queue</span> tab to take
        action.
      </p>
      {accounts.length === 0 ? (
        <EmptyState>No accounts are flagged right now. 🎉</EmptyState>
      ) : (
        <ul className="space-y-2">
          {accounts.map((a) => (
            <li
              key={a.reported_id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium">{a.reported_name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${SEVERITY_BADGE[a.topSeverity]}`}
                  >
                    {SEVERITY_LABELS[a.topSeverity]}
                  </span>
                  {a.banned && (
                    <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                      Restricted
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {a.categories.join(", ")} · last {new Date(a.lastAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-4 text-center">
                <div>
                  <p className="font-display text-xl font-semibold tabular-nums text-destructive">
                    {a.reporters}
                  </p>
                  <p className="text-[11px] text-muted-foreground">reporters</p>
                </div>
                <div>
                  <p className="font-display text-xl font-semibold tabular-nums">{a.total}</p>
                  <p className="text-[11px] text-muted-foreground">reports</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ActivityLog() {
  const [activity, setActivity] = useState<ModerationActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setActivity(await fetchModerationActivity(100));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <PanelLoader />;

  return activity.length === 0 ? (
    <EmptyState>No moderation actions recorded yet.</EmptyState>
  ) : (
    <ul className="space-y-2">
      {activity.map((a) => (
        <li key={a.id} className="rounded-2xl border border-border bg-card p-4">
          <p className="font-medium">{ACTION_LABELS[a.action] ?? a.action}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            by {a.actor_name} · {new Date(a.created_at).toLocaleString()}
            {a.entity_id && ` · ${a.entity_type ?? "item"} ${a.entity_id.slice(0, 8)}`}
          </p>
        </li>
      ))}
    </ul>
  );
}

const SUBTABS = [
  { value: "overview", label: "Overview", icon: ActivityIcon },
  { value: "queue", label: "Queue", icon: Flag },
  { value: "flagged", label: "Flagged", icon: AlertOctagon },
  { value: "activity", label: "Activity", icon: ActivityIcon },
] as const;

export function ModerationCenter() {
  return (
    <Tabs defaultValue="queue" className="w-full">
      <TabsList className="mb-6 flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/60 p-1">
        {SUBTABS.map((t) => (
          <TabsTrigger
            key={t.value}
            value={t.value}
            className="gap-1.5 rounded-lg data-[state=active]:bg-card"
          >
            <t.icon className="h-4 w-4" />
            <span>{t.label}</span>
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="overview">
        <Overview />
      </TabsContent>
      <TabsContent value="queue">
        <ModerationQueue />
      </TabsContent>
      <TabsContent value="flagged">
        <Flagged />
      </TabsContent>
      <TabsContent value="activity">
        <ActivityLog />
      </TabsContent>
    </Tabs>
  );
}
