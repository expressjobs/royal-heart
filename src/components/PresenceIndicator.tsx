import { cn } from "@/lib/utils";
import { isAway } from "@/contexts/PresenceContext";

/** A small status dot: green = online, amber = away (idle), grey = offline. */
export function PresenceDot({
  online,
  lastActive,
  className,
}: {
  online: boolean;
  lastActive: string | null;
  className?: string;
}) {
  if (!online) return null;
  const away = isAway(online, lastActive);
  return (
    <span
      aria-hidden="true"
      className={cn(
        "block rounded-full ring-2 ring-card",
        away ? "bg-amber-500" : "bg-emerald-500",
        className,
      )}
    />
  );
}
