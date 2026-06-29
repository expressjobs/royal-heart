import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/SiteFooter";

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
