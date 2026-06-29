import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BanInfo {
  is_banned: boolean;
  banned_until: string | null;
}

export function isBannedNow(b: BanInfo | undefined | null): boolean {
  if (!b?.is_banned) return false;
  return !b.banned_until || new Date(b.banned_until) > new Date();
}

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
  accent?: "primary" | "gold" | "platinum" | "destructive";
}) {
  const tone =
    accent === "gold"
      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
      : accent === "platinum"
        ? "bg-violet-500/10 text-violet-600 dark:text-violet-400"
        : accent === "destructive"
          ? "bg-destructive/10 text-destructive"
          : "bg-accent text-primary";
  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <span className={cn("grid h-10 w-10 place-items-center rounded-2xl", tone)}>
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-3 font-display text-3xl font-semibold tabular-nums">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground/80">{hint}</p>}
    </div>
  );
}

export function PanelLoader() {
  return (
    <div className="grid h-40 place-items-center">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-3xl border border-dashed border-border bg-card/50 p-8 text-center text-muted-foreground">
      {children}
    </p>
  );
}
