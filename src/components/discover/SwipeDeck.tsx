import { useEffect } from "react";
import { SwipeCard } from "@/components/discover/SwipeCard";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
import type { SwipeDirection } from "@/hooks/useSwipeGesture";
import type { CompatBreakdown } from "@/lib/compatibility";
import type { ProfileWithPhotos } from "@/lib/profiles";

export function SwipeDeck({
  profiles,
  viewerCountry,
  breakdown,
  disabled,
  onLike,
  onPass,
  onOpenProfile,
}: {
  profiles: ProfileWithPhotos[];
  viewerCountry?: string | null;
  breakdown?: CompatBreakdown | null;
  disabled?: boolean;
  onLike: () => void;
  onPass: () => void;
  onOpenProfile: () => void;
}) {
  const current = profiles[0] ?? null;
  const gesture = useSwipeGesture({
    disabled: disabled || !current,
    onTap: onOpenProfile,
    onSwipe: (direction: SwipeDirection) => {
      if (direction === "right") onLike();
      if (direction === "left") onPass();
      if (direction === "up") onOpenProfile();
    },
  });

  useEffect(() => {
    if (!current) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        onLike();
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onPass();
      }
      if (event.key === "ArrowUp" || event.key === "Enter") {
        event.preventDefault();
        onOpenProfile();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [current, onLike, onOpenProfile, onPass]);

  return (
    <div className="relative min-h-[min(72vh,650px)] pb-3" aria-live="polite">
      {profiles
        .slice(0, 3)
        .slice()
        .reverse()
        .map((profile, reverseIndex, visible) => {
          const index = visible.length - reverseIndex - 1;
          const active = index === 0;
          return (
            <SwipeCard
              key={profile.id}
              profile={profile}
              viewerCountry={viewerCountry}
              breakdown={breakdown}
              active={active}
              stackIndex={index}
              offset={active ? gesture.offset : undefined}
              dragging={active ? gesture.dragging : false}
              bind={active ? gesture.bind : undefined}
            />
          );
        })}
    </div>
  );
}
