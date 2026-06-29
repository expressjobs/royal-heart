import { BadgeCheck, Crown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizeMembershipTier, type MembershipTier } from "@/lib/membership";

export function TierBadge({ tier, className }: { tier: MembershipTier; className?: string }) {
  const publicTier = normalizeMembershipTier(tier);
  if (publicTier === "free") return null;
  const isGold = publicTier === "gold";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
        isGold
          ? "bg-gradient-gold text-gold-foreground"
          : "bg-gradient-platinum text-platinum-foreground",
        className,
      )}
    >
      {isGold ? <Sparkles className="h-3 w-3" /> : <Crown className="h-3 w-3" />}
      {isGold ? "Gold" : "Platinum"}
    </span>
  );
}

export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <BadgeCheck className={cn("h-5 w-5 text-primary", className)} aria-label="Verified profile" />
  );
}
