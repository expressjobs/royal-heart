import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";

const COLUMNS = [
  {
    title: "Company",
    links: [
      { label: "About Us", to: "/about" },
      { label: "Blog", to: "/blog" },
      { label: "Contact Us", to: "/contact" },
    ],
  },
  {
    title: "Trust & Safety",
    links: [
      { label: "Safety Center", to: "/safety" },
      { label: "Report Abuse", to: "/report-abuse" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", to: "/privacy" },
      { label: "Terms of Service", to: "/terms" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-card/40">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-10 md:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              A modern dating platform built for serious relationships — bringing genuine people
              together across the globe.
            </p>
            <p className="mt-3 max-w-xs text-xs text-muted-foreground">
              Install from browser using Add to Home Screen.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-semibold">{col.title}</h3>
              <ul className="mt-4 space-y-3">
                {col.links.map((l) => (
                  <li key={l.to}>
                    <Link
                      to={l.to}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border/60 pt-6 text-sm text-muted-foreground md:flex-row">
          <p>© {new Date().getFullYear()} HeartConnect. Made for meaningful connection.</p>
          <p>Dating, with intention.</p>
        </div>
      </div>
    </footer>
  );
}
