import { useEffect, useState } from "react";
import { Loader2, Smartphone, CreditCard, Building2, ShieldCheck, Check } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";

import { initPaystackCheckout } from "@/lib/paystack.functions";
import { formatCadence, formatPrice } from "@/lib/membership";
import type { PlanRow } from "@/lib/subscriptions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  plan: PlanRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}

const CHANNELS = [
  { icon: Smartphone, label: "M-Pesa" },
  { icon: CreditCard, label: "Card & Apple Pay" },
  { icon: Building2, label: "Bank / PesaLink" },
];

const INSTALLMENT_OPTIONS = [
  { count: 1, label: "Pay once" },
  { count: 2, label: "2 installments" },
  { count: 3, label: "3 installments" },
];

export function PaystackCheckoutDialog({ plan, open, onOpenChange, onSuccess }: Props) {
  const runCheckout = useServerFn(initPaystackCheckout);
  const [submitting, setSubmitting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [installments, setInstallments] = useState(1);

  useEffect(() => {
    if (open) setInstallments(1);
  }, [open]);

  if (!plan) return null;

  const isFree = plan.tier === "free" || plan.price_cents === 0;
  const isAnnual = plan.billing_interval === "year";
  const canInstall = isAnnual && !isFree;
  const cadence = formatCadence(plan.billing_interval, plan.interval_count);

  const perInstallment =
    installments > 1 ? Math.floor(plan.price_cents / installments) : plan.price_cents;
  const dueToday = installments > 1 ? perInstallment : plan.price_cents;

  const confirm = async () => {
    setSubmitting(true);
    try {
      const res = await runCheckout({
        data: {
          planId: plan.id,
          origin: window.location.origin,
          installments: canInstall ? installments : 1,
        },
      });
      if (res.free) {
        toast.success("You're now on the Free plan.");
        onOpenChange(false);
        onSuccess();
        return;
      }
      if (res.authorizationUrl) {
        // Redirect to Paystack hosted checkout (M-Pesa, card, Apple Pay, bank).
        setRedirecting(true);
        window.location.href = res.authorizationUrl;
        return;
      }
      throw new Error("Could not start checkout. Please try again.");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Payment could not be started. Please try again.",
      );
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !redirecting && onOpenChange(v)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isFree ? "Switch to Free" : `Upgrade to ${plan.name}`}</DialogTitle>
          <DialogDescription>
            {isFree
              ? "Your paid membership features will end and you'll move to the Free plan."
              : `${formatPrice(plan.price_cents, plan.currency)} ${cadence}, paid securely via Paystack.`}
          </DialogDescription>
        </DialogHeader>

        {redirecting ? (
          <div className="grid place-items-center gap-3 py-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Redirecting to secure checkout…</p>
          </div>
        ) : (
          <>
            {!isFree && (
              <div className="space-y-4">
                {canInstall && (
                  <div>
                    <p className="mb-2 text-sm font-medium">Payment plan</p>
                    <div className="grid gap-2">
                      {INSTALLMENT_OPTIONS.map((opt) => {
                        const active = installments === opt.count;
                        const each =
                          opt.count > 1
                            ? Math.floor(plan.price_cents / opt.count)
                            : plan.price_cents;
                        return (
                          <button
                            key={opt.count}
                            type="button"
                            onClick={() => setInstallments(opt.count)}
                            className={cn(
                              "flex min-h-14 items-center justify-between rounded-xl border px-4 py-3 text-base transition",
                              active ? "border-primary bg-accent" : "border-border",
                            )}
                          >
                            <span className="flex items-center gap-2">
                              {active && <Check className="h-4 w-4 text-primary" />}
                              {opt.label}
                            </span>
                            <span className="font-medium">
                              {opt.count > 1
                                ? `${formatPrice(each, plan.currency)} × ${opt.count}`
                                : formatPrice(plan.price_cents, plan.currency)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{plan.name}</span>
                    <span className="font-semibold">
                      {formatPrice(plan.price_cents, plan.currency)}
                    </span>
                  </div>
                  {installments > 1 && (
                    <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                      <span>Split into {installments} payments</span>
                      <span>{formatPrice(perInstallment, plan.currency)} each</span>
                    </div>
                  )}
                  <div className="mt-2 flex justify-between border-t border-border pt-2 font-semibold">
                    <span>Due today</span>
                    <span>{formatPrice(dueToday, plan.currency)}</span>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium">Pay with</p>
                  <div className="grid grid-cols-3 gap-2">
                    {CHANNELS.map((c) => (
                      <div
                        key={c.label}
                        className="flex flex-col items-center gap-1.5 rounded-xl border border-border px-2 py-3 text-center text-xs"
                      >
                        <c.icon className="h-5 w-5 text-primary" />
                        <span>{c.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <p className="flex items-start gap-2 rounded-xl bg-accent/60 p-3 text-xs text-muted-foreground">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <span>
                    {installments > 1
                      ? `Each installment unlocks 30 days of Gold. Full annual access is granted once all ${installments} payments are complete. Miss a due date and your account moves to Free until you resume.`
                      : "M-Pesa memberships are fixed-duration for the selected billing period. Card payments can renew automatically."}
                  </span>
                </p>
              </div>
            )}

            <Button
              className="mt-2 min-h-14 w-full rounded-xl px-5 py-4 text-base font-semibold"
              onClick={confirm}
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isFree ? (
                "Confirm switch to Free"
              ) : (
                `Pay ${formatPrice(dueToday, plan.currency)}`
              )}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Secured by Paystack · HeartConnect (royal-heart.com)
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
