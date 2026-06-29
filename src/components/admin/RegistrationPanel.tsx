import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, ShieldAlert, UserCheck, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

type UntypedRpcClient = {
  rpc(name: string, args?: Record<string, unknown>): Promise<{ data: unknown }>;
};

type Filter = "new" | "incomplete" | "suspicious" | "unverified" | "recently_verified" | "blocked";

interface Overview {
  total_new: number;
  completed: number;
  incomplete: number;
  suspicious: number;
  unverified: number;
  blocked_from_discovery: number;
}

interface ReviewRow {
  id: string;
  display_name: string | null;
  created_at: string;
  onboarding_complete: boolean;
  onboarding_completed_at: string | null;
  profile_completion_score: number;
  is_verified: boolean;
  phone_country_code: string | null;
  phone_number: string | null;
  location_city: string | null;
  location_country: string | null;
  suspicious_signup_reason: string | null;
  discovery_blocked_reason: string | null;
  photo_count: number;
}

const FILTERS: { value: Filter; label: string }[] = [
  { value: "new", label: "New" },
  { value: "incomplete", label: "Incomplete" },
  { value: "suspicious", label: "Suspicious" },
  { value: "unverified", label: "Unverified" },
  { value: "recently_verified", label: "Verified" },
  { value: "blocked", label: "Blocked" },
];

export function RegistrationPanel() {
  const [filter, setFilter] = useState<Filter>("new");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      const rpcClient = supabase as unknown as UntypedRpcClient;
      const [metrics, review] = await Promise.all([
        rpcClient.rpc("registration_overview", { _days: 30 }),
        rpcClient.rpc("registration_review", { _filter: filter, _limit: 100 }),
      ]);
      if (!alive) return;
      setOverview((metrics.data as Overview[] | null)?.[0] ?? null);
      setRows((review.data ?? []) as ReviewRow[]);
      setLoading(false);
    }
    load();
    return () => {
      alive = false;
    };
  }, [filter]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Registration health</h2>
        <p className="text-sm text-muted-foreground">
          Review onboarding quality, verification status, and suspicious signup signals.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Metric label="New" value={overview?.total_new} icon={Users} />
        <Metric label="Completed" value={overview?.completed} icon={CheckCircle2} />
        <Metric label="Incomplete" value={overview?.incomplete} icon={AlertTriangle} />
        <Metric label="Suspicious" value={overview?.suspicious} icon={ShieldAlert} />
        <Metric label="Unverified" value={overview?.unverified} icon={UserCheck} />
        <Metric label="Blocked" value={overview?.blocked_from_discovery} icon={ShieldAlert} />
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <Button
            key={item.value}
            type="button"
            variant={filter === item.value ? "default" : "outline"}
            size="sm"
            className="rounded-full"
            onClick={() => setFilter(item.value)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {loading ? (
          <div className="grid h-48 place-items-center">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No registrations in this view.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {rows.map((row) => (
              <div key={row.id} className="grid gap-4 p-4 md:grid-cols-[1fr_220px]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{row.display_name || "Unnamed member"}</p>
                    {row.is_verified ? (
                      <Badge variant="secondary">Verified</Badge>
                    ) : (
                      <Badge variant="outline">Unverified</Badge>
                    )}
                    {!row.onboarding_complete && <Badge variant="outline">Incomplete</Badge>}
                    {row.suspicious_signup_reason && (
                      <Badge variant="destructive">Suspicious</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Joined {new Date(row.created_at).toLocaleString()} · Photos {row.photo_count} ·{" "}
                    {[row.location_city, row.location_country].filter(Boolean).join(", ") ||
                      "No location"}
                  </p>
                  {(row.discovery_blocked_reason || row.suspicious_signup_reason) && (
                    <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                      {row.suspicious_signup_reason || row.discovery_blocked_reason}
                    </p>
                  )}
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="font-medium">Completion</span>
                    <span className="text-muted-foreground">{row.profile_completion_score}%</span>
                  </div>
                  <Progress value={row.profile_completion_score} className="h-2" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value?: number;
  icon: typeof Users;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-3 text-2xl font-semibold">{value ?? "-"}</p>
    </div>
  );
}
