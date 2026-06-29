import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { CheckCircle2, XCircle, Loader2, Crown, ArrowRight, Receipt } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { verifyPaystackCheckout } from "@/lib/paystack.functions";

export const Route = createFileRoute("/_authenticated/payment-success")({
  validateSearch: (search: Record<string, unknown>) => ({
    reference: typeof search.reference === "string" ? search.reference : "",
    trxref: typeof search.trxref === "string" ? search.trxref : "",
  }),
  head: () => ({ meta: [{ title: "Payment — HeartConnect" }] }),
  component: () => (
    <AppShell>
      <PaymentSuccess />
    </AppShell>
  ),
});

type State =
  | { kind: "loading" }
  | { kind: "success"; planName?: string; periodEnd?: string | null; method?: string }
  | { kind: "failed"; message: string };

function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const METHOD_LABELS: Record<string, string> = {
  mpesa: "M-Pesa",
  card: "Card",
  apple_pay: "Apple Pay",
  bank_transfer: "Bank transfer",
  pesalink: "PesaLink",
  other: "Paystack",
};

function PaymentSuccess() {
  const { reference, trxref } = useSearch({ from: "/_authenticated/payment-success" });
  const ref = reference || trxref;
  const verify = useServerFn(verifyPaystackCheckout);
  const { refreshProfile } = useAuth();
  const [state, setState] = useState<State>({ kind: "loading" });
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      if (!ref) {
        setState({ kind: "failed", message: "No payment reference was provided." });
        return;
      }
      try {
        const res = await verify({ data: { reference: ref } });
        if (res.ok && (res.status === "succeeded" || res.status === "already")) {
          await refreshProfile();
          setState({
            kind: "success",
            planName: res.planName,
            periodEnd: res.periodEnd,
            method: res.paymentMethod,
          });
        } else {
          setState({
            kind: "failed",
            message:
              "Your payment was not completed. You have not been charged for an unfinished payment.",
          });
        }
      } catch (e) {
        setState({
          kind: "failed",
          message: e instanceof Error ? e.message : "Could not verify payment.",
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);

  if (state.kind === "loading") {
    return (
      <div className="grid h-[60vh] place-items-center text-center">
        <div>
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">Confirming your payment…</p>
        </div>
      </div>
    );
  }

  if (state.kind === "failed") {
    return (
      <div className="mx-auto max-w-md py-10 text-center">
        <XCircle className="mx-auto h-14 w-14 text-destructive" />
        <h1 className="mt-4 font-display text-2xl font-semibold">Payment not completed</h1>
        <p className="mt-2 text-muted-foreground">{state.message}</p>
        <div className="mt-6 flex justify-center gap-2">
          <Button asChild variant="outline" className="rounded-xl">
            <Link to="/premium" search={{ plan: undefined, period: undefined }}>
              Back to plans
            </Link>
          </Button>
          <Button asChild className="rounded-xl">
            <Link to="/discover">Go to Discover</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md py-10 text-center">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success/10">
        <CheckCircle2 className="h-9 w-9 text-success" />
      </span>
      <h1 className="mt-4 font-display text-2xl font-semibold">Payment successful 🎉</h1>
      <p className="mt-2 text-muted-foreground">
        Welcome to {state.planName ?? "Gold"}! Your membership features are now unlocked.
      </p>

      <div className="mt-6 rounded-2xl border border-border bg-card p-5 text-left text-sm shadow-soft">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-accent-foreground">
            <Crown className="h-5 w-5" />
          </span>
          <div>
            <p className="font-medium">{state.planName ?? "Gold Membership"}</p>
            <p className="text-xs text-muted-foreground">
              Paid via {METHOD_LABELS[state.method ?? "other"] ?? "Paystack"}
            </p>
          </div>
        </div>
        <div className="mt-4 flex justify-between border-t border-border pt-3">
          <span className="text-muted-foreground">Access until</span>
          <span className="font-medium">{fmtDate(state.periodEnd)}</span>
        </div>
      </div>

      <div className="mt-6 flex justify-center gap-2">
        <Button asChild variant="outline" className="rounded-xl">
          <Link to="/billing">
            <Receipt className="mr-1.5 h-4 w-4" /> View billing
          </Link>
        </Button>
        <Button asChild className="rounded-xl">
          <Link to="/discover">
            Start matching <ArrowRight className="ml-1.5 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
