import { cn } from "@/lib/utils";
import logoMark from "@/assets/logo-mark.png";

export function Logo({
  className,
  showText = true,
  size = "md",
}: {
  className?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const dim = size === "lg" ? "h-10 w-10" : size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const text = size === "lg" ? "text-2xl" : size === "sm" ? "text-lg" : "text-xl";
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <img
        src={logoMark}
        alt="HeartConnect"
        width={40}
        height={40}
        loading="eager"
        decoding="async"
        className={cn("object-contain", dim)}
      />
      {showText && (
        <span className={cn("font-display font-semibold tracking-tight", text)}>
          Heart<span className="text-gradient-primary">Connect</span>
        </span>
      )}
    </div>
  );
}
