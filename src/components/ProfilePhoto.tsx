import { useEffect, useState } from "react";
import { User } from "lucide-react";
import { getSignedUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";

/** Displays a single stored photo path as a signed image. */
export function ProfilePhoto({
  path,
  alt,
  className,
  rounded = "rounded-2xl",
}: {
  path: string | null | undefined;
  alt: string;
  className?: string;
  rounded?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!path) {
      setUrl(null);
      return;
    }
    getSignedUrl(path).then((u) => active && setUrl(u));
    return () => {
      active = false;
    };
  }, [path]);

  if (!url) {
    return (
      <div
        className={cn(
          "grid place-items-center bg-gradient-to-br from-rose-50 via-slate-100 to-sky-100 text-slate-500 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800 dark:text-slate-300",
          rounded,
          className,
        )}
        role="img"
        aria-label={alt}
      >
        <div className="grid h-1/2 w-1/2 place-items-center rounded-full bg-white/70 shadow-inner dark:bg-white/10">
          <User className="h-1/2 w-1/2 opacity-70" />
        </div>
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      className={cn("h-full w-full object-cover", rounded, className)}
    />
  );
}
