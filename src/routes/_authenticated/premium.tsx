import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  X,
  Sparkles,
  Loader2,
  Receipt,
  Star,
  Flame,
  Gem,
  ShieldCheck,
  Smartphone,
  CreditCard,
  WalletCards,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  COMPARISON,
  formatPrice,
  normalizeMembershipTier,
  type MembershipTier,
  type PublicMembershipTier,
} from "@/lib/membership";
import { type PlanRow, type SubscriptionRow } from "@/lib/subscriptions";
import { PaystackCheckoutDialog } from "@/components/subscription/PaystackCheckoutDialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

type BillingPeriod = "week" | "month" | "quarter" | "year";
type PaidTier = Exclude<PublicMembershipTier, "free">;

const BILLING_PERIODS: { value: BillingPeriod; label: string; shortLabel: string }[] = [
  { value: "week", label: "Weekly", shortLabel: "week" },
  { value: "month", label: "Monthly", shortLabel: "month" },
  { value: "quarter", label: "Quarterly", shortLabel: "quarter" },
  { value: "year", label: "Yearly", shortLabel: "year" },
];

const PAID_TIER_ORDER: PaidTier[] = ["gold", "platinum"];

const PERIOD_ALIASES: Record<string, BillingPeriod> = {
  week: "week",
  weekly: "week",
  month: "month",
  monthly: "month",
  quarter: "quarter",
  quarterly: "quarter",
  year: "year",
  yearly: "year",
};

const LAUNCH_PRICES: Record<PaidTier, Record<BillingPeriod, number>> = {
  gold: {
    week: 40000,
    month: 200000,
    quarter: 429900,
    year: 899900,
  },
  platinum: {
    week: 100000,
    month: 350000,
    quarter: 569900,
    year: 1099900,
  },
};

const PLAN_CONFIG: Record<
  PaidTier,
  {
    title: string;
    eyebrow: string;
    badge?: string;
    cta: string;
    icon: typeof Star;
    benefits: string[];
    className: string;
    iconClassName: string;
    buttonVariant: "hero" | "gold" | "platinum";
  }
> = {
  gold: {
    title: "Gold (Best Choice)",
    eyebrow: "Best for active daters",
    badge: "Best Choice",
    cta: "Get Gold",
    icon: Flame,
    benefits: ["Unlimited Likes", "See Who Liked You", "Unlimited Messages", "Priority Profile"],
    className:
      "border-amber-300/70 bg-gradient-to-br from-amber-100 via-white to-orange-100 shadow-[0_24px_65px_-32px_rgba(217,119,6,0.65)] dark:border-amber-300/40 dark:from-amber-950/60 dark:via-card dark:to-orange-950/35",
    iconClassName: "bg-amber-400 text-amber-950 shadow-soft",
    buttonVariant: "gold",
  },
  platinum: {
    title: "Platinum (VIP Experience)",
    eyebrow: "Highest visibility",
    badge: "VIP Experience",
    cta: "Become Platinum",
    icon: Gem,
    benefits: [
      "Everything in Gold",
      "Verified Badge",
      "Featured Profile",
      "Advanced Filters",
      "Highest Visibility",
    ],
    className:
      "border-violet-300/70 bg-gradient-to-br from-violet-100 via-white to-fuchsia-100 shadow-[0_24px_65px_-32px_rgba(124,58,237,0.65)] dark:border-violet-300/40 dark:from-violet-950/65 dark:via-card dark:to-fuchsia-950/35",
    iconClassName: "bg-violet-500 text-white shadow-soft",
    buttonVariant: "platinum",
  },
};

function normalizeBillingPeriod(value: unknown): BillingPeriod {
  return typeof value === "string" ? (PERIOD_ALIASES[value] ?? "month") : "month";
}

export const Route = createFileRoute("/_authenticated/premium")({
  validateSearch: (search: Record<string, unknown>) => ({
    plan:
      search.plan === "premium"
        ? "gold"
        : search.plan === "gold" || search.plan === "platinum"
          ? search.plan
          : undefined,
    period: typeof search.period === "string" ? search.period : undefined,
  }),
  head: () => ({ meta: [{ title: "Membership Plans — HeartConnect" }] }),
  component: () => (
    <AppShell>
      <Premium />
    </AppShell>
  ),
});

function Premium() {
  const search = Route.useSearch();
  const { profile } = useAuth();
  const currentTier = normalizeMembershipTier(
    (profile?.membership_tier ?? "free") as MembershipTier,
  );

  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [sub, setSub] = useState<SubscriptionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>(() =>
    normalizeBillingPeriod(search.period),
  );
  const [checkoutPlan, setCheckoutPlan] = useState<PlanRow | null>(null);

  const load = async () => {
    const [{ data: planRows }, { data: subRows }] = await Promise.all([
      supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .eq("is_visible", true)
        .order("sort_order"),
      supabase
        .from("subscriptions")
        .select("*")
        .in("status", ["active", "trialing", "past_due"])
        .order("created_at", { ascending: false })
        .limit(1),
    ]);
    setPlans((planRows ?? []) as PlanRow[]);
    setSub(((subRows ?? [])[0] as SubscriptionRow) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setBillingPeriod(normalizeBillingPeriod(search.period));
  }, [search.period]);

  const isPlanCurrent = (plan: PlanRow) =>
    plan.tier === "free" ? currentTier === "free" : sub?.plan_id === plan.id;

  const choosePlan = (plan: PlanRow) => {
    if (isPlanCurrent(plan)) return;
    setCheckoutPlan(plan);
  };

  const planCards = useMemo(() => buildPlanCards(plans, billingPeriod), [plans, billingPeriod]);
  const selectedTier = search.plan;

  if (loading) {
    return (
      <div className="grid h-[50vh] place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">
          Choose Your HeartConnect Membership
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
          Meet more people, unlock powerful features, and build meaningful connections.
        </p>
        <div className="mt-4">
          <Button asChild variant="outline" size="sm" className="gap-2 rounded-xl">
            <Link to="/billing">
              <Receipt className="h-4 w-4" /> Billing & payment history
            </Link>
          </Button>
        </div>
      </div>

      <div className="mx-auto mt-8 max-w-2xl">
        <div
          className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-card p-2 shadow-soft sm:grid-cols-4"
          aria-label="Billing period"
        >
          {BILLING_PERIODS.map((period) => {
            const active = billingPeriod === period.value;
            return (
              <button
                key={period.value}
                type="button"
                onClick={() => setBillingPeriod(period.value)}
                className={cn(
                  "min-h-12 rounded-xl px-3 py-2 text-sm font-semibold transition",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
                aria-pressed={active}
              >
                {period.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mx-auto mt-8 grid max-w-4xl gap-5 sm:mt-10 md:grid-cols-2">
        {planCards.map(
          ({ tier, checkoutPlan: periodPlan, displayPriceCents, displayPeriod, savings }) => {
            const config = PLAN_CONFIG[tier];
            const Icon = config.icon;
            const isCurrent =
              currentTier === tier && (!sub?.plan_id || sub.plan_id === periodPlan?.id);
            const periodAvailable = !!periodPlan;
            const selected = selectedTier === tier;
            return (
              <div
                key={tier}
                className={cn(
                  "relative flex min-h-[460px] flex-col overflow-hidden rounded-[20px] border p-6 shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-romantic",
                  config.className,
                  selected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                )}
              >
                <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-white/50 to-transparent dark:from-white/10" />
                {config.badge && (
                  <span className="absolute right-5 top-5 rounded-full bg-background/95 px-3 py-1 text-xs font-bold text-foreground shadow-sm ring-1 ring-border/50">
                    {config.badge}
                  </span>
                )}
                <div className="relative">
                  <span
                    className={cn(
                      "grid h-12 w-12 place-items-center rounded-2xl",
                      config.iconClassName,
                    )}
                  >
                    <Icon className="h-6 w-6" fill="currentColor" />
                  </span>
                  <p className="mt-5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {config.eyebrow}
                  </p>
                  <h2 className="mt-2 font-display text-2xl font-semibold">{config.title}</h2>
                </div>

                <div className="relative mt-5 flex flex-wrap items-end gap-x-2 gap-y-1">
                  <span className="font-display text-4xl font-semibold leading-none">
                    {formatPrice(displayPriceCents, "KES")}
                  </span>
                  <span className="pb-1 text-sm font-medium text-muted-foreground">
                    / {displayPeriod}
                  </span>
                </div>
                {savings && (
                  <p className="relative mt-2 text-sm font-semibold text-success">{savings}</p>
                )}

                <div className="relative mt-6">
                  <ul className="space-y-3 text-sm">
                    {config.benefits.map((benefit) => (
                      <li key={benefit} className="flex items-start gap-3">
                        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-success/15 text-success">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                        <span className="font-medium">{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="relative mt-auto pt-8">
                  <Button
                    variant={isCurrent ? "outline" : config.buttonVariant}
                    className="min-h-14 w-full rounded-2xl px-5 py-4 text-base font-bold"
                    disabled={isCurrent || !periodAvailable}
                    onClick={() => periodPlan && choosePlan(periodPlan)}
                    aria-label={`${config.cta} for ${config.title}`}
                  >
                    {isCurrent ? (
                      "Current plan"
                    ) : periodAvailable ? (
                      <>
                        {config.cta}
                        <ArrowRight className="h-4 w-4" />
                      </>
                    ) : (
                      "Coming soon"
                    )}
                  </Button>
                  {!periodAvailable && (
                    <p className="mt-2 text-center text-xs text-muted-foreground">
                      Add this billing period in Supabase to enable checkout.
                    </p>
                  )}
                </div>
              </div>
            );
          },
        )}
      </div>

      <PaymentTrust />
      <MobileFeatureCompare />
      <ComparisonTable />
      <MembershipFaq />

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Cancel anytime. Membership tiers are protected and can only be changed through verified
        checkout.
      </p>

      <PaystackCheckoutDialog
        plan={checkoutPlan}
        open={!!checkoutPlan}
        onOpenChange={(v: boolean) => !v && setCheckoutPlan(null)}
        onSuccess={load}
      />
    </div>
  );
}

function buildPlanCards(plans: PlanRow[], billingPeriod: BillingPeriod) {
  const selectedPeriod = BILLING_PERIODS.find((period) => period.value === billingPeriod);
  return PAID_TIER_ORDER.map((tier) => {
    const checkoutPlan = findPlanForPeriod(plans, tier, billingPeriod);
    const displayPriceCents = LAUNCH_PRICES[tier][billingPeriod];
    return {
      tier,
      checkoutPlan,
      displayPriceCents,
      displayPeriod: selectedPeriod?.shortLabel ?? billingPeriod,
      savings: formatSavings(tier, billingPeriod, displayPriceCents),
    };
  });
}

function formatSavings(tier: PaidTier, billingPeriod: BillingPeriod, priceCents: number) {
  const months = billingPeriod === "quarter" ? 3 : billingPeriod === "year" ? 12 : 0;
  if (!months) return null;
  const monthlyTotal = LAUNCH_PRICES[tier].month * months;
  const savings = monthlyTotal - priceCents;
  return savings > 0 ? `Save ${formatPrice(savings, "KES")}` : null;
}

function findPlanForPeriod(plans: PlanRow[], tier: PaidTier, billingPeriod: BillingPeriod) {
  return plans.find(
    (plan) =>
      normalizeMembershipTier(plan.tier) === tier &&
      getPlanBillingPeriod(plan) === billingPeriod &&
      plan.is_active &&
      (plan.is_visible ?? true),
  );
}

function getPlanBillingPeriod(plan: PlanRow): BillingPeriod | undefined {
  const legacy = plan as PlanRow & { interval?: string | null };
  const candidates = [
    plan.billing_interval,
    legacy.interval,
    plan.variant,
    plan.slug,
    plan.name,
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);

  for (const candidate of candidates) {
    const normalized = normalizePlanPeriod(candidate, plan.interval_count);
    if (normalized) return normalized;
  }

  return normalizeIntervalCount(plan.interval_count);
}

function normalizePlanPeriod(
  value: string,
  intervalCount?: number | null,
): BillingPeriod | undefined {
  const normalized = value.trim().toLowerCase().replace(/_/g, "-");
  const direct = PERIOD_ALIASES[normalized];
  if (direct) return normalizeIntervalCount(intervalCount, direct);

  const pieces = normalized.split(/[^a-z0-9]+/).filter(Boolean);
  for (const piece of pieces) {
    const match = PERIOD_ALIASES[piece];
    if (match) return normalizeIntervalCount(intervalCount, match);
  }

  if (pieces.includes("weekly")) return "week";
  if (pieces.includes("monthly")) return "month";
  if (pieces.includes("quarterly")) return "quarter";
  if (pieces.includes("yearly") || pieces.includes("annual") || pieces.includes("annually")) {
    return "year";
  }

  return normalizeIntervalCount(intervalCount);
}

function normalizeIntervalCount(
  intervalCount?: number | null,
  basePeriod?: BillingPeriod,
): BillingPeriod | undefined {
  if (intervalCount == null || intervalCount === 1) return basePeriod;
  if (basePeriod === "month" && intervalCount === 3) return "quarter";
  if (basePeriod === "month" && intervalCount === 12) return "year";
  if (intervalCount === 3) return "quarter";
  if (intervalCount === 12) return "year";
  return basePeriod;
}

function ComparisonTable() {
  const cols: { key: keyof (typeof COMPARISON)[number]; label: string }[] = useMemo(
    () => [
      { key: "free", label: "Free" },
      { key: "gold", label: "Gold" },
      { key: "platinum", label: "Platinum" },
    ],
    [],
  );

  return (
    <div className="mt-12 hidden overflow-x-auto rounded-3xl border border-border bg-card md:block">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left">
            <th className="p-4 font-semibold">Features</th>
            {cols.map((c) => (
              <th key={c.label} className="p-4 text-center font-semibold">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COMPARISON.map((row) => (
            <tr key={row.label} className="border-b border-border/60 last:border-0">
              <td className="p-4">{row.label}</td>
              {cols.map((c) => (
                <Cell key={c.label} value={row[c.key] as boolean | string} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PaymentTrust() {
  const methods = [
    { label: "M-Pesa", icon: Smartphone },
    { label: "Visa", icon: CreditCard },
    { label: "Mastercard", icon: CreditCard },
    { label: "Apple Pay", icon: WalletCards },
    { label: "Google Pay", icon: WalletCards },
  ];

  return (
    <section className="mt-8 rounded-[20px] border border-border bg-card/80 p-5 text-center shadow-soft">
      <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-success/15 text-success">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <p className="font-semibold">Secure checkout powered by Paystack</p>
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {methods.map(({ label, icon: Icon }) => (
          <span
            key={label}
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border bg-background px-3 text-sm font-semibold text-muted-foreground"
          >
            <Icon className="h-4 w-4 text-primary" />
            {label}
          </span>
        ))}
      </div>
    </section>
  );
}

function MembershipFaq() {
  const items = [
    ["Can I cancel anytime?", "Yes."],
    ["When does membership activate?", "Immediately after successful payment."],
    ["Can I change plans later?", "Yes."],
    ["Is payment secure?", "Yes, payments are securely processed through Paystack."],
  ];

  return (
    <section className="mt-10 rounded-[20px] border border-border bg-card p-5 shadow-soft md:p-6">
      <h2 className="font-display text-2xl font-semibold">Membership FAQ</h2>
      <Accordion type="single" collapsible className="mt-3">
        {items.map(([question, answer]) => (
          <AccordionItem key={question} value={question} className="border-border">
            <AccordionTrigger className="text-left font-semibold">{question}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">{answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

function MobileFeatureCompare() {
  const cols: { key: keyof (typeof COMPARISON)[number]; label: string }[] = [
    { key: "free", label: "Free" },
    { key: "gold", label: "Gold" },
    { key: "platinum", label: "Platinum" },
  ];

  return (
    <div className="mt-8 md:hidden">
      <h2 className="mb-3 font-display text-xl font-semibold">Compare features</h2>
      <Accordion
        type="single"
        collapsible
        className="rounded-3xl border border-border bg-card px-4"
      >
        {cols.map((col) => (
          <AccordionItem key={col.label} value={col.label} className="border-border last:border-0">
            <AccordionTrigger className="py-4 text-left font-semibold">
              {col.label}
            </AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-3 pb-3 text-sm">
                {COMPARISON.map((row) => (
                  <li key={row.label} className="flex items-start justify-between gap-3">
                    <span className="text-muted-foreground">{row.label}</span>
                    <FeatureValue value={row[col.key] as boolean | string} />
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

function FeatureValue({ value }: { value: boolean | string }) {
  if (typeof value === "string") return <span className="text-right font-medium">{value}</span>;
  return value ? (
    <Check className="h-4 w-4 shrink-0 text-success" aria-label="Included" />
  ) : (
    <X className="h-4 w-4 shrink-0 text-muted-foreground/50" aria-label="Not included" />
  );
}

function Cell({ value }: { value: boolean | string }) {
  return (
    <td className="p-4 text-center">
      {typeof value === "string" ? (
        <span className="font-medium">{value}</span>
      ) : value ? (
        <Check className="mx-auto h-4 w-4 text-success" />
      ) : (
        <X className="mx-auto h-4 w-4 text-muted-foreground/50" />
      )}
    </td>
  );
}
