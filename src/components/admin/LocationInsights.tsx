import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Eye, EyeOff, Loader2, MapPinned } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LocationHeatmap } from "@/components/admin/LocationHeatmap";

interface SuspiciousRow {
  user_id: string;
  display_name: string | null;
  location_city: string | null;
  location_country: string | null;
  latitude: number | null;
  longitude: number | null;
  reason: string | null;
  shared_count: number;
  location_updated_at: string | null;
  location_access_suspended: boolean;
}

/**
 * Admin location tools: member distribution heatmap, suspicious/fake-location
 * detection, and a per-member kill-switch to disable location visibility.
 * All data comes from admin-gated SECURITY DEFINER RPCs.
 */
export function LocationInsights() {
  const [rows, setRows] = useState<SuspiciousRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("suspicious_locations", { _limit: 100 });
    if (!error) setRows((data as SuspiciousRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleAccess = async (row: SuspiciousRow) => {
    setBusy(row.user_id);
    const next = !row.location_access_suspended;
    const { error } = await supabase.rpc("admin_set_location_access", {
      _user_id: row.user_id,
      _suspended: next,
    });
    setBusy(null);
    if (error) {
      toast.error("Could not update location access.");
      return;
    }
    setRows((rs) =>
      rs.map((r) => (r.user_id === row.user_id ? { ...r, location_access_suspended: next } : r)),
    );
    toast.success(next ? "Location visibility disabled" : "Location visibility restored");
  };

  return (
    <div className="space-y-6">
      <LocationHeatmap />

      <div className="rounded-3xl border border-border bg-card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-5 w-5 text-primary" /> Suspicious locations
          </h2>
          <p className="text-sm text-muted-foreground">
            {rows.length} flagged account{rows.length === 1 ? "" : "s"}
          </p>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Accounts sharing identical coordinates, sitting on "null island" (0, 0), or with GPS set
          but no country. Review and disable location visibility for fake or abusive accounts.
        </p>

        {loading ? (
          <div className="grid h-32 place-items-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : rows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center text-muted-foreground">
            <MapPinned className="mx-auto mb-2 h-8 w-8 opacity-60" />
            No suspicious locations detected.
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li
                key={r.user_id}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-border p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {r.display_name ?? "Member"}
                    {r.location_access_suspended && (
                      <span className="ml-2 rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-medium text-destructive">
                        Location disabled
                      </span>
                    )}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {[r.location_city, r.location_country].filter(Boolean).join(", ") || "No place"}
                    {r.latitude != null && (
                      <span className="ml-1 font-mono text-xs">
                        ({r.latitude.toFixed(3)}, {r.longitude?.toFixed(3)})
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">{r.reason}</p>
                </div>
                <Button
                  variant={r.location_access_suspended ? "outline" : "destructive"}
                  size="sm"
                  className="rounded-full"
                  disabled={busy === r.user_id}
                  onClick={() => toggleAccess(r)}
                >
                  {busy === r.user_id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : r.location_access_suspended ? (
                    <Eye className="h-4 w-4" />
                  ) : (
                    <EyeOff className="h-4 w-4" />
                  )}
                  {r.location_access_suspended ? "Restore" : "Disable location"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
