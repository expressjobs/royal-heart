import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Copy, ImagePlus, Loader2, QrCode, Save, Share2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import {
  applyForMarketer,
  getMyMarketerDashboard,
  updateMyMarketerProfile,
  uploadMyMarketerPhoto,
  type MarketerDashboardRow,
  type MarketerPayoutRow,
  type MyMarketerDashboard,
  type PromoMaterialRow,
} from "@/lib/referrals.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/marketer")({
  head: () => ({ meta: [{ title: "Marketer Dashboard - HeartConnect" }] }),
  component: () => (
    <AppShell>
      <MarketerDashboard />
    </AppShell>
  ),
});

function baseUrl() {
  return typeof window === "undefined" ? "https://royal-heart.com" : window.location.origin;
}

function referralLink(code: string) {
  return `${baseUrl()}/?ref=${encodeURIComponent(code)}`;
}

function qrUrl(code: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(referralLink(code))}`;
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

type MarketerProfileDraft = {
  fullName: string;
  phone: string;
  country: string;
  city: string;
  brandName: string;
  marketingChannel: string;
  socialLinksText: string;
  applicationReason: string;
  bio: string;
  payoutMethod: string;
  payoutAccountName: string;
  payoutAccountDetails: string;
};

function MarketerDashboard() {
  const loadFn = useServerFn(getMyMarketerDashboard);
  const applyFn = useServerFn(applyForMarketer);
  const updateFn = useServerFn(updateMyMarketerProfile);
  const uploadFn = useServerFn(uploadMyMarketerPhoto);
  const [loading, setLoading] = useState(true);
  const [marketer, setMarketer] = useState<MarketerDashboardRow | null>(null);
  const [payouts, setPayouts] = useState<MarketerPayoutRow[]>([]);
  const [promos, setPromos] = useState<PromoMaterialRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<MarketerProfileDraft>({
    fullName: "",
    phone: "",
    country: "",
    city: "",
    brandName: "",
    bio: "",
    marketingChannel: "",
    applicationReason: "",
    socialLinksText: "",
    payoutMethod: "",
    payoutAccountName: "",
    payoutAccountDetails: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      const data = (await loadFn({})) as MyMarketerDashboard;
      setMarketer(data.marketer);
      setPayouts(data.payouts);
      setPromos(data.promoMaterials);
      if (data.marketer) {
        setDraft({
          fullName: data.marketer.full_name,
          phone: data.marketer.phone ?? "",
          country: data.marketer.country ?? "",
          city: data.marketer.city ?? "",
          brandName: data.marketer.brand_name ?? "",
          bio: data.marketer.bio ?? "",
          marketingChannel: data.marketer.marketing_channel ?? "",
          applicationReason: data.marketer.application_reason ?? "",
          socialLinksText: linksToText(data.marketer.social_links),
          payoutMethod: data.marketer.payout_method ?? "",
          payoutAccountName: data.marketer.payout_account_name ?? "",
          payoutAccountDetails: data.marketer.payout_account_details ?? "",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const link = marketer ? referralLink(marketer.referral_code) : "";
  const conversionRate = marketer?.conversion_rate ?? 0;

  const submitApplication = async () => {
    setSaving(true);
    try {
      const result = await applyFn({
        data: {
          fullName: draft.fullName,
          phone: draft.phone,
          country: draft.country,
          city: draft.city,
          brandName: draft.brandName,
          marketingChannel: draft.marketingChannel,
          applicationReason: draft.applicationReason,
          socialLinks: textToLinks(draft.socialLinksText),
        },
      });
      if (!result.ok) {
        toast.error(result.error ?? "Could not submit application.");
        return;
      }
      toast.success("Application submitted.");
      await load();
    } finally {
      setSaving(false);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const result = await updateFn({
        data: {
          fullName: draft.fullName,
          phone: draft.phone,
          country: draft.country,
          city: draft.city,
          brandName: draft.brandName,
          bio: draft.bio,
          socialLinks: textToLinks(draft.socialLinksText),
          payoutMethod: draft.payoutMethod,
          payoutAccountName: draft.payoutAccountName,
          payoutAccountDetails: draft.payoutAccountDetails,
        },
      });
      if (!result.ok) {
        toast.error(result.error ?? "Could not update profile.");
        return;
      }
      toast.success("Profile updated.");
      await load();
    } finally {
      setSaving(false);
    }
  };

  const uploadPhoto = async (file: File | null) => {
    if (!file) return;
    const form = new FormData();
    form.set("file", file);
    const result = await uploadFn({ data: form });
    if (!result.ok) {
      toast.error(result.error ?? "Could not upload photo.");
      return;
    }
    toast.success("Profile photo updated.");
    await load();
  };

  if (loading) {
    return (
      <div className="grid h-[50vh] place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!marketer) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-2xl font-semibold">Apply to become a marketer</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Share HeartConnect with your audience and earn commission from verified paid memberships.
        </p>
        <ProfileForm draft={draft} setDraft={setDraft} application />
        <Button className="mt-5 rounded-xl" onClick={submitApplication} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
          Submit application
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">Marketer Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Status: <span className="font-medium capitalize">{marketer.status}</span>
          </p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium">
          <ImagePlus className="h-4 w-4" />
          Upload photo
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(e) => void uploadPhoto(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <Metric label="Clicks" value={marketer.total_clicks ?? marketer.visits} />
        <Metric label="Signups" value={marketer.signups} />
        <Metric label="Paid clients" value={marketer.paid_clients} />
        <Metric label="Conversion" value={`${conversionRate}%`} />
        <Metric label="Rate" value={`${Math.round(marketer.commission_rate * 100)}%`} />
      </div>

      <section className="grid gap-4 rounded-3xl border border-border bg-card p-4 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div>
          <h2 className="font-semibold">Your referral link</h2>
          <div className="mt-3 flex gap-2">
            <Input readOnly value={link} />
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() =>
                navigator.clipboard.writeText(link).then(() => toast.success("Copied."))
              }
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Landing page: {baseUrl()}/m/{marketer.referral_code}
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <Metric label="Pending commission" value={marketer.pending_commission.toFixed(2)} />
            <Metric label="Paid commission" value={marketer.paid_commission.toFixed(2)} />
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-background p-4 text-center">
          <QrCode className="mx-auto mb-2 h-5 w-5 text-primary" />
          <img
            src={qrUrl(marketer.referral_code)}
            alt="Referral QR code"
            className="mx-auto rounded-xl"
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-3xl border border-border bg-card p-4">
          <h2 className="font-semibold">Profile and payout details</h2>
          <ProfileForm draft={draft} setDraft={setDraft} />
          <Button className="mt-5 rounded-xl" onClick={saveProfile} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save profile
          </Button>
        </div>
        <div className="rounded-3xl border border-border bg-card p-4">
          <h2 className="font-semibold">Payout history</h2>
          <div className="mt-3 space-y-2">
            {payouts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payouts recorded yet.</p>
            ) : (
              payouts.map((payout) => (
                <div key={payout.id} className="rounded-xl border border-border p-3">
                  <p className="font-medium">
                    {Number(payout.amount).toFixed(2)} {payout.currency}
                  </p>
                  <p className="text-xs text-muted-foreground">{payout.status}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <PromoMaterials promos={promos} link={link} />
    </div>
  );
}

function ProfileForm({
  draft,
  setDraft,
  application = false,
}: {
  draft: MarketerProfileDraft;
  setDraft: Dispatch<SetStateAction<MarketerProfileDraft>>;
  application?: boolean;
}) {
  return (
    <div className="mt-5 grid gap-4 md:grid-cols-2">
      <Field label="Full name">
        <Input
          value={draft.fullName}
          onChange={(e) => setDraft((d) => ({ ...d, fullName: e.target.value }))}
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
      <Field label="Brand name">
        <Input
          value={draft.brandName}
          onChange={(e) => setDraft((d) => ({ ...d, brandName: e.target.value }))}
        />
      </Field>
      <Field label="Marketing channel">
        <Input
          value={draft.marketingChannel}
          onChange={(e) => setDraft((d) => ({ ...d, marketingChannel: e.target.value }))}
        />
      </Field>
      <Field label="Social links (one per line)" className="md:col-span-2">
        <Textarea
          rows={3}
          value={draft.socialLinksText}
          onChange={(e) => setDraft((d) => ({ ...d, socialLinksText: e.target.value }))}
        />
      </Field>
      <Field label={application ? "Reason for joining" : "Bio"} className="md:col-span-2">
        <Textarea
          rows={4}
          value={application ? draft.applicationReason : draft.bio}
          onChange={(e) =>
            setDraft((d) => ({
              ...d,
              [application ? "applicationReason" : "bio"]: e.target.value,
            }))
          }
        />
      </Field>
      {!application && (
        <>
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
          <Field label="Payout account details" className="md:col-span-2">
            <Input
              value={draft.payoutAccountDetails}
              onChange={(e) => setDraft((d) => ({ ...d, payoutAccountDetails: e.target.value }))}
            />
          </Field>
        </>
      )}
    </div>
  );
}

function PromoMaterials({ promos, link }: { promos: PromoMaterialRow[]; link: string }) {
  const cards = useMemo(() => promos.filter((promo) => promo.is_active), [promos]);
  return (
    <section className="rounded-3xl border border-border bg-card p-4">
      <h2 className="font-semibold">Promotional materials</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {cards.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active promo materials yet.</p>
        ) : (
          cards.map((promo) => {
            const caption = [
              promo.whatsapp_caption ||
                promo.facebook_caption ||
                promo.tiktok_caption ||
                promo.referral_cta,
              link,
            ]
              .filter(Boolean)
              .join("\n\n");
            return (
              <div key={promo.id} className="rounded-2xl border border-border p-4">
                {promo.image_url && (
                  <img
                    src={promo.image_url}
                    alt={promo.title}
                    className="mb-3 aspect-video w-full rounded-xl object-cover"
                  />
                )}
                <h3 className="font-medium">{promo.title}</h3>
                {promo.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{promo.description}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() =>
                      navigator.clipboard
                        .writeText(caption)
                        .then(() => toast.success("Caption copied."))
                    }
                  >
                    <Copy className="h-4 w-4" /> Copy caption
                  </Button>
                  {promo.image_url && (
                    <Button asChild size="sm" variant="outline" className="rounded-xl">
                      <a href={promo.image_url} download>
                        Download banner
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
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
