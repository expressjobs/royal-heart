import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2, Tag } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { CouponRow, PlanRow } from "@/lib/subscriptions";
import { PanelLoader } from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type Draft = {
  code: string;
  description: string;
  discount_type: string;
  discount_value: string;
  max_redemptions: string;
  plan_id: string;
  valid_until: string;
  is_active: boolean;
};

function emptyDraft(): Draft {
  return {
    code: "",
    description: "",
    discount_type: "percent",
    discount_value: "10",
    max_redemptions: "",
    plan_id: "all",
    valid_until: "",
    is_active: true,
  };
}

export function CouponManager() {
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [{ data: c }, { data: p }] = await Promise.all([
      supabase.from("coupons").select("*").order("created_at", { ascending: false }),
      supabase.from("subscription_plans").select("*").order("sort_order"),
    ]);
    setCoupons((c ?? []) as CouponRow[]);
    setPlans((p ?? []) as PlanRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!draft) return;
    if (!draft.code.trim()) {
      toast.error("Coupon code is required.");
      return;
    }
    setSaving(true);
    const payload = {
      code: draft.code.trim().toUpperCase(),
      description: draft.description.trim() || null,
      discount_type: draft.discount_type,
      discount_value: parseFloat(draft.discount_value || "0"),
      max_redemptions: draft.max_redemptions ? parseInt(draft.max_redemptions, 10) : null,
      plan_id: draft.plan_id === "all" ? null : draft.plan_id,
      valid_until: draft.valid_until ? new Date(draft.valid_until).toISOString() : null,
      is_active: draft.is_active,
    };
    const { error } = await supabase.from("coupons").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Coupon created.");
    setDraft(null);
    load();
  };

  const toggleActive = async (c: CouponRow) => {
    const { error } = await supabase
      .from("coupons")
      .update({ is_active: !c.is_active })
      .eq("id", c.id);
    if (error) toast.error(error.message);
    else load();
  };

  const remove = async (c: CouponRow) => {
    if (!confirm(`Delete coupon ${c.code}?`)) return;
    const { error } = await supabase.from("coupons").delete().eq("id", c.id);
    if (error) toast.error(error.message);
    else load();
  };

  if (loading) return <PanelLoader />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Promo codes ({coupons.length})</h3>
        <Button size="sm" className="gap-1.5 rounded-xl" onClick={() => setDraft(emptyDraft())}>
          <Plus className="h-4 w-4" /> New code
        </Button>
      </div>

      {coupons.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No promo codes yet.
        </p>
      ) : (
        <div className="grid gap-3">
          {coupons.map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-primary" />
                  <span className="font-mono font-medium">{c.code}</span>
                  {!c.is_active && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      inactive
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {c.discount_type === "percent"
                    ? `${c.discount_value}% off`
                    : `$${c.discount_value} off`}
                  {" · "}
                  {c.times_redeemed}/{c.max_redemptions ?? "∞"} used
                  {c.valid_until && ` · expires ${new Date(c.valid_until).toLocaleDateString()}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={c.is_active} onCheckedChange={() => toggleActive(c)} />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => remove(c)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!draft} onOpenChange={(v) => !v && setDraft(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New promo code</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-3">
              <div>
                <Label className="mb-1 block text-xs text-muted-foreground">Code</Label>
                <Input
                  value={draft.code}
                  onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                  placeholder="LOVE20"
                />
              </div>
              <div>
                <Label className="mb-1 block text-xs text-muted-foreground">Description</Label>
                <Input
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1 block text-xs text-muted-foreground">Type</Label>
                  <Select
                    value={draft.discount_type}
                    onValueChange={(v) => setDraft({ ...draft, discount_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Percent (%)</SelectItem>
                      <SelectItem value="fixed">Fixed ($)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1 block text-xs text-muted-foreground">Value</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={draft.discount_value}
                    onChange={(e) => setDraft({ ...draft, discount_value: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1 block text-xs text-muted-foreground">
                    Max uses (blank = ∞)
                  </Label>
                  <Input
                    type="number"
                    value={draft.max_redemptions}
                    onChange={(e) => setDraft({ ...draft, max_redemptions: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="mb-1 block text-xs text-muted-foreground">Expires</Label>
                  <Input
                    type="date"
                    value={draft.valid_until}
                    onChange={(e) => setDraft({ ...draft, valid_until: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label className="mb-1 block text-xs text-muted-foreground">Applies to</Label>
                <Select
                  value={draft.plan_id}
                  onValueChange={(v) => setDraft({ ...draft, plan_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All plans</SelectItem>
                    {plans.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={draft.is_active}
                  onCheckedChange={(v) => setDraft({ ...draft, is_active: v })}
                />{" "}
                Active
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
