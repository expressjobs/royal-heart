import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Logo } from "@/components/Logo";
import { getFooterContent, getSiteSettingsContent } from "@/lib/cms.functions";
import { safeHref } from "@/lib/utils";

const footerContentQuery = queryOptions({
  queryKey: ["site-footer-content"],
  queryFn: () => getFooterContent(),
  staleTime: 60 * 1000,
});

const siteSettingsQuery = queryOptions({
  queryKey: ["site-settings"],
  queryFn: () => getSiteSettingsContent(),
  staleTime: 60 * 1000,
});

export function SiteFooter() {
  const { data: footer } = useSuspenseQuery(footerContentQuery);
  const { data: settings } = useSuspenseQuery(siteSettingsQuery);
  const socialLinks = (footer.socialLinks?.length ? footer.socialLinks : settings.socialLinks)
    .filter((link) => link.isEnabled !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <footer className="border-t border-border/60 bg-card/40">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-10 md:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div>
            <Logo text={settings.brand.logoText} imageSrc={settings.brand.logoImagePath} />
            {footer.description && (
              <p className="mt-4 max-w-xs text-sm text-muted-foreground">{footer.description}</p>
            )}
            {footer.installNote && (
              <p className="mt-3 max-w-xs text-xs text-muted-foreground">{footer.installNote}</p>
            )}
            {socialLinks.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
                {socialLinks.map((link) => {
                  const href = safeHref(link.href);
                  if (!href) return null;
                  return (
                    <a
                      key={`${link.label}-${href}`}
                      href={href}
                      className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </a>
                  );
                })}
              </div>
            )}
            {settings.contact.supportEmail && (
              <a
                href={`mailto:${settings.contact.supportEmail}`}
                className="mt-4 inline-block text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {settings.contact.supportEmail}
              </a>
            )}
          </div>
          {footer.columns.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-semibold">{col.title}</h3>
              <ul className="mt-4 space-y-3">
                {col.links.map((link) => {
                  const href = safeHref(link.href) ?? "/";
                  return (
                    <li key={`${link.label}-${href}`}>
                      <a
                        href={href}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border/60 pt-6 text-sm text-muted-foreground md:flex-row">
          <p>
            © {new Date().getFullYear()} {footer.copyright}
          </p>
          {footer.tagline && <p>{footer.tagline}</p>}
        </div>
      </div>
    </footer>
  );
}
