import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Eye, Flag, ImageOff, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { scanImageContent } from "@/lib/safety.functions";
import {
  analyzeUrl,
  extractUrls,
  LINK_RISK_LABELS,
  type ImageScanResult,
  type LinkAnalysis,
} from "@/lib/moderation";
import { cn } from "@/lib/utils";

type Token = { text: string } | { url: string };

function tokenize(content: string, urls: string[]): Token[] {
  if (urls.length === 0) return [{ text: content }];
  const escaped = urls
    .slice()
    .sort((a, b) => b.length - a.length)
    .map((u) => u.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`(${escaped.join("|")})`, "g");
  return content
    .split(re)
    .filter((seg) => seg !== "")
    .map((seg) => (urls.includes(seg) ? { url: seg } : { text: seg }));
}

export function MessageContent({
  content,
  mine,
  onReport,
}: {
  content: string;
  mine: boolean;
  onReport?: (prefill: { reason?: string; details?: string }) => void;
}) {
  const urls = extractUrls(content);
  const analyses = urls.map(analyzeUrl);
  const imageLinks = analyses.filter((a) => a.isImage && a.risk !== "blocked");
  const tokens = tokenize(content, urls);
  const byUrl = new Map(analyses.map((a) => [a.url, a]));

  return (
    <>
      <p className="whitespace-pre-wrap break-words">
        {tokens.map((t, i) => {
          if ("text" in t) return <span key={i}>{t.text}</span>;
          const a = byUrl.get(t.url)!;
          return <LinkChip key={i} analysis={a} mine={mine} />;
        })}
      </p>
      {imageLinks.map((a) => (
        <ImagePreview key={a.href} analysis={a} onReport={onReport} />
      ))}
    </>
  );
}

function LinkChip({ analysis, mine }: { analysis: LinkAnalysis; mine: boolean }) {
  const { risk, href, url } = analysis;
  const title = analysis.reasons.join(" · ") || "External link";

  // Never make a dangerous link clickable.
  if (risk === "blocked") {
    return (
      <span
        title={title}
        className="mx-0.5 inline-flex items-center gap-1 rounded bg-destructive/15 px-1.5 py-0.5 align-baseline text-[0.85em] font-medium text-destructive"
      >
        <ShieldAlert className="h-3 w-3" /> {url}
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      title={title}
      className={cn(
        "mx-0.5 inline-flex items-center gap-1 align-baseline underline underline-offset-2",
        risk === "caution"
          ? "text-amber-700 decoration-amber-500/60 dark:text-amber-300"
          : mine
            ? "text-primary-foreground decoration-primary-foreground/50"
            : "text-primary decoration-primary/50",
      )}
    >
      {risk === "caution" && <ShieldAlert className="h-3 w-3" />}
      {url}
    </a>
  );
}

function ImagePreview({
  analysis,
  onReport,
}: {
  analysis: LinkAnalysis;
  onReport?: (prefill: { reason?: string; details?: string }) => void;
}) {
  const scan = useServerFn(scanImageContent);
  const [result, setResult] = useState<ImageScanResult | null>(null);
  const [scanning, setScanning] = useState(true);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    let active = true;
    setScanning(true);
    scan({ data: { url: analysis.href } })
      .then((r) => {
        if (active) setResult(r);
      })
      .catch(() => {
        if (active)
          setResult({ verdict: "flagged", categories: [], reason: "Could not verify image." });
      })
      .finally(() => {
        if (active) setScanning(false);
      });
    return () => {
      active = false;
    };
  }, [analysis.href, scan]);

  if (scanning) {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-background/40 px-3 py-3 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Scanning shared image for safety…
      </div>
    );
  }

  const verdict = result?.verdict ?? "flagged";

  if (verdict === "prohibited") {
    return (
      <div className="mt-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs">
        <p className="flex items-center gap-1.5 font-medium text-destructive">
          <ImageOff className="h-4 w-4" /> Image hidden — prohibited content
        </p>
        <p className="mt-1 text-muted-foreground">
          {result?.reason || "This image was blocked by safety moderation."}
        </p>
        <button
          type="button"
          onClick={() =>
            onReport?.({
              reason: "Inappropriate photos",
              details: `Prohibited shared image: ${analysis.href}`,
            })
          }
          className="mt-2 inline-flex items-center gap-1 font-medium text-primary hover:underline"
        >
          <Flag className="h-3 w-3" /> Report
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-border">
      <div className="relative">
        <img
          src={analysis.href}
          alt="Shared image"
          loading="lazy"
          className={cn(
            "max-h-64 w-full object-cover transition-[filter]",
            verdict === "flagged" && !revealed && "blur-xl",
          )}
        />
        {verdict === "flagged" && !revealed && (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-background/60 text-xs font-medium backdrop-blur-sm"
          >
            <Eye className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            Sensitive content — tap to view
          </button>
        )}
      </div>
      <div
        className={cn(
          "flex items-center justify-between gap-2 px-2.5 py-1.5 text-[10px]",
          verdict === "flagged"
            ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
            : "bg-muted/60 text-muted-foreground",
        )}
      >
        <span className="flex items-center gap-1">
          {verdict === "flagged" ? (
            <>
              <ShieldAlert className="h-3 w-3" /> {result?.reason || "Flagged for review"}
            </>
          ) : (
            <>
              <ShieldCheck className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /> Image
              scanned — no issues found
            </>
          )}
        </span>
        <button
          type="button"
          onClick={() =>
            onReport?.({
              reason: "Inappropriate photos",
              details: `Reported shared image: ${analysis.href}`,
            })
          }
          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
        >
          <Flag className="h-3 w-3" /> Report
        </button>
      </div>
    </div>
  );
}
