import { useState, type ReactNode } from "react";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { LifeBuoy, Mail, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { REPORT_REASONS } from "@/lib/constants";
import { getInfoPageContent } from "@/lib/cms.functions";
import type { ContactChannel, InfoPageContent } from "@/lib/cms-types";

export function InfoPage({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />

      <section className="bg-gradient-warm">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center md:py-20">
          <span className="text-sm font-semibold uppercase tracking-wide text-primary">
            {eyebrow}
          </span>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight md:text-5xl">
            {title}
          </h1>
          {intro && <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">{intro}</p>}
        </div>
      </section>

      <main className="mx-auto max-w-3xl px-4 py-14">
        <div className="prose-info space-y-8 text-[15px] leading-relaxed text-muted-foreground">
          {children}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

export function InfoSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl font-semibold text-foreground">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

const CHANNEL_ICONS = [LifeBuoy, ShieldAlert, Mail];

function infoPageQuery(slug: string) {
  return queryOptions({
    queryKey: ["info-page-content", slug],
    queryFn: () => getInfoPageContent({ data: { slug } }),
    staleTime: 60 * 1000,
  });
}

export function CmsInfoPage({ slug }: { slug: string }) {
  const { data: page } = useSuspenseQuery(infoPageQuery(slug));

  if (slug === "report-abuse") return <CmsReportAbusePage page={page} />;

  return (
    <InfoPage eyebrow={page.eyebrow} title={page.title} intro={page.intro}>
      {slug === "contact" && page.contactChannels && (
        <ContactChannels channels={page.contactChannels} />
      )}
      <RenderedSections page={page} />
    </InfoPage>
  );
}

function RenderedSections({ page }: { page: InfoPageContent }) {
  return (
    <>
      {page.sections.map((section) => (
        <InfoSection key={section.title} title={section.title}>
          {section.body && <p>{section.body}</p>}
          {section.bullets.length > 0 && (
            <ul className="list-disc space-y-2 pl-5">
              {section.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          )}
        </InfoSection>
      ))}
    </>
  );
}

function ContactChannels({ channels }: { channels: ContactChannel[] }) {
  return (
    <div className="grid gap-5 not-prose sm:grid-cols-2">
      {channels.map((channel, index) => {
        const Icon = CHANNEL_ICONS[index % CHANNEL_ICONS.length];
        return (
          <div
            key={`${channel.title}-${channel.contact}`}
            className="rounded-3xl border border-border/60 bg-card p-6 shadow-soft"
          >
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent text-primary">
              <Icon className="h-6 w-6" />
            </span>
            <h3 className="mt-4 text-lg font-semibold text-foreground">{channel.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{channel.description}</p>
            <a
              href={`mailto:${channel.contact}`}
              className="mt-3 inline-block text-sm font-medium text-primary underline"
            >
              {channel.contact}
            </a>
          </div>
        );
      })}
    </div>
  );
}

function CmsReportAbusePage({ page }: { page: InfoPageContent }) {
  const [member, setMember] = useState("");
  const [reason, setReason] = useState<string>(REPORT_REASONS[0]);
  const [details, setDetails] = useState("");
  const safetyEmail = page.reportAbuse?.safetyEmail || "safety@heartconnect.app";
  const mailto = `mailto:${safetyEmail}?subject=${encodeURIComponent(
    `Abuse report: ${reason}`,
  )}&body=${encodeURIComponent(
    `Member reported: ${member || "(unknown)"}\nReason: ${reason}\n\nDetails:\n${details}`,
  )}`;

  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />

      <section className="bg-gradient-warm">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center md:py-20">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-card text-primary shadow-soft">
            <ShieldAlert className="h-7 w-7" />
          </span>
          <span className="mt-4 block text-sm font-semibold uppercase tracking-wide text-primary">
            {page.eyebrow}
          </span>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight md:text-5xl">
            {page.title}
          </h1>
          {page.intro && (
            <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">{page.intro}</p>
          )}
        </div>
      </section>

      <main className="mx-auto max-w-3xl px-4 py-14">
        <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-soft md:p-8">
          {page.reportAbuse?.formIntro && (
            <p className="text-sm text-muted-foreground">{page.reportAbuse.formIntro}</p>
          )}

          <div className="mt-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="member">Member name or profile (optional)</Label>
              <Input
                id="member"
                value={member}
                onChange={(event) => setMember(event.target.value)}
                placeholder="Who are you reporting?"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <select
                id="reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {REPORT_REASONS.map((reportReason) => (
                  <option key={reportReason} value={reportReason}>
                    {reportReason}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="details">What happened?</Label>
              <Textarea
                id="details"
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                rows={5}
                placeholder="Share any details that will help us investigate."
              />
            </div>

            <Button asChild variant="hero" className="w-full rounded-full" size="lg">
              <a href={mailto}>Send report to our safety team</a>
            </Button>
            {page.reportAbuse?.emergencyNote && (
              <p className="text-center text-xs text-muted-foreground">
                {page.reportAbuse.emergencyNote}
              </p>
            )}
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
