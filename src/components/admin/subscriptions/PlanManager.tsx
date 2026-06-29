import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { TIER_ORDER, TIER_LABELS, formatPrice, type MembershipTier } from "@/lib/membership";
import type { PlanRow } from "@/lib/subscriptions";
import { PanelLoader } from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const INTERVALS = ["day", "week", "month", "quarter", "year"];
const VARIANTS = ["outline", "gold", "platinum"];

type Draft = {
  id?: string;
  tier: MembershipTier;
  name: string;
  tagline: string;
  description: string;
  priceDollars: string;
  currency: string;
  billing_interval: string;
  interval_count: number;
  trial_days: number;
  featuresText: string;
  badge: string;
  variant: string;
  is_active: boolean;
  is_visible: boolean;
  sort_order: number;
};

function emptyDraft(): Draft {
  return {
    tier: "gold",
    name: "",
    tagline: "",
    description: "",
    priceDollars: "9.99",
    currency: "USD",
    billing_interval: "month",
    interval_count: 1,
    trial_days: 0,
    featuresText: "",
    badge: "",
    variant: "outline",
    is_active: true,
    is_visible: true,
    sort_order: 0,
  };
}

function toDraft(p: PlanRow): Draft {
  const feats = Array.isArray(p.highlights) ? (p.highlights as unknown[]).map(String) : [];
  return {
    id: p.id,
    tier: p.tier as MembershipTier,
    name: p.name,
    tagline: p.tagline ?? "",
    description: p.description ?? "",
    priceDollars: (p.price_cents / 100).toString(),
    currency: p.currency,
    billing_interval: p.billing_interval,
    interval_count: p.interval_count,
    trial_days: p.trial_days,
    featuresText: feats.join("\n"),
    badge: p.badge ?? "",
    variant: p.variant,
    is_active: p.is_active,
    is_visible: p.is_visible,
    sort_order: p.sort_order,
  };
}

export function PlanManager() {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("subscription_plans").select("*").order("sort_order");
    setPlans((data ?? []) as PlanRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      toast.error("Plan name is required.");
      return;
    }
    setSaving(true);
    const features = draft.featuresText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const payload = {
      tier: draft.tier,
      name: draft.name.trim(),
      tagline: draft.tagline.trim() || null,
      description: draft.description.trim() || null,
      price_cents: Math.round(parseFloat(draft.priceDollars || "0") * 100),
      currency: draft.currency.trim().toUpperCase() || "USD",
      billing_interval: draft.billing_interval,
      interval_count: Math.max(1, draft.interval_count),
      trial_days: Math.max(0, draft.trial_days),
      features,
      highlights: features,
      badge: draft.badge.trim() || null,
      variant: draft.variant,
      is_active: draft.is_active,
      is_visible: draft.is_visible,
      sort_order: draft.sort_order,
    };
    const res = draft.id
      ? await supabase.from("subscription_plans").update(payload).eq("id", draft.id)
      : await supabase.from("subscription_plans").insert(payload);
    setSaving(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success(draft.id ? "Plan updated." : "Plan created.");
    setDraft(null);
    load();
  };

  const toggle = async (p: PlanRow, field: "is_active" | "is_visible") => {
    const update =
      field === "is_active" ? { is_active: !p.is_active } : { is_visible: !p.is_visible };
    const { error } = await supabase.from("subscription_plans").update(update).eq("id", p.id);
    if (error) toast.error(error.message);
    else load();
  };

  const remove = async (p: PlanRow) => {
    if (!confirm(`Delete "${p.name}"? Existing subscriptions keep their tier.`)) return;
    const { error } = await supabase.from("subscription_plans").delete().eq("id", p.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Plan deleted.");
      load();
    }
  };

  if (loading) return <PanelLoader />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Plans ({plans.length})</h3>
        <Button size="sm" className="gap-1.5 rounded-xl" onClick={() => setDraft(emptyDraft())}>
          <Plus className="h-4 w-4" /> New plan
        </Button>
      </div>

      <div className="grid gap-3">
        {plans.map((p) => (
          <div
            key={p.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">{p.name}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                  {TIER_LABELS[p.tier as MembershipTier]}
                </span>
                {p.badge && (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
                    {p.badge}
                  </span>
                )}
                {!p.is_active && (
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                    inactive
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {formatPrice(p.price_cents, p.currency)} / {p.billing_interval}
                {p.trial_days > 0 && ` · ${p.trial_days}-day trial`}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title={p.is_visible ? "Hide" : "Show"}
                onClick={() => toggle(p, "is_visible")}
              >
                {p.is_visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-lg text-xs"
                onClick={() => toggle(p, "is_active")}
              >
                {p.is_active ? "Deactivate" : "Activate"}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setDraft(toDraft(p))}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={() => remove(p)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!draft} onOpenChange={(v) => !v && setDraft(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit plan" : "New plan"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Name">
                  <Input
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  />
                </Field>
                <Field label="Tier (unlocks features)">
                  <Select
                    value={draft.tier}
                    onValueChange={(v) => setDraft({ ...draft, tier: v as MembershipTier })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIER_ORDER.map((t) => (
                        <SelectItem key={t} value={t}>
                          {TIER_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="Tagline">
                <Input
                  value={draft.tagline}
                  onChange={(e) => setDraft({ ...draft, tagline: e.target.value })}
                />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Price">
                  <Input
                    type="number"
                    step="0.01"
                    value={draft.priceDollars}
                    onChange={(e) => setDraft({ ...draft, priceDollars: e.target.value })}
                  />
                </Field>
                <Field label="Currency">
                  <Input
                    value={draft.currency}
                    onChange={(e) => setDraft({ ...draft, currency: e.target.value })}
                  />
                </Field>
                <Field label="Trial days">
                  <Input
                    type="number"
                    value={draft.trial_days}
                    onChange={(e) => setDraft({ ...draft, trial_days: Number(e.target.value) })}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Interval">
                  <Select
                    value={draft.billing_interval}
                    onValueChange={(v) => setDraft({ ...draft, billing_interval: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INTERVALS.map((i) => (
                        <SelectItem key={i} value={i}>
                          {i}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Every (count)">
                  <Input
                    type="number"
                    min={1}
                    value={draft.interval_count}
                    onChange={(e) => setDraft({ ...draft, interval_count: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Sort order">
                  <Input
                    type="number"
                    value={draft.sort_order}
                    onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Badge (optional)">
                  <Input
                    value={draft.badge}
                    onChange={(e) => setDraft({ ...draft, badge: e.target.value })}
                    placeholder="e.g. Most popular"
                  />
                </Field>
                <Field label="Card style">
                  <Select
                    value={draft.variant}
                    onValueChange={(v) => setDraft({ ...draft, variant: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VARIANTS.map((v) => (
                        <SelectItem key={v} value={v}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="Features (one per line)">
                <Textarea
                  rows={4}
                  value={draft.featuresText}
                  onChange={(e) => setDraft({ ...draft, featuresText: e.target.value })}
                />
              </Field>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={draft.is_active}
                    onCheckedChange={(v) => setDraft({ ...draft, is_active: v })}
                  />{" "}
                  Active
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={draft.is_visible}
                    onCheckedChange={(v) => setDraft({ ...draft, is_visible: v })}
                  />{" "}
                  Visible
                </label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1 block text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
