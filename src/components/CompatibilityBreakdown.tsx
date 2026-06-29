import { Heart, Sparkles, Target } from "lucide-react";
import { compatTone, type CompatBreakdown } from "@/lib/compatibility";
import { cn } from "@/lib/utils";

/** Detailed "Why we matched" compatibility breakdown shown on a profile. */
export function CompatibilityBreakdown({
  breakdown,
  name,
  className,
}: {
  breakdown: CompatBreakdown;
  name?: string | null;
  className?: string;
}) {
  const tone = compatTone(breakdown.score);
  const first = name?.split(" ")[0] || "this member";
  const shared = breakdown.shared_interests ?? [];

  return (
    <div className={cn("rounded-3xl border border-border bg-card p-5", className)}>
      <div className="flex items-center gap-3">
        <div
          className="relative grid h-16 w-16 shrink-0 place-items-center rounded-full"
          style={{
            background: `conic-gradient(hsl(var(--primary)) ${Math.round((breakdown.score / 100) * 360)}deg, hsl(var(--muted)) 0deg)`,
          }}
        >
          <span className="grid h-12 w-12 place-items-center rounded-full bg-card text-base font-bold tabular-nums">
            {breakdown.score}%
          </span>
        </div>
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 font-display text-lg font-semibold">
            <Sparkles className="h-4 w-4 text-primary" /> Why you matched
          </h3>
          <p className={cn("text-sm font-medium", tone.text)}>{tone.label}</p>
        </div>
      </div>

      {(shared.length > 0 || breakdown.shared_goal) && (
        <div className="mt-4 space-y-2">
          {breakdown.shared_goal && (
            <p className="flex items-center gap-2 text-sm">
              <Target className="h-4 w-4 text-primary" />
              You're both looking for the same kind of connection.
            </p>
          )}
          {shared.length > 0 && (
            <div>
              <p className="mb-1.5 flex items-center gap-2 text-sm text-muted-foreground">
                <Heart className="h-4 w-4 text-primary" /> Shared interests with {first}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {shared.map((i) => (
                  <span
                    key={i}
                    className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground"
                  >
                    {i}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {breakdown.explanation?.length ? (
        <div className="mt-4 rounded-2xl bg-muted/45 p-3">
          <p className="mb-2 text-sm font-medium">Excellent match because:</p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {breakdown.explanation.slice(0, 6).map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden="true">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 space-y-2.5">
        {breakdown.factors.map((f) => (
          <div key={f.key} className="flex items-center gap-3">
            <span className="w-28 shrink-0 truncate text-xs text-muted-foreground">{f.label}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${f.pct}%` }}
              />
            </div>
            <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
              {f.pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
