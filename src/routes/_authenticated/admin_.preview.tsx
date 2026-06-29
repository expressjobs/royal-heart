import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { AlertCircle, ArrowLeft, CalendarClock, Clock, Loader2, ShieldAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { requireMinRole } from "@/lib/admin-guard";
import { HeroSlider } from "@/components/HeroSlider";
import { getMediaUrls } from "@/lib/site-media";
import type { HeroSlide } from "@/lib/cms-types";
import heroImage from "@/assets/hero-diverse.jpg";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const previewSearchSchema = z.object({
  t: z.string().datetime().optional(),
});

interface SlideRow {
  id: string;
  image_path: string | null;
  headline: string | null;
  subheadline: string | null;
  cta_label: string | null;
  cta_href: string | null;
  is_published: boolean;
  starts_at: string | null;
  ends_at: string | null;
}

export const Route = createFileRoute("/_authenticated/admin_/preview")({
  ssr: false,
  beforeLoad: () => requireMinRole("admin"),
  validateSearch: zodValidator(previewSearchSchema),
  head: () => ({ meta: [{ title: "Slider Preview — HeartConnect Admin" }] }),
  component: PreviewPage,
});

function isActiveAt(row: SlideRow, at: number): boolean {
  if (!row.is_published) return false;
  const start = row.starts_at ? new Date(row.starts_at).getTime() : null;
  const end = row.ends_at ? new Date(row.ends_at).getTime() : null;
  if (start && start > at) return false;
  if (end && end <= at) return false;
  return true;
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function PreviewPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const { t } = Route.useSearch();
  const navigate = useNavigate();
  const [rows, setRows] = useState<SlideRow[]>([]);
  const [media, setMedia] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const at = useMemo(() => {
    if (!t) return null;
    const parsed = new Date(t).getTime();
    return Number.isNaN(parsed) ? null : parsed;
  }, [t]);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("hero_slides")
        .select(
          "id, image_path, headline, subheadline, cta_label, cta_href, is_published, starts_at, ends_at, sort_order, created_at",
        )
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (!active) return;
      const list = (data ?? []) as SlideRow[];
      setRows(list);
      const paths = list.map((r) => r.image_path).filter((p): p is string => !!p);
      if (paths.length) {
        const m = await getMediaUrls(paths);
        if (active) setMedia(m);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [isAdmin]);

  const slides: HeroSlide[] = useMemo(
    () =>
      at === null
        ? []
        : rows
            .filter((r) => isActiveAt(r, at))
            .map((r) => ({
              id: r.id,
              imagePath: r.image_path,
              headline: r.headline,
              subheadline: r.subheadline,
              ctaLabel: r.cta_label,
              ctaHref: r.cta_href,
            })),
    [rows, at],
  );

  if (authLoading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md px-4 text-center">
        <ShieldAlert className="mx-auto mt-20 h-12 w-12 text-muted-foreground" />
        <h1 className="mt-4 font-display text-xl font-semibold">Admins only</h1>
        <p className="mt-2 text-muted-foreground">
          This shared preview link can only be opened by team members with admin access.
        </p>
        <Button asChild className="mt-6" variant="outline">
          <Link to="/">Go to homepage</Link>
        </Button>
      </div>
    );
  }

  const timeMissing = !t || at === null;

  return (
    <div className="min-h-screen bg-muted/30 py-8">
      <div className="mx-auto max-w-md px-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin/content">
              <ArrowLeft className="mr-1 h-4 w-4" /> Back to editor
            </Link>
          </Button>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Clock className="h-3.5 w-3.5" />
            Preview
          </span>
        </div>

        <Card className="space-y-3 p-4">
          <div>
            <h1 className="font-display text-lg font-semibold">Homepage slider preview</h1>
            <p className="text-sm text-muted-foreground">
              {timeMissing ? (
                <>Pick a preview time to see how the slider will look at that moment.</>
              ) : (
                <>
                  Showing the slider as it would appear at{" "}
                  <strong className="text-foreground">{new Date(at).toLocaleString()}</strong>.
                  Nothing here is published.
                </>
              )}
            </p>
          </div>
          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <Label
                htmlFor="preview-at"
                className="flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <CalendarClock className="h-3.5 w-3.5" /> Preview at
              </Label>
              <Input
                id="preview-at"
                type="datetime-local"
                value={t ? toLocalInput(t) : ""}
                onChange={(e) => {
                  const iso = fromLocalInput(e.target.value);
                  if (iso) {
                    navigate({ to: "/admin/preview", search: { t: iso } } as never);
                  }
                }}
                className="w-[15rem]"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              aria-label="Use current time"
              onClick={() =>
                navigate({ to: "/admin/preview", search: { t: new Date().toISOString() } } as never)
              }
            >
              <Clock className="h-4 w-4" />
            </Button>
          </div>
        </Card>

        <div className="mt-6">
          {timeMissing ? (
            <div className="rounded-2xl border border-dashed border-muted-foreground/25 bg-muted/50 p-8 text-center">
              <AlertCircle className="mx-auto h-10 w-10 text-muted-foreground" />
              <h2 className="mt-4 font-display text-base font-semibold">
                Preview time is missing or invalid
              </h2>
              <p className="mt-2 max-w-xs mx-auto text-sm text-muted-foreground">
                This preview link needs a valid time parameter to show scheduled slides.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    navigate({
                      to: "/admin/preview",
                      search: { t: new Date().toISOString() },
                    } as never)
                  }
                >
                  <Clock className="mr-1.5 h-3.5 w-3.5" />
                  Use current time
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/admin/content">Open slider editor</Link>
                </Button>
              </div>
            </div>
          ) : loading ? (
            <div className="grid place-items-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : slides.length > 0 ? (
            <HeroSlider slides={slides} media={media} fallbackImage={heroImage} interval={4000} />
          ) : (
            <div className="relative">
              <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-warm blur-2xl" />
              <div className="overflow-hidden rounded-[2rem] shadow-romantic">
                <img
                  src={heroImage}
                  alt="Default homepage hero"
                  className="aspect-[4/5] w-full object-cover opacity-90"
                />
              </div>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                No slides are visible at this time — the homepage would show the default hero image.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
