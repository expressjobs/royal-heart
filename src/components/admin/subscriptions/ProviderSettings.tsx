import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { ProviderRow } from "@/lib/subscriptions";
import { PanelLoader } from "@/components/admin/shared";
import { Switch } from "@/components/ui/switch";

const PROVIDER_ICON: Record<string, string> = {
  stripe: "💳",
  paypal: "🅿️",
  mpesa: "📱",
  airtel: "📶",
};

const PROVIDER_NOTE: Record<string, string> = {
  stripe: "Active gateway (test mode). Card payments process immediately.",
  paypal: "Abstraction layer ready — connect PayPal API credentials to go live.",
  mpesa: "Abstraction layer ready — connect Safaricom Daraja API to go live.",
  airtel: "Abstraction layer ready — connect Airtel Money API to go live.",
};

export function ProviderSettings() {
  const [rows, setRows] = useState<ProviderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("payment_provider_settings")
      .select("*")
      .order("sort_order");
    setRows((data ?? []) as ProviderRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = async (p: ProviderRow) => {
    setBusy(p.provider);
    const { error } = await supabase
      .from("payment_provider_settings")
      .update({ is_enabled: !p.is_enabled })
      .eq("id", p.id);
    setBusy(null);
    if (error) toast.error(error.message);
    else {
      toast.success(`${p.display_name} ${p.is_enabled ? "disabled" : "enabled"}.`);
      load();
    }
  };

  if (loading) return <PanelLoader />;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        <ShieldCheck className="mb-1 inline h-4 w-4 text-primary" /> Toggle which payment methods
        members can choose at checkout. Secret API keys are stored securely in backend settings,
        never in the database.
      </div>
      <div className="grid gap-3">
        {rows.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-lg">
                {PROVIDER_ICON[p.provider] ?? "💰"}
              </span>
              <div>
                <p className="font-medium">{p.display_name}</p>
                <p className="text-xs text-muted-foreground">{PROVIDER_NOTE[p.provider] ?? ""}</p>
              </div>
            </div>
            {busy === p.provider ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Switch checked={p.is_enabled} onCheckedChange={() => toggle(p)} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
