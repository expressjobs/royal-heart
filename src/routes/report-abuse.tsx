import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SiteFooter } from "@/components/SiteFooter";
import { REPORT_REASONS } from "@/lib/constants";

export const Route = createFileRoute("/report-abuse")({
  head: () => ({
    meta: [
      { title: "Report Abuse — HeartConnect" },
      {
        name: "description",
        content:
          "Report abusive behaviour, fake profiles, or safety concerns to the HeartConnect Trust & Safety team.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ReportAbuse,
});

const SAFETY_EMAIL = "safety@heartconnect.app";

function ReportAbuse() {
  const [member, setMember] = useState("");
  const [reason, setReason] = useState<string>(REPORT_REASONS[0]);
  const [details, setDetails] = useState("");

  const mailto = `mailto:${SAFETY_EMAIL}?subject=${encodeURIComponent(
    `Abuse report: ${reason}`,
  )}&body=${encodeURIComponent(
    `Member reported: ${member || "(unknown)"}\nReason: ${reason}\n\nDetails:\n${details}`,
  )}`;

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Logo />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild variant="ghost" className="rounded-full">
              <Link to="/">
                <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Home
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="bg-gradient-warm">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center md:py-20">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-card text-primary shadow-soft">
            <ShieldAlert className="h-7 w-7" />
          </span>
          <span className="mt-4 block text-sm font-semibold uppercase tracking-wide text-primary">
            Report Abuse
          </span>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight md:text-5xl">
            Help us keep HeartConnect safe
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            Report fake profiles, harassment, scams, or anything that makes you feel unsafe. Every
            report is reviewed by our Trust &amp; Safety team.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-3xl px-4 py-14">
        <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-soft md:p-8">
          <p className="text-sm text-muted-foreground">
            If you're signed in, the fastest way to report someone is from their profile — open the
            menu and choose <strong>Report</strong>. You can also submit a report below and it will
            be sent to our safety team.
          </p>

          <div className="mt-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="member">Member name or profile (optional)</Label>
              <Input
                id="member"
                value={member}
                onChange={(e) => setMember(e.target.value)}
                placeholder="Who are you reporting?"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <select
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {REPORT_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="details">What happened?</Label>
              <Textarea
                id="details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={5}
                placeholder="Share any details that will help us investigate."
              />
            </div>

            <Button asChild variant="hero" className="w-full rounded-full" size="lg">
              <a href={mailto}>Send report to our safety team</a>
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              This opens your email app addressed to {SAFETY_EMAIL}. In an emergency, contact your
              local emergency services.
            </p>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
