import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Returns href only if it is a safe link target. Allows http(s), mailto, tel,
 * and relative/anchor paths; rejects javascript:, data:, and other schemes
 * that could execute code. Use for any admin-managed / user-supplied URL.
 */
export function safeHref(href: string | null | undefined): string | undefined {
  if (!href) return undefined;
  const trimmed = href.trim();
  if (!trimmed) return undefined;
  // Relative paths and in-page anchors are safe.
  if (/^(\/|#|\.{1,2}\/)/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed, "https://placeholder.invalid");
    if (["http:", "https:", "mailto:", "tel:"].includes(url.protocol)) return trimmed;
  } catch {
    /* malformed URL — treat as unsafe */
  }
  return undefined;
}
