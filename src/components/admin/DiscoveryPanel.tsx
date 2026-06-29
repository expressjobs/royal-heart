import { useCallback, useEffect, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  Eye,
  GripVertical,
  Loader2,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Wrench,
  Tags,
  Trash2,
  TrendingUp,
  Users,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, PanelLoader, StatCard } from "@/components/admin/shared";
import {
  fetchAllOptions,
  createOption,
  updateOption,
  deleteOption,
  type FilterCategory,
  type FilterOption,
} from "@/lib/filter-options";
import {
  getAdminDiscoverDiagnostics,
  getDiscoverDiagnostics,
  type AdminDiscoverDiagnostics,
  type DiscoverDiagnostics,
} from "@/lib/discover.functions";
import {
  getDiscoverAccessSettings,
  saveDiscoverAccessSettings,
  normalizeDiscoverAccessSettings,
  type DiscoverAccessSettings,
} from "@/lib/discover-settings";
import {
  createMissingRealProfiles,
  repairRealProfileSystemFields,
} from "@/lib/real-profiles.functions";

const CATEGORIES: { value: FilterCategory; label: string }[] = [
  { value: "interest", label: "Interests" },
  { value: "profession", label: "Professions" },
  { value: "relationship_goal", label: "Relationship goals" },
  { value: "language", label: "Languages" },
  { value: "religion", label: "Religions" },
  { value: "education", label: "Education levels" },
];

export function DiscoveryPanel() {
  return (
    <Tabs defaultValue="analytics" className="w-full">
      <TabsList className="mb-5 rounded-full">
        <TabsTrigger value="analytics" className="rounded-full gap-1.5">
          <BarChart3 className="h-4 w-4" /> Search analytics
        </TabsTrigger>
        <TabsTrigger value="options" className="rounded-full gap-1.5">
          <Tags className="h-4 w-4" /> Filter categories
        </TabsTrigger>
        <TabsTrigger value="access" className="rounded-full gap-1.5">
          <ShieldCheck className="h-4 w-4" /> Access rules
        </TabsTrigger>
      </TabsList>
      <TabsContent value="analytics">
        <SearchAnalytics />
      </TabsContent>
      <TabsContent value="options">
        <FilterOptionsManager />
      </TabsContent>
      <TabsContent value="access">
        <DiscoverAccessManager />
      </TabsContent>
    </Tabs>
  );
}

function DiscoverAccessManager() {
  const diagnosticsFn = useServerFn(getDiscoverDiagnostics);
  const adminDiagnosticsFn = useServerFn(getAdminDiscoverDiagnostics);
  const accessSettingsFn = useServerFn(getDiscoverAccessSettings);
  const saveAccessSettingsFn = useServerFn(saveDiscoverAccessSettings);
  const createMissingProfilesFn = useServerFn(createMissingRealProfiles);
  const repairSystemFieldsFn = useServerFn(repairRealProfileSystemFields);
  const [settings, setSettings] = useState<DiscoverAccessSettings>(
    normalizeDiscoverAccessSettings(null),
  );
  const [diagnostics, setDiagnostics] = useState<DiscoverDiagnostics | null>(null);
  const [adminDiagnostics, setAdminDiagnostics] = useState<AdminDiscoverDiagnostics | null>(null);
  const [lastRepair, setLastRepair] = useState<{
    action: string;
    before: AdminDiscoverDiagnostics;
    after: AdminDiscoverDiagnostics;
    changed: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [repairing, setRepairing] = useState<"missing_profiles" | "system_fields" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [savedSettings, counts, adminCounts] = await Promise.all([
      accessSettingsFn({}),
      diagnosticsFn({ data: { filters: {} } }),
      adminDiagnosticsFn({ data: { filters: {} } }),
    ]);
    setSettings(savedSettings);
    setDiagnostics(counts);
    setAdminDiagnostics(adminCounts);
    setLoading(false);
  }, [accessSettingsFn, adminDiagnosticsFn, diagnosticsFn]);

  useEffect(() => {
    void load();
  }, [load]);

  const set = <K extends keyof DiscoverAccessSettings>(key: K, value: DiscoverAccessSettings[K]) =>
    setSettings((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setSaving(true);
    const result = await saveAccessSettingsFn({ data: settings });
    setSaving(false);
    if (!result.ok) {
      console.error("[discover-access-settings] database error", result.error);
      toast.error(
        [
          result.error.message,
          result.error.code ? `Code: ${result.error.code}` : null,
          result.error.details ? `Details: ${result.error.details}` : null,
          result.error.hint ? `Hint: ${result.error.hint}` : null,
        ]
          .filter(Boolean)
          .join(" | "),
      );
      return;
    }
    setSettings(result.settings);
    toast.success("Discover access settings saved");
    await load();
  };

  const runRepair = async (action: "missing_profiles" | "system_fields") => {
    setRepairing(action);
    try {
      const before = await adminDiagnosticsFn({ data: { filters: {} } });
      if (action === "missing_profiles") {
        const result = await createMissingProfilesFn({});
        const after = await adminDiagnosticsFn({ data: { filters: {} } });
        setAdminDiagnostics(after);
        setLastRepair({
          action: "Create missing profile rows",
          before,
          after,
          changed: result.created ?? 0,
        });
        toast.success(`Created ${result.created ?? 0} missing real profile row(s).`);
      } else {
        const result = await repairSystemFieldsFn({});
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        const after = await adminDiagnosticsFn({ data: { filters: {} } });
        setAdminDiagnostics(after);
        setLastRepair({
          action: "Repair real-user system fields",
          before,
          after,
          changed: result.repaired ?? 0,
        });
        toast.success(`Repaired ${result.repaired ?? 0} real user(s).`);
      }
      const counts = await diagnosticsFn({ data: { filters: {} } });
      setDiagnostics(counts);
    } finally {
      setRepairing(null);
    }
  };

  if (loading) return <PanelLoader />;

  const diagnosticRows = diagnostics
    ? [
        ["Total real users", diagnostics.total_real_users],
        ["Total active users", diagnostics.total_active_users],
        ["Total discoverable users", diagnostics.total_discoverable_users],
        ["Eligible for current viewer", diagnostics.eligible_for_current_viewer],
        ["Excluded by current user", diagnostics.excluded_by_current_user],
        ["Excluded by location filter", diagnostics.excluded_by_location_filter],
        ["Excluded by blocks/reports", diagnostics.excluded_by_blocks_reports],
        ["Excluded by incomplete profile", diagnostics.excluded_by_incomplete_profile],
        ["Excluded by gender/preference filter", diagnostics.excluded_by_gender_preference_filter],
        ["Profiles returned in queue", diagnostics.profiles_returned_current_queue],
        ["Profiles with photos", diagnostics.profiles_with_photos],
        ["Using safe avatar fallback", diagnostics.profiles_using_safe_avatar_fallback],
      ]
    : [];

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-border bg-card p-5">
        <h3 className="font-semibold">Discover access rules</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Free members can browse globally by default and use their daily like allowance. Messaging
          and Super Likes remain upgrade-controlled.
        </p>
        <div className="mt-4 grid gap-3">
          <SettingSwitch
            label="Free users can browse"
            checked={settings.free_users_can_browse}
            onCheckedChange={(value) => set("free_users_can_browse", value)}
          />
          <SettingSwitch
            label="Free users can like"
            checked={settings.free_users_can_like}
            onCheckedChange={(value) => set("free_users_can_like", value)}
          />
          <SettingSwitch
            label="Free users can message"
            checked={settings.free_users_can_message}
            onCheckedChange={(value) => set("free_users_can_message", value)}
          />
          <SettingSwitch
            label="Discover global mode"
            checked={settings.discover_global_mode}
            onCheckedChange={(value) => set("discover_global_mode", value)}
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" className="rounded-full" onClick={load} disabled={saving}>
            Refresh diagnostics
          </Button>
          <Button onClick={save} disabled={saving} className="rounded-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save access rules
          </Button>
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-card p-5">
        <h3 className="font-semibold">Discover diagnostics</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Admin-only counts below use real auth users and exclude demo profiles from repair actions.
        </p>
        {adminDiagnostics && (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {adminDiagnosticRows(adminDiagnostics).map(([label, value, hint]) => (
                <div key={label} className="rounded-2xl border border-border bg-muted/30 p-4">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
                  {hint ? <p className="mt-1 text-xs text-muted-foreground/80">{hint}</p> : null}
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                className="rounded-full"
                onClick={load}
                disabled={Boolean(repairing)}
              >
                <RefreshCcw className="h-4 w-4" />
                Refresh counts
              </Button>
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => void runRepair("missing_profiles")}
                disabled={Boolean(repairing) || adminDiagnostics.missing_profile_rows === 0}
              >
                {repairing === "missing_profiles" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Create missing rows
              </Button>
              <Button
                className="rounded-full"
                onClick={() => void runRepair("system_fields")}
                disabled={Boolean(repairing)}
              >
                {repairing === "system_fields" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wrench className="h-4 w-4" />
                )}
                Repair system fields
              </Button>
            </div>
          </>
        )}
        {lastRepair && (
          <div className="mt-4 rounded-2xl border border-border bg-background p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{lastRepair.action}</p>
                <p className="text-xs text-muted-foreground">
                  Changed {lastRepair.changed} real user record(s). No dating profile content was
                  generated.
                </p>
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {adminDiagnosticRows(lastRepair.after).map(([label, after]) => {
                const before =
                  lastRepair.before[adminDiagnosticKeyForLabel(label)] ??
                  lastRepair.after[adminDiagnosticKeyForLabel(label)];
                return (
                  <div key={label} className="rounded-xl bg-muted/40 px-3 py-2 text-sm">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="font-medium tabular-nums">
                      {before} to {after}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <h4 className="mt-6 text-sm font-semibold">Current viewer queue checks</h4>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {diagnosticRows.map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-border bg-muted/30 p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const ADMIN_DIAGNOSTIC_LABELS: Record<keyof AdminDiscoverDiagnostics, string> = {
  total_auth_users: "Total auth users",
  total_profile_rows: "Total profile rows",
  active_users: "Active users",
  discoverable_users: "Discoverable users",
  missing_required_fields: "Missing required fields",
  blocked_by_preference_gender_filters: "Blocked by preference/gender filters",
  blocked_by_reports_blocks: "Blocked by reports/blocks",
  hidden_by_incomplete_profile: "Hidden by incomplete profile",
  hidden_by_location_filters: "Hidden by location filters",
  users_with_no_photos_safe_avatar_fallback: "No photos, safe avatar fallback",
  missing_profile_rows: "Missing profile rows",
};

function adminDiagnosticRows(diagnostics: AdminDiscoverDiagnostics): [string, number, string?][] {
  return [
    [ADMIN_DIAGNOSTIC_LABELS.total_auth_users, diagnostics.total_auth_users, "Real auth users"],
    [
      ADMIN_DIAGNOSTIC_LABELS.total_profile_rows,
      diagnostics.total_profile_rows,
      "Real profile rows",
    ],
    [ADMIN_DIAGNOSTIC_LABELS.active_users, diagnostics.active_users],
    [ADMIN_DIAGNOSTIC_LABELS.discoverable_users, diagnostics.discoverable_users],
    [ADMIN_DIAGNOSTIC_LABELS.missing_required_fields, diagnostics.missing_required_fields],
    [
      ADMIN_DIAGNOSTIC_LABELS.blocked_by_preference_gender_filters,
      diagnostics.blocked_by_preference_gender_filters,
    ],
    [ADMIN_DIAGNOSTIC_LABELS.blocked_by_reports_blocks, diagnostics.blocked_by_reports_blocks],
    [
      ADMIN_DIAGNOSTIC_LABELS.hidden_by_incomplete_profile,
      diagnostics.hidden_by_incomplete_profile,
    ],
    [ADMIN_DIAGNOSTIC_LABELS.hidden_by_location_filters, diagnostics.hidden_by_location_filters],
    [
      ADMIN_DIAGNOSTIC_LABELS.users_with_no_photos_safe_avatar_fallback,
      diagnostics.users_with_no_photos_safe_avatar_fallback,
    ],
    [ADMIN_DIAGNOSTIC_LABELS.missing_profile_rows, diagnostics.missing_profile_rows],
  ];
}

function adminDiagnosticKeyForLabel(label: string): keyof AdminDiscoverDiagnostics {
  const entry = Object.entries(ADMIN_DIAGNOSTIC_LABELS).find(([, value]) => value === label);
  return (entry?.[0] ?? "total_auth_users") as keyof AdminDiscoverDiagnostics;
}

function SettingSwitch({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <Label className="flex items-center justify-between rounded-2xl border border-border p-3">
      <span className="text-sm font-medium">{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </Label>
  );
}

interface Analytics {
  total_searches: number;
  searchers: number;
  avg_results: number;
  zero_result_rate: number;
  by_day: { day: string; count: number }[];
  top_filters: Record<string, number>;
}

const FILTER_LABELS: Record<string, string> = {
  maxDistanceKm: "Distance",
  minAge: "Min age",
  maxAge: "Max age",
  country: "Country",
  state: "State",
  city: "City",
  onlineOnly: "Online now",
  recentlyActive: "Recently active",
  verifiedOnly: "Verified only",
  premiumOnly: "Gold and Platinum only",
  hasBio: "Has bio",
  interests: "Interests",
  languages: "Languages",
  religion: "Religion",
  education: "Education",
  relationshipGoal: "Looking for",
  profession: "Profession",
  smoking: "Smoking",
  drinking: "Drinking",
  workout: "Workout",
  familyPlans: "Family plans",
  pets: "Pets",
};

function SearchAnalytics() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.rpc("search_analytics", { _days: 30 }).then(({ data }) => {
      if (!active) return;
      setData((data as unknown as Analytics) ?? null);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <PanelLoader />;
  if (!data || Object.keys(data).length === 0)
    return <EmptyState>Search analytics aren't available.</EmptyState>;

  const topFilters = Object.entries(data.top_filters ?? {})
    .map(([k, c]) => ({ name: FILTER_LABELS[k] ?? k, count: c }))
    .sort((a, b) => b.count - a.count);
  const byDay = (data.by_day ?? []).map((d) => ({
    day: new Date(d.day).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    count: d.count,
  }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Search} label="Searches (30d)" value={data.total_searches} />
        <StatCard icon={Users} label="Unique searchers" value={data.searchers} accent="gold" />
        <StatCard icon={TrendingUp} label="Avg results" value={data.avg_results} />
        <StatCard
          icon={Eye}
          label="Zero-result rate"
          value={`${data.zero_result_rate}%`}
          accent={data.zero_result_rate > 30 ? "destructive" : "primary"}
          hint="Searches returning no matches"
        />
      </div>

      <div className="rounded-3xl border border-border bg-card p-5">
        <h3 className="mb-4 font-semibold">Search volume (last 30 days)</h3>
        {byDay.length === 0 ? (
          <EmptyState>No searches recorded yet.</EmptyState>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byDay}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
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
        <h3 className="mb-4 font-semibold">Most used filters</h3>
        {topFilters.length === 0 ? (
          <EmptyState>No filter usage recorded yet.</EmptyState>
        ) : (
          <ul className="space-y-2">
            {topFilters.map((f) => {
              const max = topFilters[0].count || 1;
              return (
                <li key={f.name} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate text-sm">{f.name}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(f.count / max) * 100}%` }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                    {f.count}
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

function FilterOptionsManager() {
  const [category, setCategory] = useState<FilterCategory>("interest");
  const [options, setOptions] = useState<FilterOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [newValue, setNewValue] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setOptions(await fetchAllOptions(category));
    setLoading(false);
  }, [category]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    const value = newValue.trim();
    const label = newLabel.trim() || value;
    if (!value) return;
    setAdding(true);
    const created = await createOption(category, value, label, options.length);
    setAdding(false);
    if (!created) {
      toast.error("Could not add option (it may already exist).");
      return;
    }
    setOptions((o) => [...o, created]);
    setNewValue("");
    setNewLabel("");
    toast.success("Option added");
  };

  const toggleActive = async (o: FilterOption) => {
    await updateOption(o.id, { is_active: !o.is_active });
    setOptions((prev) => prev.map((x) => (x.id === o.id ? { ...x, is_active: !x.is_active } : x)));
  };

  const remove = async (id: string) => {
    await deleteOption(id);
    setOptions((prev) => prev.filter((x) => x.id !== id));
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={category} onValueChange={(v) => setCategory(v as FilterCategory)}>
          <SelectTrigger className="w-56 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {options.filter((o) => o.is_active).length} active / {options.length} total
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-border bg-card p-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Value (stored)</label>
          <Input
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="e.g. gardening"
            className="w-44 rounded-xl"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Label (shown)</label>
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="e.g. Gardening"
            className="w-44 rounded-xl"
          />
        </div>
        <Button
          variant="hero"
          className="rounded-xl"
          onClick={add}
          disabled={adding || !newValue.trim()}
        >
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
        </Button>
      </div>

      {loading ? (
        <PanelLoader />
      ) : options.length === 0 ? (
        <EmptyState>No options in this category yet.</EmptyState>
      ) : (
        <ul className="space-y-2">
          {options.map((o) => (
            <li
              key={o.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
            >
              <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/50" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{o.label}</p>
                <p className="truncate text-xs text-muted-foreground">{o.value}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">
                  {o.is_active ? "Active" : "Hidden"}
                </span>
                <Switch
                  checked={o.is_active}
                  onCheckedChange={() => toggleActive(o)}
                  aria-label="Active"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full text-destructive"
                onClick={() => remove(o.id)}
                aria-label="Delete option"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
