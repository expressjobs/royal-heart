import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import type { HeroSlide, HomepageContent } from "@/lib/cms-types";
import { Button } from "@/components/ui/button";
import { cn, safeHref } from "@/lib/utils";

interface HeroSliderProps {
  slides: HeroSlide[];
  media: HomepageContent["media"];
  fallbackImage: string;
  /** Auto-advance interval in ms. */
  interval?: number;
}

/**
 * Accessible, auto-advancing homepage hero slider. Pauses on hover/focus and
 * respects prefers-reduced-motion. Falls back gracefully to a single image.
 */
export function HeroSlider({ slides, media, fallbackImage, interval = 6000 }: HeroSliderProps) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const go = useCallback(
    (next: number) => setIndex((prev) => (count === 0 ? 0 : (next + count) % count)),
    [count],
  );

  useEffect(() => {
    if (count <= 1 || paused) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    timer.current = setInterval(() => setIndex((p) => (p + 1) % count), interval);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [count, paused, interval]);

  // Keep index in range if the slide list shrinks (realtime updates).
  useEffect(() => {
    if (index >= count && count > 0) setIndex(0);
  }, [count, index]);

  return (
    <div
      className="relative"
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured highlights"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-warm blur-2xl" />
      <div className="relative overflow-hidden rounded-[2rem] shadow-romantic">
        <div className="relative aspect-[4/5] w-full">
          {slides.map((slide, i) => {
            const src = (slide.imagePath && media[slide.imagePath]) || fallbackImage;
            const active = i === index;
            return (
              <div
                key={slide.id}
                className={cn(
                  "absolute inset-0 transition-opacity duration-700 ease-out",
                  active ? "opacity-100" : "pointer-events-none opacity-0",
                )}
                aria-hidden={!active}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${count}`}
              >
                <img
                  src={src}
                  alt={slide.headline ?? "HeartConnect featured highlight"}
                  width={1152}
                  height={1440}
                  loading={i === 0 ? "eager" : "lazy"}
                  className="h-full w-full object-cover"
                />
                {(slide.headline || slide.subheadline || slide.ctaLabel) && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-6 md:p-8">
                    {slide.headline && (
                      <h2 className="font-display text-2xl font-semibold text-white md:text-3xl">
                        {slide.headline}
                      </h2>
                    )}
                    {slide.subheadline && (
                      <p className="mt-2 max-w-md text-sm text-white/85 md:text-base">
                        {slide.subheadline}
                      </p>
                    )}
                    {slide.ctaLabel && safeHref(slide.ctaHref) && (
                      <Button asChild variant="hero" size="sm" className="mt-4 rounded-full">
                        <a href={safeHref(slide.ctaHref)} rel="noopener noreferrer">
                          {slide.ctaLabel} <ArrowRight className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label="Previous slide"
            className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-background/80 text-foreground shadow-card backdrop-blur transition hover:bg-background"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Next slide"
            className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-background/80 text-foreground shadow-card backdrop-blur transition hover:bg-background"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2">
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => go(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === index}
                className={cn(
                  "h-2 rounded-full transition-all",
                  i === index ? "w-6 bg-white" : "w-2 bg-white/60 hover:bg-white/80",
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
