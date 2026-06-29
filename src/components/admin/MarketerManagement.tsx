import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, Copy, Download, Loader2, Save, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  listAdminMarketers,
  listAdminPromoMaterials,
  listAdminReferralDetails,
  markCommissionPaid,
  saveAdminMarketer,
  saveAdminPromoMaterial,
  type MarketerDashboardRow,
  type MarketerCommissionRow,
  type PromoMaterialRow,
} from "@/lib/referrals.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, PanelLoader } from "@/components/admin/shared";

type MarketerStatus = "pending" | "active" | "suspended" | "inactive";

interface MarketerDraft {
  id: string | null;
  fullName: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  brandName: string;
  bio: string;
  socialLinksText: string;
  marketingChannel: string;
  applicationReason: string;
  referralCode: string;
  referralSlug: string;
  commissionRate: number;
  status: MarketerStatus;
  payoutMethod: string;
  payoutAccountName: string;
  payoutAccountDetails: string;
}

const emptyDraft: MarketerDraft = {
  id: null,
  fullName: "",
  email: "",
  phone: "",
  country: "",
  city: "",
  brandName: "",
  bio: "",
  socialLinksText: "",
  marketingChannel: "",
  applicationReason: "",
  referralCode: "",
  referralSlug: "",
  commissionRate: 0.15,
  status: "pending",
  payoutMethod: "",
  payoutAccountName: "",
  payoutAccountDetails: "",
};

const emptyPromo = {
  id: null as string | null,
  title: "",
  description: "",
  imageUrl: "",
  whatsappCaption: "",
  facebookCaption: "",
  tiktokCaption: "",
  referralCta: "Join HeartConnect today",
  isActive: true,
};

type AdminReferralDetailRow = {
  id: string;
  marketer?: { full_name?: string | null; referral_code?: string | null } | null;
  referral_code?: string | null;
  status?: string | null;
  created_at: string;
};

type AdminPaymentDetailRow = {
  id: string;
  created_at: string;
  description: string | null;
  amount_cents: number;
  currency: string | null;
  status: string | null;
  reference: string | null;
};

type AdminReferralDetails = {
  referrals: AdminReferralDetailRow[];
  commissions: Array<MarketerCommissionRow & { gross_amount?: number | null }>;
  payments: AdminPaymentDetailRow[];
};

function baseUrl() {
  return typeof window === "undefined" ? "https://royal-heart.com" : window.location.origin;
}

function linksToText(links: Record<string, string> | null | undefined) {
  return Object.entries(links ?? {})
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
}

function textToLinks(text: string) {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const [key, ...rest] = line.split(":");
    const value = rest.join(":").trim();
    if (key?.trim() && value) out[key.trim().toLowerCase()] = value;
  }
  return out;
}

export function MarketerManagement() {
  const listFn = useServerFn(listAdminMarketers);
  const saveFn = useServerFn(saveAdminMarketer);
  const detailsFn = useServerFn(listAdminReferralDetails);
  const markPaidFn = useServerFn(markCommissionPaid);
  const listPromosFn = useServerFn(listAdminPromoMaterials);
  const savePromoFn = useServerFn(saveAdminPromoMaterial);
  const [rows, setRows] = useState<MarketerDashboardRow[]>([]);
  const [promos, setPromos] = useState<PromoMaterialRow[]>([]);
  const [draft, setDraft] = useState<MarketerDraft>(emptyDraft);
  const [promoDraft, setPromoDraft] = useState(emptyPromo);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [details, setDetails] = useState<AdminReferralDetails>({
    referrals: [],
    commissions: [],
    payments: [],
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [marketers, promoRows] = await Promise.all([listFn({}), listPromosFn({})]);
      setRows(marketers);
      setPromos(promoRows);
    } catch {
      toast.error("Could not load marketers.");
    } finally {
      setLoading(false);
    }
  }, [listFn, listPromosFn]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(
    () => ({
      marketers: rows.length,
      active: rows.filter((row) => row.status === "active").length,
      clicks: rows.reduce((sum, row) => sum + (row.total_clicks ?? row.visits), 0),
      signups: rows.reduce((sum, row) => sum + row.signups, 0),
      paidClients: rows.reduce((sum, row) => sum + row.paid_clients, 0),
      pending: rows.reduce((sum, row) => sum + row.pending_commission, 0),
      paid: rows.reduce((sum, row) => sum + row.paid_commission, 0),
    }),
    [rows],
  );

  const selectRow = async (row: MarketerDashboardRow) => {
    setSelectedId(row.id);
    setDraft({
      id: row.id,
      fullName: row.full_name,
      email: row.email ?? "",
      phone: row.phone ?? "",
      country: row.country ?? "",
      city: row.city ?? "",
      brandName: row.brand_name ?? "",
      bio: row.bio ?? "",
      socialLinksText: linksToText(row.social_links),
      marketingChannel: row.marketing_channel ?? "",
      applicationReason: row.application_reason ?? "",
      referralCode: row.referral_code,
      referralSlug: row.referral_slug,
      commissionRate: row.commission_rate,
      status:
        row.status === "active" || row.status === "suspended" || row.status === "inactive"
          ? row.status
          : "pending",
      payoutMethod: row.payout_method ?? "",
      payoutAccountName: row.payout_account_name ?? "",
      payoutAccountDetails: row.payout_account_details ?? "",
    });
    setDetails(await detailsFn({ data: { marketerId: row.id } }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const result = await saveFn({
        data: {
          ...draft,
          socialLinks: textToLinks(draft.socialLinksText),
        },
      });
      if (!result.ok) {
        toast.error(result.error ?? "Could not save marketer.");
        return;
      }
      toast.success(draft.id ? "Marketer updated" : "Marketer created");
      setDraft(emptyDraft);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const savePromo = async () => {
    const result = await savePromoFn({ data: promoDraft });
    if (!result.ok) {
      toast.error(result.error ?? "Could not save promo material.");
      return;
    }
    toast.success("Promo material saved.");
    setPromoDraft(emptyPromo);
    await load();
  };

  const copyLink = async (code: string) => {
    await navigator.clipboard.writeText(`${baseUrl()}/?ref=${encodeURIComponent(code)}`);
    toast.success("Referral link copied.");
  };

  const exportCsv = () => {
    const header = [
      "Marketer",
      "Email",
      "Phone",
      "Country",
      "Code",
      "Status",
      "Clicks",
      "Signups",
      "Paid clients",
      "Conversion rate",
      "Pending commission",
      "Paid commission",
    ];
    const lines = rows.map((row) =>
      [
        row.full_name,
        row.email ?? "",
        row.phone ?? "",
        row.country ?? "",
        row.referral_code,
        row.status,
        row.total_clicks ?? row.visits,
        row.signups,
        row.paid_clients,
        `${row.conversion_rate ?? 0}%`,
        row.pending_commission,
        row.paid_commission,
      ]
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "heartconnect-marketer-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const markPaid = async (id: string) => {
    const result = await markPaidFn({ data: { id } });
    if (!result.ok) {
      toast.error(result.error ?? "Could not mark paid.");
      return;
    }
    toast.success("Commission marked paid.");
    if (selectedId) setDetails(await detailsFn({ data: { marketerId: selectedId } }));
    await load();
  };

  if (loading) return <PanelLoader />;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
        <Metric label="Total marketers" value={totals.marketers} />
        <Metric label="Active" value={totals.active} />
        <Metric label="Clicks" value={totals.clicks} />
        <Metric label="Signups" value={totals.signups} />
        <Metric label="Paid clients" value={totals.paidClients} />
        <Metric label="Pending" value={totals.pending.toFixed(2)} />
        <Metric label="Paid" value={totals.paid.toFixed(2)} />
      </div>

      <section className="grid gap-4 rounded-3xl border border-border bg-card p-4 md:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold">Marketers</h3>
            <Button variant="outline" size="sm" className="rounded-xl" onClick={exportCsv}>
              <Download className="h-4 w-4" /> CSV
            </Button>
          </div>
          {rows.length === 0 ? (
            <EmptyState>No marketers yet.</EmptyState>
          ) : (
            <div className="space-y-2">
              {rows.map((row) => (
                <button
                  type="button"
                  key={row.id}
                  onClick={() => selectRow(row)}
                  className="w-full rounded-2xl border border-border bg-background p-3 text-left hover:border-primary/60"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{row.brand_name || row.full_name}</p>
                      <p className="text-xs text-muted-foreground">{row.referral_code}</p>
                    </div>
                    <Badge variant={row.status === "active" ? "default" : "outline"}>
                      {row.status}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {row.signups} signups, {row.paid_clients} paid, {row.conversion_rate ?? 0}%
                    conversion
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div className="grid gap-3 rounded-2xl border border-border bg-background p-4 md:grid-cols-2">
            <Field label="Full name">
              <Input
                value={draft.fullName}
                onChange={(e) => setDraft((d) => ({ ...d, fullName: e.target.value }))}
              />
            </Field>
            <Field label="Brand name">
              <Input
                value={draft.brandName}
                onChange={(e) => setDraft((d) => ({ ...d, brandName: e.target.value }))}
              />
            </Field>
            <Field label="Email">
              <Input
                value={draft.email}
                onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
              />
            </Field>
            <Field label="Phone">
              <Input
                value={draft.phone}
                onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
              />
            </Field>
            <Field label="Country">
              <Input
                value={draft.country}
                onChange={(e) => setDraft((d) => ({ ...d, country: e.target.value }))}
              />
            </Field>
            <Field label="City">
              <Input
                value={draft.city}
                onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))}
              />
            </Field>
            <Field label="Referral code">
              <Input
                value={draft.referralCode}
                onChange={(e) => setDraft((d) => ({ ...d, referralCode: e.target.value }))}
                placeholder="Auto-generated if blank"
              />
            </Field>
            <Field label="Referral slug">
              <Input
                value={draft.referralSlug}
                onChange={(e) => setDraft((d) => ({ ...d, referralSlug: e.target.value }))}
                placeholder="Auto-generated if blank"
              />
            </Field>
            <Field label="Commission rate">
              <Input
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={draft.commissionRate}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, commissionRate: Number(e.target.value) }))
                }
              />
            </Field>
            <Field label="Status">
              <Select
                value={draft.status}
                onValueChange={(value) =>
                  setDraft((d) => ({ ...d, status: value as MarketerStatus }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="active">Active / approved</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="inactive">Inactive legacy</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Marketing channel">
              <Input
                value={draft.marketingChannel}
                onChange={(e) => setDraft((d) => ({ ...d, marketingChannel: e.target.value }))}
              />
            </Field>
            <Field label="Payout method">
              <Input
                value={draft.payoutMethod}
                onChange={(e) => setDraft((d) => ({ ...d, payoutMethod: e.target.value }))}
              />
            </Field>
            <Field label="Payout account name">
              <Input
                value={draft.payoutAccountName}
                onChange={(e) => setDraft((d) => ({ ...d, payoutAccountName: e.target.value }))}
              />
            </Field>
            <Field label="Payout account details">
              <Input
                value={draft.payoutAccountDetails}
                onChange={(e) => setDraft((d) => ({ ...d, payoutAccountDetails: e.target.value }))}
              />
            </Field>
            <Field label="Bio" className="md:col-span-2">
              <Textarea
                rows={3}
                value={draft.bio}
                onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))}
              />
            </Field>
            <Field label="Application reason" className="md:col-span-2">
              <Textarea
                rows={3}
                value={draft.applicationReason}
                onChange={(e) => setDraft((d) => ({ ...d, applicationReason: e.target.value }))}
              />
            </Field>
            <Field
              label="Social links (one per line: instagram: https://...)"
              className="md:col-span-2"
            >
              <Textarea
                rows={3}
                value={draft.socialLinksText}
                onChange={(e) => setDraft((d) => ({ ...d, socialLinksText: e.target.value }))}
              />
            </Field>
            <div className="flex items-end gap-2">
              <Button className="rounded-xl" onClick={save} disabled={saving || !draft.fullName}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save
              </Button>
              <Button variant="outline" className="rounded-xl" onClick={() => setDraft(emptyDraft)}>
                <UserPlus className="h-4 w-4" /> New
              </Button>
            </div>
          </div>

          {selectedId && (
            <div className="space-y-3 rounded-2xl border border-border bg-background p-4">
              <h4 className="font-medium">Referral links</h4>
              <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                <Input
                  readOnly
                  value={`${baseUrl()}/?ref=${encodeURIComponent(draft.referralCode)}`}
                />
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => copyLink(draft.referralCode)}
                >
                  <Copy className="h-4 w-4" /> Copy
                </Button>
                <Input
                  readOnly
                  value={`${baseUrl()}/m/${encodeURIComponent(draft.referralCode)}`}
                />
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() =>
                    navigator.clipboard.writeText(
                      `${baseUrl()}/m/${encodeURIComponent(draft.referralCode)}`,
                    )
                  }
                >
                  <Copy className="h-4 w-4" /> Copy
                </Button>
              </div>
              <h4 className="pt-3 font-medium">Commissions</h4>
              {details.commissions.length === 0 ? (
                <EmptyState>No commissions yet.</EmptyState>
              ) : (
                <div className="space-y-2">
                  {details.commissions.map((row) => (
                    <div
                      key={row.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {Number(row.commission_amount).toFixed(2)} {row.currency}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Gross {Number(row.gross_amount).toFixed(2)} · {row.status}
                        </p>
                      </div>
                      {row.status === "pending" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl"
                          onClick={() => markPaid(row.id)}
                        >
                          <BadgeCheck className="h-4 w-4" /> Mark paid
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="grid gap-4 rounded-2xl border border-border bg-background p-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="grid gap-3 md:grid-cols-2">
              <h3 className="md:col-span-2 font-semibold">Promotional materials</h3>
              <Field label="Title">
                <Input
                  value={promoDraft.title}
                  onChange={(e) => setPromoDraft((d) => ({ ...d, title: e.target.value }))}
                />
              </Field>
              <Field label="Banner/image URL">
                <Input
                  value={promoDraft.imageUrl}
                  onChange={(e) => setPromoDraft((d) => ({ ...d, imageUrl: e.target.value }))}
                />
              </Field>
              <Field label="Description" className="md:col-span-2">
                <Textarea
                  rows={2}
                  value={promoDraft.description}
                  onChange={(e) => setPromoDraft((d) => ({ ...d, description: e.target.value }))}
                />
              </Field>
              <Field label="WhatsApp caption" className="md:col-span-2">
                <Textarea
                  rows={2}
                  value={promoDraft.whatsappCaption}
                  onChange={(e) =>
                    setPromoDraft((d) => ({ ...d, whatsappCaption: e.target.value }))
                  }
                />
              </Field>
              <Field label="Facebook caption">
                <Textarea
                  rows={2}
                  value={promoDraft.facebookCaption}
                  onChange={(e) =>
                    setPromoDraft((d) => ({ ...d, facebookCaption: e.target.value }))
                  }
                />
              </Field>
              <Field label="TikTok caption">
                <Textarea
                  rows={2}
                  value={promoDraft.tiktokCaption}
                  onChange={(e) => setPromoDraft((d) => ({ ...d, tiktokCaption: e.target.value }))}
                />
              </Field>
              <Field label="Referral CTA">
                <Input
                  value={promoDraft.referralCta}
                  onChange={(e) => setPromoDraft((d) => ({ ...d, referralCta: e.target.value }))}
                />
              </Field>
              <div className="flex items-end">
                <Button className="rounded-xl" onClick={savePromo} disabled={!promoDraft.title}>
                  <Save className="h-4 w-4" /> Save promo
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              {promos.length === 0 ? (
                <EmptyState>No promo materials yet.</EmptyState>
              ) : (
                promos.slice(0, 8).map((promo) => (
                  <button
                    type="button"
                    key={promo.id}
                    onClick={() =>
                      setPromoDraft({
                        id: promo.id,
                        title: promo.title,
                        description: promo.description ?? "",
                        imageUrl: promo.image_url ?? "",
                        whatsappCaption: promo.whatsapp_caption ?? "",
                        facebookCaption: promo.facebook_caption ?? "",
                        tiktokCaption: promo.tiktok_caption ?? "",
                        referralCta: promo.referral_cta,
                        isActive: promo.is_active,
                      })
                    }
                    className="w-full rounded-xl border border-border p-3 text-left hover:border-primary/60"
                  >
                    <p className="font-medium">{promo.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {promo.is_active ? "Active" : "Inactive"}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
