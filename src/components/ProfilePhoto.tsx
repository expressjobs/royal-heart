import { useEffect, useRef, useState } from "react";
import { ImageOff, User } from "lucide-react";
import { getCachedSignedUrl, getSignedUrl, invalidateSignedUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";

type PhotoState =
  | { status: "missing"; url: null }
  | { status: "loading"; url: null }
  | { status: "ready"; url: string }
  | { status: "error"; url: null };

function initialPhotoState(path: string | null | undefined): PhotoState {
  if (!path) return { status: "missing", url: null };
  const cached = getCachedSignedUrl(path);
  return cached ? { status: "ready", url: cached } : { status: "loading", url: null };
}

/** Displays a single stored photo path as a signed image. */
export function ProfilePhoto({
  path,
  alt,
  className,
  rounded = "rounded-2xl",
  loading = "lazy",
}: {
  path: string | null | undefined;
  alt: string;
  className?: string;
  rounded?: string;
  loading?: "eager" | "lazy";
}) {
  const [photo, setPhoto] = useState<PhotoState>(() => initialPhotoState(path));
  const retryCount = useRef(0);

  useEffect(() => {
    let active = true;
    retryCount.current = 0;
    if (!path) {
      setPhoto({ status: "missing", url: null });
      return;
    }
    const cached = getCachedSignedUrl(path);
    if (cached) {
      setPhoto({ status: "ready", url: cached });
      return;
    }
    setPhoto({ status: "loading", url: null });
    getSignedUrl(path).then((url) => {
      if (!active) return;
      setPhoto(url ? { status: "ready", url } : { status: "error", url: null });
    });
    return () => {
      active = false;
    };
  }, [path]);

  if (photo.status === "missing") {
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

  if (photo.status === "loading") {
    return (
      <div
        className={cn("animate-pulse bg-muted", rounded, className)}
        role="img"
        aria-label={`Loading ${alt}`}
        aria-busy="true"
      />
    );
  }

  if (photo.status === "error") {
    return (
      <div
        className={cn("grid place-items-center bg-muted text-muted-foreground", rounded, className)}
        role="img"
        aria-label={`${alt} photo unavailable`}
      >
        <ImageOff className="h-10 w-10 opacity-60" />
      </div>
    );
  }

  return (
    <img
      src={photo.url}
      alt={alt}
      loading={loading}
      fetchPriority={loading === "eager" ? "high" : "auto"}
      className={cn("h-full w-full object-cover", rounded, className)}
      onError={() => {
        if (!path || retryCount.current >= 1) {
          setPhoto({ status: "error", url: null });
          return;
        }
        retryCount.current += 1;
        invalidateSignedUrl(path);
        setPhoto({ status: "loading", url: null });
        void getSignedUrl(path).then((url) => {
          setPhoto(url ? { status: "ready", url } : { status: "error", url: null });
        });
      }}
    />
  );
}
