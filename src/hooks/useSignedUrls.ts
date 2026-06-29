import { useEffect, useState } from "react";
import { getSignedUrls } from "@/lib/storage";

/** Resolves an array of storage paths into a path->signedUrl map. */
export function useSignedUrls(paths: string[]) {
  const key = paths.join(",");
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    if (paths.length === 0) {
      setUrls({});
      return;
    }
    getSignedUrls(paths).then((map) => {
      if (active) setUrls(map);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return urls;
}
