import { useCallback, useEffect, useMemo, useState } from "react";
import { Globe2, Loader2, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface HeatRow {
  country: string;
  city: string;
  member_count: number;
  verified_count: number;
}

interface CountryGroup {
  country: string;
  total: number;
  verified: number;
  cities: HeatRow[];
}

const RANGE_PRESETS: { label: string; days: number | null }[] = [
  { label: "All time", days: null },
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
];

function toInputDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Maps a 0..1 density ratio to a tinted background using the primary token. */
function heatStyle(ratio: number): React.CSSProperties {
  const alpha = 0.08 + Math.min(1, Math.max(0, ratio)) * 0.55;
  return { backgroundColor: `hsl(var(--primary) / ${alpha.toFixed(3)})` };
}

export function LocationHeatmap() {
  const [rows, setRows] = useState<HeatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("location_heatmap", {
      _start_date: startDate ? new Date(`${startDate}T00:00:00`).toISOString() : undefined,
      _end_date: endDate ? new Date(`${endDate}T23:59:59.999`).toISOString() : undefined,
      _verified_only: verifiedOnly,
    });
    if (!error) setRows((data as HeatRow[]) ?? []);
    setLoading(false);
  }, [startDate, endDate, verifiedOnly]);

  useEffect(() => {
    load();
  }, [load]);

  const applyPreset = (days: number | null) => {
    setEndDate("");
    if (days === null) {
      setStartDate("");
      return;
    }
    const start = new Date();
    start.setDate(start.getDate() - days);
    setStartDate(toInputDate(start));
  };

  const { countries, maxCity, totalMembers } = useMemo(() => {
    const byCountry = new Map<string, CountryGroup>();
    let max = 0;
    let total = 0;
    for (const r of rows) {
      total += r.member_count;
      max = Math.max(max, r.member_count);
      const g = byCountry.get(r.country) ?? {
        country: r.country,
        total: 0,
        verified: 0,
        cities: [],
      };
      g.total += r.member_count;
      g.verified += r.verified_count;
      g.cities.push(r);
      byCountry.set(r.country, g);
    }
    const list = [...byCountry.values()].sort((a, b) => b.total - a.total);
    for (const g of list) g.cities.sort((a, b) => b.member_count - a.member_count);
    return { countries: list, maxCity: max, totalMembers: total };
  }, [rows]);

  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <Globe2 className="h-5 w-5 text-primary" /> Location heatmap
        </h2>
        <p className="text-sm text-muted-foreground">
          {totalMembers.toLocaleString()} member{totalMembers === 1 ? "" : "s"} in view
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-4">
        <div className="flex flex-wrap gap-2">
          {RANGE_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyPreset(p.days)}
              className="rounded-full border border-border px-3 py-1.5 text-sm transition-colors hover:border-primary"
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="heat-start" className="text-xs text-muted-foreground">
            From
          </Label>
          <Input
            id="heat-start"
            type="date"
            value={startDate}
            max={endDate || undefined}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-40 rounded-full"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="heat-end" className="text-xs text-muted-foreground">
            To
          </Label>
          <Input
            id="heat-end"
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-40 rounded-full"
          />
        </div>
        <div className="flex items-center gap-2 pb-2">
          <Switch id="heat-verified" checked={verifiedOnly} onCheckedChange={setVerifiedOnly} />
          <Label htmlFor="heat-verified" className="text-sm">
            Verified only
          </Label>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <span>Lower density</span>
        <span className="h-3 w-24 rounded-full bg-gradient-to-r from-primary/10 to-primary/60" />
        <span>Higher density</span>
      </div>

      {loading ? (
        <div className="grid h-40 place-items-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : countries.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center text-muted-foreground">
          No members match these filters.
        </p>
      ) : (
        <div className="mt-4 space-y-5">
          {countries.map((g) => (
            <div key={g.country}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-1.5 font-medium">
                  <MapPin className="h-4 w-4 text-primary" /> {g.country}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {g.total.toLocaleString()} · {g.verified.toLocaleString()} verified
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {g.cities.map((c) => (
                  <div
                    key={`${g.country}-${c.city}`}
                    style={heatStyle(maxCity ? c.member_count / maxCity : 0)}
                    className={cn("rounded-2xl border border-border/60 p-3")}
                  >
                    <p className="truncate text-sm font-medium" title={c.city}>
                      {c.city}
                    </p>
                    <p className="mt-1 font-display text-xl font-semibold">
                      {c.member_count.toLocaleString()}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {c.verified_count.toLocaleString()} verified
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
