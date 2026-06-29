import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { getActiveBanners, trackBannerEvent, type PublicBanner } from "@/lib/banners.functions";

/** Renders active banners for a placement and tracks impressions/clicks. */
export function PromoBanner({ placement = "home_top" }: { placement?: string }) {
  const [banners, setBanners] = useState<PublicBanner[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    getActiveBanners()
      .then((all) => {
        if (!active) return;
        const matched = all.filter((b) => b.placement === placement);
        setBanners(matched);
        for (const b of matched) {
          void trackBannerEvent({ data: { id: b.id, type: "impression" } }).catch(() => {});
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [placement]);

  const visible = banners.filter((b) => !dismissed.has(b.id));
  if (visible.length === 0) return null;

  const onClick = (b: PublicBanner) => {
    void trackBannerEvent({ data: { id: b.id, type: "click" } }).catch(() => {});
  };

  return (
    <div className="mx-auto max-w-6xl space-y-3 px-4 pt-4">
      {visible.map((b) => {
        const inner = b.imageUrl ? (
          <img
            src={b.imageUrl}
            alt={b.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-gradient-warm px-4 text-center font-display text-lg font-semibold">
            {b.title}
          </div>
        );
        return (
          <div key={b.id} className="relative overflow-hidden rounded-2xl border border-border">
            {b.linkUrl ? (
              <a
                href={b.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onClick(b)}
                className="block max-h-40"
                aria-label={b.title}
              >
                {inner}
              </a>
            ) : (
              <div className="max-h-40">{inner}</div>
            )}
            <button
              type="button"
              aria-label="Dismiss banner"
              onClick={() => setDismissed((d) => new Set(d).add(b.id))}
              className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-background/80 text-foreground hover:bg-background"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
