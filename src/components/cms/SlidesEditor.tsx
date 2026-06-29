import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CalendarClock,
  Check,
  Eye,
  EyeOff,
  GripVertical,
  Link2,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { MediaPicker } from "@/components/cms/MediaPicker";
import { HeroSlider } from "@/components/HeroSlider";
import { getMediaUrls } from "@/lib/site-media";
import type { HeroSlide } from "@/lib/cms-types";
import { safeHref } from "@/lib/utils";
import heroImage from "@/assets/hero-diverse.jpg";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface SlideRow {
  id: string;
  image_path: string | null;
  headline: string | null;
  subheadline: string | null;
  cta_label: string | null;
  cta_href: string | null;
  sort_order: number;
  is_published: boolean;
  starts_at: string | null;
  ends_at: string | null;
}

/** Convert an ISO timestamp to a value usable by <input type="datetime-local">. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Convert a datetime-local value back to an ISO string (or null when empty). */
function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function scheduleStatus(row: SlideRow): { label: string; tone: string } {
  if (!row.is_published) return { label: "Hidden", tone: "text-muted-foreground" };
  const now = Date.now();
  const start = row.starts_at ? new Date(row.starts_at).getTime() : null;
  const end = row.ends_at ? new Date(row.ends_at).getTime() : null;
  if (start && start > now)
    return { label: "Scheduled", tone: "text-amber-600 dark:text-amber-400" };
  if (end && end <= now) return { label: "Expired", tone: "text-destructive" };
  return { label: "Live", tone: "text-emerald-600 dark:text-emerald-400" };
}

export function SlidesEditor() {
  const [rows, setRows] = useState<SlideRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("hero_slides")
      .select(
        "id, image_path, headline, subheadline, cta_label, cta_href, sort_order, is_published, starts_at, ends_at",
      )
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) toast.error("Could not load slides.");
    setRows((data ?? []) as SlideRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const patch = (id: string, changes: Partial<SlideRow>) =>
    setRows((p) => p.map((r) => (r.id === id ? { ...r, ...changes } : r)));

  const add = async () => {
    const { error } = await supabase.from("hero_slides").insert({
      headline: "New slide",
      sort_order: rows.length,
    });
    if (error) return toast.error("Could not add slide.");
    toast.success("Slide added");
    load();
  };

  const save = async (row: SlideRow) => {
    if (row.starts_at && row.ends_at && new Date(row.ends_at) <= new Date(row.starts_at)) {
      return toast.error("End time must be after the start time.");
    }
    if (row.cta_href && row.cta_href.trim() && !safeHref(row.cta_href)) {
      return toast.error("Button link must be a valid http(s) or relative URL.");
    }
    setSavingId(row.id);
    const { error } = await supabase
      .from("hero_slides")
      .update({
        image_path: row.image_path,
        headline: row.headline,
        subheadline: row.subheadline,
        cta_label: row.cta_label,
        cta_href: row.cta_href,
        is_published: row.is_published,
        starts_at: row.starts_at,
        ends_at: row.ends_at,
      })
      .eq("id", row.id);
    setSavingId(null);
    if (error) return toast.error("Could not save slide.");
    toast.success("Slide saved");
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("hero_slides").delete().eq("id", id);
    if (error) return toast.error("Could not delete slide.");
    setRows((p) => p.filter((r) => r.id !== id));
  };

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = rows.findIndex((r) => r.id === active.id);
    const newIndex = rows.findIndex((r) => r.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(rows, oldIndex, newIndex);
    setRows(reordered);
    try {
      await Promise.all(
        reordered.map((r, i) =>
          supabase.from("hero_slides").update({ sort_order: i }).eq("id", r.id),
        ),
      );
      toast.success("Order updated");
    } catch {
      toast.error("Could not save the new order.");
    }
  };

  if (loading) {
    return (
      <div className="grid place-items-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Drag <GripVertical className="inline h-3.5 w-3.5 align-text-bottom" /> to reorder. Each
          slide can be scheduled to appear during a set time window.
        </p>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowPreview((v) => !v)} size="sm" variant="outline">
            {showPreview ? <EyeOff className="mr-1 h-4 w-4" /> : <Eye className="mr-1 h-4 w-4" />}
            {showPreview ? "Hide preview" : "Preview"}
          </Button>
          <Button onClick={add} size="sm">
            <Plus className="mr-1 h-4 w-4" /> Add slide
          </Button>
        </div>
      </div>

      {showPreview && <SliderPreview rows={rows} />}

      {rows.length === 0 && (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No slides yet — the homepage shows the default hero image. Add a slide to start the
          slider.
        </p>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-4">
            {rows.map((row) => (
              <SortableSlide
                key={row.id}
                row={row}
                saving={savingId === row.id}
                onChange={(c) => patch(row.id, c)}
                onSave={() => save(row)}
                onRemove={() => remove(row.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortableSlide({
  row,
  saving,
  onChange,
  onSave,
  onRemove,
}: {
  row: SlideRow;
  saving: boolean;
  onChange: (changes: Partial<SlideRow>) => void;
  onSave: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
  });
  const status = scheduleStatus(row);

  return (
    <Card
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "relative z-10 space-y-3 p-5 shadow-romantic" : "space-y-3 p-5"}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
            aria-label="Drag to reorder"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <span className={`text-xs font-medium ${status.tone}`}>{status.label}</span>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs">
            <Switch
              checked={row.is_published}
              onCheckedChange={(v) => onChange({ is_published: v })}
            />
            Published
          </label>
          <Button variant="ghost" size="icon" onClick={onRemove} className="text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <MediaPicker
        label="Slide image"
        value={row.image_path}
        folder="slides"
        onChange={(path) => onChange({ image_path: path })}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Headline (optional)">
          <Input
            value={row.headline ?? ""}
            onChange={(e) => onChange({ headline: e.target.value })}
          />
        </Field>
        <Field label="Subheadline (optional)">
          <Input
            value={row.subheadline ?? ""}
            onChange={(e) => onChange({ subheadline: e.target.value })}
          />
        </Field>
        <Field label="Button text (optional)">
          <Input
            value={row.cta_label ?? ""}
            onChange={(e) => onChange({ cta_label: e.target.value })}
          />
        </Field>
        <Field label="Button link (optional)">
          <Input
            value={row.cta_href ?? ""}
            onChange={(e) => onChange({ cta_href: e.target.value })}
          />
        </Field>
      </div>

      <div className="rounded-lg border border-border p-3">
        <p className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <CalendarClock className="h-4 w-4" /> Scheduled visibility (optional — leave blank to
          always show)
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Show from">
            <Input
              type="datetime-local"
              value={toLocalInput(row.starts_at)}
              onChange={(e) => onChange({ starts_at: fromLocalInput(e.target.value) })}
            />
          </Field>
          <Field label="Hide after">
            <Input
              type="datetime-local"
              value={toLocalInput(row.ends_at)}
              onChange={(e) => onChange({ ends_at: fromLocalInput(e.target.value) })}
            />
          </Field>
        </div>
      </div>

      <div className="flex justify-end pt-1">
        <Button onClick={onSave} disabled={saving} size="sm">
          {saving ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-1 h-4 w-4" />
          )}
          Save
        </Button>
      </div>
    </Card>
  );
}

function isActiveAt(row: SlideRow, at: number): boolean {
  if (!row.is_published) return false;
  const start = row.starts_at ? new Date(row.starts_at).getTime() : null;
  const end = row.ends_at ? new Date(row.ends_at).getTime() : null;
  if (start && start > at) return false;
  if (end && end <= at) return false;
  return true;
}

/**
 * Admin-only "time travel" preview. Renders the homepage slider exactly as it
 * would appear at a chosen moment, using the current (unsaved-to-public) slide
 * data — published flag plus scheduled start/end windows — without publishing.
 */
function SliderPreview({ rows }: { rows: SlideRow[] }) {
  const [previewAt, setPreviewAt] = useState(() => toLocalInput(new Date().toISOString()));
  const [media, setMedia] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const paths = rows.map((r) => r.image_path).filter((p): p is string => !!p);
    if (paths.length === 0) {
      setMedia({});
      return;
    }
    let active = true;
    getMediaUrls(paths).then((m) => {
      if (active) setMedia(m);
    });
    return () => {
      active = false;
    };
  }, [rows]);

  const at = previewAt ? new Date(previewAt).getTime() : Date.now();

  const slides: HeroSlide[] = useMemo(
    () =>
      rows
        .filter((r) => isActiveAt(r, Number.isNaN(at) ? Date.now() : at))
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

  const copyShareLink = async () => {
    const iso = previewAt ? new Date(previewAt).toISOString() : new Date().toISOString();
    const url = `${window.location.origin}/admin/preview?t=${encodeURIComponent(iso)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied to clipboard — opens for admins only.");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Could not copy. Link: " + url);
    }
  };

  return (
    <Card className="space-y-4 border-primary/30 bg-accent/30 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Eye className="h-4 w-4 text-primary" /> Live preview
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Showing the slider as it would appear at the chosen time. Nothing here is published.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <Field label="Preview at">
            <Input
              type="datetime-local"
              value={previewAt}
              onChange={(e) => setPreviewAt(e.target.value)}
              className="w-[15rem]"
            />
          </Field>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Reset to now"
            onClick={() => setPreviewAt(toLocalInput(new Date().toISOString()))}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant={copied ? "default" : "outline"}
            size="sm"
            onClick={copyShareLink}
            disabled={copied}
          >
            {copied ? (
              <>
                <Check className="mr-1 h-4 w-4" /> Copied
              </>
            ) : (
              <>
                <Link2 className="mr-1 h-4 w-4" /> Copy share link
              </>
            )}
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {slides.length === 0
          ? "No slides are visible at this time — the homepage would show the default hero image."
          : `${slides.length} slide${slides.length === 1 ? "" : "s"} visible at this time.`}
      </p>

      <div className="mx-auto max-w-sm">
        {slides.length > 0 ? (
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
          </div>
        )}
      </div>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
