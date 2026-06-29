import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { getHeaderContent } from "@/lib/cms.functions";
import type { CmsLink } from "@/lib/cms-types";
import { safeHref } from "@/lib/utils";

const headerContentQuery = queryOptions({
  queryKey: ["site-header-content"],
  queryFn: () => getHeaderContent(),
  staleTime: 60 * 1000,
});

function enabledLinks(links: CmsLink[]): CmsLink[] {
  return links
    .filter((link) => link.isEnabled !== false && link.label.trim() && safeHref(link.href))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.label.localeCompare(b.label));
}

function HeaderLink({ link, onClick }: { link: CmsLink; onClick?: () => void }) {
  const href = safeHref(link.href) ?? "/";
  return (
    <a
      href={href}
      onClick={onClick}
      className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      {link.label}
    </a>
  );
}

export function SiteHeader({ overlay = false }: { overlay?: boolean }) {
  const { data: header } = useSuspenseQuery(headerContentQuery);
  const [open, setOpen] = useState(false);

  if (!header.isVisible) return null;

  const desktopLinks = enabledLinks(header.links);
  const mobileLinks = enabledLinks(header.mobileLinks.length > 0 ? header.mobileLinks : header.links);
  const loginHref = safeHref(header.loginHref) ?? "/auth";
  const joinHref = safeHref(header.joinHref) ?? "/auth?mode=signup";
  const announcementHref = safeHref(header.announcement.href);

  return (
    <header
      className={
        overlay
          ? "absolute inset-x-0 top-0 z-20"
          : "sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur-lg supports-[backdrop-filter]:bg-background/75"
      }
    >
      {header.announcement.enabled && header.announcement.text && (
        <div className="border-b border-border/60 bg-primary px-4 py-2 text-center text-sm text-primary-foreground">
          <span>{header.announcement.text}</span>
          {announcementHref && header.announcement.linkLabel && (
            <a href={announcementHref} className="ml-2 font-semibold underline underline-offset-4">
              {header.announcement.linkLabel}
            </a>
          )}
        </div>
      )}

      <div
        className={
          overlay
            ? "mx-auto flex h-16 max-w-6xl items-center justify-between rounded-b-2xl bg-background/70 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/50 md:bg-transparent md:backdrop-blur-none"
            : "mx-auto flex h-16 max-w-6xl items-center justify-between px-4"
        }
      >
        <Link to="/" aria-label={`${header.logoText || "HeartConnect"} home`}>
          <Logo text={header.logoText} imageSrc={header.logoImagePath} />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-5 md:flex">
          {desktopLinks.map((link) => (
            <HeaderLink key={`${link.label}-${link.href}`} link={link} />
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
          {header.loginLabel && (
            <Button asChild variant="ghost" className="rounded-full">
              <a href={loginHref}>{header.loginLabel}</a>
            </Button>
          )}
          {header.joinLabel && (
            <Button asChild variant="hero" className="rounded-full">
              <a href={joinHref}>{header.joinLabel}</a>
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="rounded-full"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border/60 bg-background px-4 py-4 shadow-lg md:hidden">
          <nav aria-label="Mobile navigation" className="mx-auto flex max-w-6xl flex-col gap-4">
            {mobileLinks.map((link) => (
              <HeaderLink
                key={`${link.label}-${link.href}`}
                link={link}
                onClick={() => setOpen(false)}
              />
            ))}
            <div className="grid gap-2 pt-2">
              {header.loginLabel && (
                <Button asChild variant="outline" className="rounded-full">
                  <a href={loginHref}>{header.loginLabel}</a>
                </Button>
              )}
              {header.joinLabel && (
                <Button asChild variant="hero" className="rounded-full">
                  <a href={joinHref}>{header.joinLabel}</a>
                </Button>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
