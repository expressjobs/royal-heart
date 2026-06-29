import { createFileRoute } from "@tanstack/react-router";
import { Mail, LifeBuoy, ShieldAlert } from "lucide-react";
import { InfoPage, InfoSection } from "@/components/InfoPage";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Us — HeartConnect" },
      {
        name: "description",
        content:
          "Get in touch with the HeartConnect team for support, partnerships, press, or general questions.",
      },
      { property: "og:title", content: "Contact Us — HeartConnect" },
      {
        property: "og:description",
        content:
          "Get in touch with the HeartConnect team for support, partnerships, press, or general questions.",
      },
      { property: "og:url", content: "https://royal-heart.com/contact" },
      { name: "twitter:title", content: "Contact Us — HeartConnect" },
      {
        name: "twitter:description",
        content:
          "Get in touch with the HeartConnect team for support, partnerships, press, or general questions.",
      },
    ],
    links: [{ rel: "canonical", href: "https://royal-heart.com/contact" }],
  }),

  component: Contact,
});

const CHANNELS = [
  {
    icon: LifeBuoy,
    title: "General support",
    desc: "Account help, billing questions, and anything else.",
    contact: "support@heartconnect.app",
  },
  {
    icon: ShieldAlert,
    title: "Trust & safety",
    desc: "Report a member or raise a safety concern.",
    contact: "safety@heartconnect.app",
  },
  {
    icon: Mail,
    title: "Press & partnerships",
    desc: "Media enquiries and collaboration opportunities.",
    contact: "hello@heartconnect.app",
  },
];

function Contact() {
  return (
    <InfoPage
      eyebrow="Contact Us"
      title="We'd love to hear from you"
      intro="Whether you need a hand or just want to say hello, here's how to reach us."
    >
      <div className="grid gap-5 not-prose sm:grid-cols-2">
        {CHANNELS.map((c) => (
          <div
            key={c.title}
            className="rounded-3xl border border-border/60 bg-card p-6 shadow-soft"
          >
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent text-primary">
              <c.icon className="h-6 w-6" />
            </span>
            <h3 className="mt-4 text-lg font-semibold text-foreground">{c.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{c.desc}</p>
            <a
              href={`mailto:${c.contact}`}
              className="mt-3 inline-block text-sm font-medium text-primary underline"
            >
              {c.contact}
            </a>
          </div>
        ))}
      </div>
      <InfoSection title="Response times">
        <p>
          Our team typically responds within 1–2 business days. For urgent safety matters, please
          also use the in-app reporting tools so we can act as quickly as possible.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
