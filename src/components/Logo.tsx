import { cn } from "@/lib/utils";
import logoMark from "@/assets/logo-mark.png";

export function Logo({
  className,
  showText = true,
  size = "md",
  text = "HeartConnect",
  imageSrc,
}: {
  className?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
  text?: string;
  imageSrc?: string | null;
}) {
  const dim = size === "lg" ? "h-10 w-10" : size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const textSize = size === "lg" ? "text-2xl" : size === "sm" ? "text-lg" : "text-xl";
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <img
        src={imageSrc || logoMark}
        alt={text}
        width={40}
        height={40}
        loading="eager"
        decoding="async"
        className={cn("object-contain", dim)}
      />
      {showText && (
        <span className={cn("font-display font-semibold tracking-tight", textSize)}>
          {text === "HeartConnect" ? (
            <>
              Heart<span className="text-gradient-primary">Connect</span>
            </>
          ) : (
            text
          )}
        </span>
      )}
    </div>
  );
}
