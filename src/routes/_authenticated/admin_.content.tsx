import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import {
  ExternalLink,
  GripVertical,
  Image as ImageIcon,
  Loader2,
  Plus,
  Save,
  ShieldAlert,
  Star,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { requireMinRole } from "@/lib/admin-guard";
import { AppShell } from "@/components/AppShell";
import { MediaBrowser, MediaPicker } from "@/components/cms/MediaPicker";
import { SlidesEditor } from "@/components/cms/SlidesEditor";
import { BlogManager } from "@/components/admin/BlogManager";
import { DEFAULT_ABOUT, DEFAULT_HERO, DEFAULT_STATS } from "@/lib/cms-defaults";
import type { AboutContent, HeroContent, StatsContent } from "@/lib/cms-types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/admin_/content")({
  beforeLoad: () => requireMinRole("admin"),
  head: () => ({ meta: [{ title: "Website Content — HeartConnect Admin" }] }),
  component: () => (
    <AppShell>
      <ContentManager />
    </AppShell>
  ),
});

function ContentManager() {
  const { isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md text-center">
        <ShieldAlert className="mx-auto mt-10 h-12 w-12 text-muted-foreground" />
        <h1 className="mt-4 font-display text-xl font-semibold">Admins only</h1>
        <p className="mt-2 text-muted-foreground">You don't have access to this area.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Website Content</h1>
          <p className="text-sm text-muted-foreground">
            Manage the public homepage — no code required.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href="/" target="_blank" rel="noopener noreferrer">
            View homepage <ExternalLink className="ml-1 h-4 w-4" />
          </a>
        </Button>
      </div>

      <Tabs defaultValue="hero">
        <TabsList className="flex h-auto flex-wrap justify-start gap-1">
          <TabsTrigger value="hero">Hero</TabsTrigger>
          <TabsTrigger value="slider">Slider</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
          <TabsTrigger value="about">About</TabsTrigger>
          <TabsTrigger value="testimonials">Testimonials</TabsTrigger>
          <TabsTrigger value="stories">Success Stories</TabsTrigger>
          <TabsTrigger value="blog">Blog</TabsTrigger>
          <TabsTrigger value="media">Media Library</TabsTrigger>
        </TabsList>

        <TabsContent value="hero" className="mt-6">
          <HeroEditor />
        </TabsContent>
        <TabsContent value="slider" className="mt-6">
          <SlidesEditor />
        </TabsContent>
        <TabsContent value="stats" className="mt-6">
          <StatsEditor />
        </TabsContent>
        <TabsContent value="about" className="mt-6">
          <AboutEditor />
        </TabsContent>
        <TabsContent value="testimonials" className="mt-6">
          <TestimonialsEditor />
        </TabsContent>
        <TabsContent value="stories" className="mt-6">
          <StoriesEditor />
        </TabsContent>
        <TabsContent value="blog" className="mt-6">
          <BlogManager />
        </TabsContent>
        <TabsContent value="media" className="mt-6">
          <Card className="p-5">
            <h2 className="mb-1 flex items-center gap-2 font-semibold">
              <ImageIcon className="h-5 w-5 text-primary" /> Media Library
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Upload and reuse images across the whole site.
            </p>
            <MediaBrowser
              onSelect={() => toast.info("Use the section editors to place an image.")}
            />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

async function loadSection<T>(section: string, fallback: T): Promise<T> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", section)
    .maybeSingle();
  const row = data as { value?: unknown } | null;
  if (row?.value) return { ...fallback, ...(row.value as object) } as T;
  return fallback;
}

async function saveSection(section: string, data: unknown): Promise<boolean> {
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: section, value: data as never }, { onConflict: "key" });
  if (error) {
    toast.error("Could not save changes.");
    return false;
  }
  toast.success("Changes saved");
  return true;
}

function useSectionLoading() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  return { loading, setLoading, saving, setSaving };
}

function LoadingBlock() {
  return (
    <div className="grid place-items-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

/* ----------------------------- HERO ----------------------------- */
function HeroEditor() {
  const [hero, setHero] = useState<HeroContent>(DEFAULT_HERO);
  const { loading, setLoading, saving, setSaving } = useSectionLoading();

  useEffect(() => {
    loadSection("hero", DEFAULT_HERO).then((d) => {
      setHero(d);
      setLoading(false);
    });
  }, [setLoading]);

  const set = (k: keyof HeroContent, v: string | null) => setHero((p) => ({ ...p, [k]: v }));

  if (loading) return <LoadingBlock />;

  return (
    <Card className="space-y-4 p-5">
      <Field label="Badge text">
        <Input value={hero.badge} onChange={(e) => set("badge", e.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Headline (start)">
          <Input value={hero.titleLead} onChange={(e) => set("titleLead", e.target.value)} />
        </Field>
        <Field label="Headline (highlighted)">
          <Input
            value={hero.titleHighlight}
            onChange={(e) => set("titleHighlight", e.target.value)}
          />
        </Field>
        <Field label="Headline (end)">
          <Input value={hero.titleTail} onChange={(e) => set("titleTail", e.target.value)} />
        </Field>
      </div>
      <Field label="Subheadline">
        <Textarea
          value={hero.subtitle}
          onChange={(e) => set("subtitle", e.target.value)}
          rows={3}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Primary button text">
          <Input
            value={hero.ctaPrimaryLabel}
            onChange={(e) => set("ctaPrimaryLabel", e.target.value)}
          />
        </Field>
        <Field label="Primary button link">
          <Input
            value={hero.ctaPrimaryHref}
            onChange={(e) => set("ctaPrimaryHref", e.target.value)}
          />
        </Field>
        <Field label="Secondary button text">
          <Input
            value={hero.ctaSecondaryLabel}
            onChange={(e) => set("ctaSecondaryLabel", e.target.value)}
          />
        </Field>
        <Field label="Secondary button link">
          <Input
            value={hero.ctaSecondaryHref}
            onChange={(e) => set("ctaSecondaryHref", e.target.value)}
          />
        </Field>
      </div>
      <Field label="Small note under buttons">
        <Input value={hero.note} onChange={(e) => set("note", e.target.value)} />
      </Field>
      <MediaPicker
        label="Hero image"
        value={hero.imagePath}
        folder="hero"
        onChange={(p) => set("imagePath", p)}
      />
      <SaveBar
        saving={saving}
        onSave={async () => {
          setSaving(true);
          await saveSection("hero", hero);
          setSaving(false);
        }}
      />
    </Card>
  );
}

/* ----------------------------- STATS ----------------------------- */
function StatsEditor() {
  const [stats, setStats] = useState<StatsContent>(DEFAULT_STATS);
  const { loading, setLoading, saving, setSaving } = useSectionLoading();

  useEffect(() => {
    loadSection("stats", DEFAULT_STATS).then((d) => {
      setStats(d.items?.length ? d : DEFAULT_STATS);
      setLoading(false);
    });
  }, [setLoading]);

  if (loading) return <LoadingBlock />;

  const update = (i: number, key: "value" | "label", v: string) =>
    setStats((p) => ({
      items: p.items.map((it, idx) => (idx === i ? { ...it, [key]: v } : it)),
    }));

  return (
    <Card className="space-y-4 p-5">
      <p className="text-sm text-muted-foreground">
        Edit the four highlighted numbers on the homepage.
      </p>
      {stats.items.map((it, i) => (
        <div key={i} className="grid gap-3 sm:grid-cols-2">
          <Field label={`Value ${i + 1}`}>
            <Input value={it.value} onChange={(e) => update(i, "value", e.target.value)} />
          </Field>
          <Field label={`Label ${i + 1}`}>
            <Input value={it.label} onChange={(e) => update(i, "label", e.target.value)} />
          </Field>
        </div>
      ))}
      <SaveBar
        saving={saving}
        onSave={async () => {
          setSaving(true);
          await saveSection("stats", stats);
          setSaving(false);
        }}
      />
    </Card>
  );
}

/* ----------------------------- ABOUT ----------------------------- */
function AboutEditor() {
  const [about, setAbout] = useState<AboutContent>(DEFAULT_ABOUT);
  const { loading, setLoading, saving, setSaving } = useSectionLoading();

  useEffect(() => {
    loadSection("about", DEFAULT_ABOUT).then((d) => {
      setAbout(d);
      setLoading(false);
    });
  }, [setLoading]);

  if (loading) return <LoadingBlock />;

  const set = (k: keyof AboutContent, v: string | boolean | null) =>
    setAbout((p) => ({ ...p, [k]: v }));

  return (
    <Card className="space-y-4 p-5">
      <label className="flex items-center justify-between rounded-lg border border-border p-3">
        <span className="text-sm font-medium">Show the About section on the homepage</span>
        <Switch checked={about.enabled} onCheckedChange={(v) => set("enabled", v)} />
      </label>
      <Field label="Eyebrow (small label)">
        <Input value={about.eyebrow} onChange={(e) => set("eyebrow", e.target.value)} />
      </Field>
      <Field label="Title">
        <Input value={about.title} onChange={(e) => set("title", e.target.value)} />
      </Field>
      <Field label="Description">
        <Textarea
          value={about.description}
          onChange={(e) => set("description", e.target.value)}
          rows={4}
        />
      </Field>
      <MediaPicker
        label="About image"
        value={about.imagePath}
        folder="about"
        onChange={(p) => set("imagePath", p)}
      />
      <SaveBar
        saving={saving}
        onSave={async () => {
          setSaving(true);
          await saveSection("about", about);
          setSaving(false);
        }}
      />
    </Card>
  );
}

/* ----------------------------- TESTIMONIALS ----------------------------- */
interface TRow {
  id: string;
  name: string;
  country: string | null;
  quote: string;
  rating: number;
  photo_path: string | null;
  sort_order: number;
  is_published: boolean;
}

function TestimonialsEditor() {
  const [rows, setRows] = useState<TRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("testimonials")
      .select("id, name, country, quote, rating, photo_path, sort_order, is_published")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    setRows((data ?? []) as TRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    const { error } = await supabase.from("testimonials").insert({
      name: "New testimonial",
      quote: "Share what this member loved about HeartConnect.",
      rating: 5,
      sort_order: rows.length,
    });
    if (error) return toast.error("Could not add testimonial.");
    toast.success("Testimonial added");
    load();
  };

  const save = async (row: TRow) => {
    const { error } = await supabase
      .from("testimonials")
      .update({
        name: row.name,
        country: row.country,
        quote: row.quote,
        rating: row.rating,
        photo_path: row.photo_path,
        is_published: row.is_published,
      })
      .eq("id", row.id);
    if (error) return toast.error("Could not save testimonial.");
    toast.success("Saved");
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("testimonials").delete().eq("id", id);
    if (error) return toast.error("Could not delete.");
    setRows((p) => p.filter((r) => r.id !== id));
  };

  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= rows.length) return;
    const reordered = [...rows];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setRows(reordered);
    await Promise.all(
      reordered.map((r, i) =>
        supabase.from("testimonials").update({ sort_order: i }).eq("id", r.id),
      ),
    );
  };

  if (loading) return <LoadingBlock />;

  return (
    <div className="space-y-4">
      <Button onClick={add} size="sm">
        <Plus className="mr-1 h-4 w-4" /> Add testimonial
      </Button>
      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No testimonials yet — the homepage is showing sample defaults. Add one to override them.
        </p>
      )}
      {rows.map((row, i) => (
        <Card key={row.id} className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-muted-foreground">
              <GripVertical className="h-4 w-4" />
              <ReorderButtons
                onUp={() => move(i, -1)}
                onDown={() => move(i, 1)}
                first={i === 0}
                last={i === rows.length - 1}
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs">
                <Switch
                  checked={row.is_published}
                  onCheckedChange={(v) =>
                    setRows((p) => p.map((r) => (r.id === row.id ? { ...r, is_published: v } : r)))
                  }
                />
                Published
              </label>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => remove(row.id)}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <Input
                value={row.name}
                onChange={(e) =>
                  setRows((p) =>
                    p.map((r) => (r.id === row.id ? { ...r, name: e.target.value } : r)),
                  )
                }
              />
            </Field>
            <Field label="Country / location">
              <Input
                value={row.country ?? ""}
                onChange={(e) =>
                  setRows((p) =>
                    p.map((r) => (r.id === row.id ? { ...r, country: e.target.value } : r)),
                  )
                }
              />
            </Field>
          </div>
          <Field label="Quote">
            <Textarea
              value={row.quote}
              rows={2}
              onChange={(e) =>
                setRows((p) =>
                  p.map((r) => (r.id === row.id ? { ...r, quote: e.target.value } : r)),
                )
              }
            />
          </Field>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <Field label="Rating">
              <RatingPicker
                value={row.rating}
                onChange={(v) =>
                  setRows((p) => p.map((r) => (r.id === row.id ? { ...r, rating: v } : r)))
                }
              />
            </Field>
            <MediaPicker
              label="Photo"
              value={row.photo_path}
              folder="testimonials"
              onChange={(path) =>
                setRows((p) => p.map((r) => (r.id === row.id ? { ...r, photo_path: path } : r)))
              }
            />
          </div>
          <SaveBar saving={false} onSave={() => save(row)} />
        </Card>
      ))}
    </div>
  );
}

/* ----------------------------- SUCCESS STORIES ----------------------------- */
interface SRow {
  id: string;
  title: string;
  couple_names: string | null;
  body: string;
  image_path: string | null;
  sort_order: number;
  is_published: boolean;
}

function StoriesEditor() {
  const [rows, setRows] = useState<SRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("success_stories")
      .select("id, title, couple_names, body, image_path, sort_order, is_published")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    setRows((data ?? []) as SRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    const { error } = await supabase.from("success_stories").insert({
      title: "New success story",
      body: "Tell the story of how this couple met on HeartConnect.",
      sort_order: rows.length,
    });
    if (error) return toast.error("Could not add story.");
    toast.success("Story added");
    load();
  };

  const save = async (row: SRow) => {
    const { error } = await supabase
      .from("success_stories")
      .update({
        title: row.title,
        couple_names: row.couple_names,
        body: row.body,
        image_path: row.image_path,
        is_published: row.is_published,
      })
      .eq("id", row.id);
    if (error) return toast.error("Could not save story.");
    toast.success("Saved");
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("success_stories").delete().eq("id", id);
    if (error) return toast.error("Could not delete.");
    setRows((p) => p.filter((r) => r.id !== id));
  };

  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= rows.length) return;
    const reordered = [...rows];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setRows(reordered);
    await Promise.all(
      reordered.map((r, i) =>
        supabase.from("success_stories").update({ sort_order: i }).eq("id", r.id),
      ),
    );
  };

  if (loading) return <LoadingBlock />;

  return (
    <div className="space-y-4">
      <Button onClick={add} size="sm">
        <Plus className="mr-1 h-4 w-4" /> Add success story
      </Button>
      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No stories yet — the homepage is showing sample defaults. Add one to override them.
        </p>
      )}
      {rows.map((row, i) => (
        <Card key={row.id} className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-muted-foreground">
              <GripVertical className="h-4 w-4" />
              <ReorderButtons
                onUp={() => move(i, -1)}
                onDown={() => move(i, 1)}
                first={i === 0}
                last={i === rows.length - 1}
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs">
                <Switch
                  checked={row.is_published}
                  onCheckedChange={(v) =>
                    setRows((p) => p.map((r) => (r.id === row.id ? { ...r, is_published: v } : r)))
                  }
                />
                Published
              </label>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => remove(row.id)}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Title">
              <Input
                value={row.title}
                onChange={(e) =>
                  setRows((p) =>
                    p.map((r) => (r.id === row.id ? { ...r, title: e.target.value } : r)),
                  )
                }
              />
            </Field>
            <Field label="Couple names">
              <Input
                value={row.couple_names ?? ""}
                onChange={(e) =>
                  setRows((p) =>
                    p.map((r) => (r.id === row.id ? { ...r, couple_names: e.target.value } : r)),
                  )
                }
              />
            </Field>
          </div>
          <Field label="Story">
            <Textarea
              value={row.body}
              rows={3}
              onChange={(e) =>
                setRows((p) => p.map((r) => (r.id === row.id ? { ...r, body: e.target.value } : r)))
              }
            />
          </Field>
          <MediaPicker
            label="Story image"
            value={row.image_path}
            folder="stories"
            onChange={(path) =>
              setRows((p) => p.map((r) => (r.id === row.id ? { ...r, image_path: path } : r)))
            }
          />
          <SaveBar saving={false} onSave={() => save(row)} />
        </Card>
      ))}
    </div>
  );
}

/* ----------------------------- SHARED UI ----------------------------- */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function SaveBar({ saving, onSave }: { saving: boolean; onSave: () => void }) {
  return (
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
  );
}

function ReorderButtons({
  onUp,
  onDown,
  first,
  last,
}: {
  onUp: () => void;
  onDown: () => void;
  first: boolean;
  last: boolean;
}) {
  return (
    <span className="flex gap-1">
      <Button variant="outline" size="sm" className="h-7 px-2" onClick={onUp} disabled={first}>
        ↑
      </Button>
      <Button variant="outline" size="sm" className="h-7 px-2" onClick={onDown} disabled={last}>
        ↓
      </Button>
    </span>
  );
}

function RatingPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)} aria-label={`${n} stars`}>
          <Star
            className={n <= value ? "h-6 w-6 text-primary" : "h-6 w-6 text-muted-foreground/40"}
            fill={n <= value ? "currentColor" : "none"}
          />
        </button>
      ))}
    </div>
  );
}
