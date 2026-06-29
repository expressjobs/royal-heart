import { Sparkles } from "lucide-react";
import { compatTone } from "@/lib/compatibility";
import { cn } from "@/lib/utils";

/** Compact compatibility percentage badge for profile cards. */
export function CompatibilityBadge({
  score,
  className,
  variant = "pill",
}: {
  score: number | null | undefined;
  className?: string;
  variant?: "pill" | "ring";
}) {
  if (score == null) return null;
  const tone = compatTone(score);

  if (variant === "ring") {
    const deg = Math.round((score / 100) * 360);
    return (
      <div
        className={cn("relative grid h-12 w-12 place-items-center rounded-full", className)}
        style={{
          background: `conic-gradient(hsl(var(--primary)) ${deg}deg, hsl(var(--muted)) ${deg}deg)`,
        }}
        role="img"
        aria-label={`${score}% compatibility`}
      >
        <span className="grid h-9 w-9 place-items-center rounded-full bg-card text-xs font-bold tabular-nums">
          {score}
        </span>
      </div>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-xs font-semibold text-white backdrop-blur",
        className,
      )}
      aria-label={`${score}% compatibility — ${tone.label}`}
    >
      <Sparkles className="h-3 w-3" />
      {score}%
    </span>
  );
}
