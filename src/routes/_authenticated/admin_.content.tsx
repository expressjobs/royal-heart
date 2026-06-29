import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
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
import { useAuth } from "@/contexts/AuthContext";
import { requireMinRole } from "@/lib/admin-guard";
import { AppShell } from "@/components/AppShell";
import { MediaBrowser, MediaPicker } from "@/components/cms/MediaPicker";
import { SlidesEditor } from "@/components/cms/SlidesEditor";
import { BlogManager } from "@/components/admin/BlogManager";
import {
  createCmsRecord,
  deleteCmsRecord,
  getSuperAdminCmsSnapshot,
  reorderCmsRecords,
  saveSiteContentSection,
  updateCmsRecord,
  type AdminCmsSnapshot,
} from "@/lib/cms.functions";
import { DEFAULT_INFO_PAGES } from "@/lib/cms-defaults";
import type {
  AboutContent,
  ContactChannel,
  FeatureCard,
  FeaturesContent,
  FooterColumn,
  FooterContent,
  HeroContent,
  InfoPageContent,
  InfoPageSection,
  StatsContent,
} from "@/lib/cms-types";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/admin_/content")({
  beforeLoad: () => requireMinRole("super_admin"),
  head: () => ({ meta: [{ title: "Website Content - HeartConnect Admin" }] }),
  component: () => (
    <AppShell>
      <ContentManager />
    </AppShell>
  ),
});

type TestimonialRow = Database["public"]["Tables"]["testimonials"]["Row"];
type StoryRow = Database["public"]["Tables"]["success_stories"]["Row"];

const PAGE_LABELS: Record<string, string> = {
  about: "About Us",
  safety: "Safety Center",
  "community-guidelines": "Community Guidelines",
  "verification-policy": "Verification Policy",
  "blocking-reporting": "Blocking & Reporting",
  "report-abuse": "Report Abuse",
  privacy: "Privacy Policy",
  terms: "Terms of Service",
  "cookie-policy": "Cookie Policy",
  "refund-policy": "Refund Policy",
  "subscription-billing-policy": "Subscription & Billing Policy",
  "data-deletion": "Data Deletion / Account Deletion",
  contact: "Contact Us",
  help: "Help Center / FAQ",
};

const FEATURE_ICONS = [
  "search",
  "heart",
  "messages",
  "badge",
  "shield",
  "sparkles",
  "globe",
  "users",
] as const;

function ContentManager() {
  const { isSuperAdmin, loading: authLoading } = useAuth();
  const snapshotFn = useServerFn(getSuperAdminCmsSnapshot);
  const [snapshot, setSnapshot] = useState<AdminCmsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSnapshot(await snapshotFn());
    } catch {
      toast.error("Could not load CMS content.");
    } finally {
      setLoading(false);
    }
  }, [snapshotFn]);

  useEffect(() => {
    if (isSuperAdmin) void load();
  }, [isSuperAdmin, load]);

  if (authLoading || loading) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isSuperAdmin || !snapshot) {
    return (
      <div className="mx-auto max-w-md text-center">
        <ShieldAlert className="mx-auto mt-10 h-12 w-12 text-muted-foreground" />
        <h1 className="mt-4 font-display text-xl font-semibold">Super admins only</h1>
        <p className="mt-2 text-muted-foreground">Only super admins can edit website content.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Website Content</h1>
          <p className="text-sm text-muted-foreground">
            Super-admin CMS for public pages, homepage sections, media, and blog posts.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href="/" target="_blank" rel="noopener noreferrer">
            View site <ExternalLink className="ml-1 h-4 w-4" />
          </a>
        </Button>
      </div>

      <Tabs defaultValue="homepage">
        <TabsList className="flex h-auto flex-wrap justify-start gap-1">
          <TabsTrigger value="homepage">Homepage</TabsTrigger>
          <TabsTrigger value="slider">Hero Slider</TabsTrigger>
          <TabsTrigger value="testimonials">Testimonials</TabsTrigger>
          <TabsTrigger value="stories">Success Stories</TabsTrigger>
          <TabsTrigger value="footer">Footer</TabsTrigger>
          <TabsTrigger value="pages">Pages</TabsTrigger>
          <TabsTrigger value="blog">Blog</TabsTrigger>
          <TabsTrigger value="media">Media</TabsTrigger>
        </TabsList>

        <TabsContent value="homepage" className="mt-6">
          <HomepageEditor snapshot={snapshot} onReload={load} />
        </TabsContent>
        <TabsContent value="slider" className="mt-6">
          <SlidesEditor />
        </TabsContent>
        <TabsContent value="testimonials" className="mt-6">
          <TestimonialsEditor rows={snapshot.testimonials} onReload={load} />
        </TabsContent>
        <TabsContent value="stories" className="mt-6">
          <StoriesEditor rows={snapshot.stories} onReload={load} />
        </TabsContent>
        <TabsContent value="footer" className="mt-6">
          <FooterEditor initial={snapshot.sections.footer} />
        </TabsContent>
        <TabsContent value="pages" className="mt-6">
          <PagesEditor pages={snapshot.sections.pages} />
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
              Upload and reuse images across the public website.
            </p>
            <MediaBrowser onSelect={() => toast.info("Use a section editor to place an image.")} />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function HomepageEditor({
  snapshot,
  onReload,
}: {
  snapshot: AdminCmsSnapshot;
  onReload: () => void;
}) {
  return (
    <div className="space-y-5">
      <HeroEditor initial={snapshot.sections.hero} />
      <StatsEditor initial={snapshot.sections.stats} />
      <AboutEditor initial={snapshot.sections.about} />
      <FeaturesEditor initial={snapshot.sections.features} onReload={onReload} />
    </div>
  );
}

function useSaveSection(section: string) {
  const saveFn = useServerFn(saveSiteContentSection);
  const [saving, setSaving] = useState(false);
  const save = async (data: unknown) => {
    setSaving(true);
    try {
      const result = await saveFn({ data: { section, data } });
      if (!result.ok) {
        toast.error(result.error ?? "Could not save changes.");
        return false;
      }
      toast.success("Changes saved");
      return true;
    } catch {
      toast.error("Could not save changes.");
      return false;
    } finally {
      setSaving(false);
    }
  };
  return { saving, save };
}

function HeroEditor({ initial }: { initial: HeroContent }) {
  const [hero, setHero] = useState(initial);
  const { saving, save } = useSaveSection("hero");
  const set = (key: keyof HeroContent, value: string | null) =>
    setHero((prev) => ({ ...prev, [key]: value }));

  return (
    <Card className="space-y-4 p-5">
      <SectionTitle title="Homepage hero" />
      <Field label="Badge text">
        <Input value={hero.badge} onChange={(e) => set("badge", e.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Title start">
          <Input value={hero.titleLead} onChange={(e) => set("titleLead", e.target.value)} />
        </Field>
        <Field label="Title highlight">
          <Input
            value={hero.titleHighlight}
            onChange={(e) => set("titleHighlight", e.target.value)}
          />
        </Field>
        <Field label="Title end">
          <Input value={hero.titleTail} onChange={(e) => set("titleTail", e.target.value)} />
        </Field>
      </div>
      <Field label="Subtitle">
        <Textarea
          value={hero.subtitle}
          rows={3}
          onChange={(e) => set("subtitle", e.target.value)}
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
      <Field label="Note under buttons">
        <Input value={hero.note} onChange={(e) => set("note", e.target.value)} />
      </Field>
      <MediaPicker
        label="Hero image"
        value={hero.imagePath}
        folder="hero"
        onChange={(path) => set("imagePath", path)}
      />
      <SaveBar saving={saving} onSave={() => void save(hero)} />
    </Card>
  );
}

function StatsEditor({ initial }: { initial: StatsContent }) {
  const [stats, setStats] = useState(initial);
  const { saving, save } = useSaveSection("stats");
  const update = (index: number, key: "value" | "label", value: string) =>
    setStats((prev) => ({
      items: prev.items.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
    }));

  return (
    <Card className="space-y-4 p-5">
      <SectionTitle title="Homepage stats" />
      {stats.items.map((item, index) => (
        <div key={index} className="grid gap-3 sm:grid-cols-2">
          <Field label={`Value ${index + 1}`}>
            <Input value={item.value} onChange={(e) => update(index, "value", e.target.value)} />
          </Field>
          <Field label={`Label ${index + 1}`}>
            <Input value={item.label} onChange={(e) => update(index, "label", e.target.value)} />
          </Field>
        </div>
      ))}
      <SaveBar saving={saving} onSave={() => void save(stats)} />
    </Card>
  );
}

function AboutEditor({ initial }: { initial: AboutContent }) {
  const [about, setAbout] = useState(initial);
  const { saving, save } = useSaveSection("about");
  const set = (key: keyof AboutContent, value: string | boolean | null) =>
    setAbout((prev) => ({ ...prev, [key]: value }));

  return (
    <Card className="space-y-4 p-5">
      <SectionTitle title="Homepage about section" />
      <label className="flex items-center justify-between rounded-lg border border-border p-3">
        <span className="text-sm font-medium">Show this section</span>
        <Switch checked={about.enabled} onCheckedChange={(value) => set("enabled", value)} />
      </label>
      <Field label="Eyebrow">
        <Input value={about.eyebrow} onChange={(e) => set("eyebrow", e.target.value)} />
      </Field>
      <Field label="Title">
        <Input value={about.title} onChange={(e) => set("title", e.target.value)} />
      </Field>
      <Field label="Description">
        <Textarea
          value={about.description}
          rows={4}
          onChange={(e) => set("description", e.target.value)}
        />
      </Field>
      <MediaPicker
        label="About image"
        value={about.imagePath}
        folder="about"
        onChange={(path) => set("imagePath", path)}
      />
      <SaveBar saving={saving} onSave={() => void save(about)} />
    </Card>
  );
}

function FeaturesEditor({ initial }: { initial: FeaturesContent; onReload: () => void }) {
  const [features, setFeatures] = useState(initial);
  const { saving, save } = useSaveSection("features");
  const updateItem = (index: number, patch: Partial<FeatureCard>) =>
    setFeatures((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));

  return (
    <Card className="space-y-4 p-5">
      <SectionTitle title="Feature cards" />
      <Field label="Section title">
        <Input
          value={features.title}
          onChange={(e) => setFeatures((prev) => ({ ...prev, title: e.target.value }))}
        />
      </Field>
      <Field label="Section subtitle">
        <Textarea
          value={features.subtitle}
          rows={2}
          onChange={(e) => setFeatures((prev) => ({ ...prev, subtitle: e.target.value }))}
        />
      </Field>
      {features.items.map((item, index) => (
        <div key={index} className="space-y-3 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between gap-3">
            <Field label="Icon">
              <Select value={item.icon} onValueChange={(icon) => updateItem(index, { icon })}>
                <SelectTrigger className="w-[12rem]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FEATURE_ICONS.map((icon) => (
                    <SelectItem key={icon} value={icon}>
                      {icon}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <label className="flex items-center gap-2 text-xs">
              <Switch
                checked={item.isEnabled}
                onCheckedChange={(isEnabled) => updateItem(index, { isEnabled })}
              />
              Enabled
            </label>
          </div>
          <Field label="Title">
            <Input
              value={item.title}
              onChange={(e) => updateItem(index, { title: e.target.value })}
            />
          </Field>
          <Field label="Description">
            <Textarea
              value={item.description}
              rows={2}
              onChange={(e) => updateItem(index, { description: e.target.value })}
            />
          </Field>
        </div>
      ))}
      <div className="flex justify-between">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setFeatures((prev) => ({
              ...prev,
              items: [
                ...prev.items,
                { icon: "heart", title: "New feature", description: "", isEnabled: true },
              ],
            }))
          }
        >
          <Plus className="mr-1 h-4 w-4" /> Add feature
        </Button>
        <SaveBar saving={saving} onSave={() => void save(features)} />
      </div>
    </Card>
  );
}

function FooterEditor({ initial }: { initial: FooterContent }) {
  const [footer, setFooter] = useState(initial);
  const { saving, save } = useSaveSection("footer");

  return (
    <Card className="space-y-4 p-5">
      <SectionTitle title="Footer content and links" />
      <Field label="Description">
        <Textarea
          value={footer.description}
          rows={3}
          onChange={(e) => setFooter((prev) => ({ ...prev, description: e.target.value }))}
        />
      </Field>
      <Field label="Install note">
        <Input
          value={footer.installNote}
          onChange={(e) => setFooter((prev) => ({ ...prev, installNote: e.target.value }))}
        />
      </Field>
      <div className="grid gap-4 md:grid-cols-3">
        {footer.columns.map((column, index) => (
          <FooterColumnEditor
            key={index}
            column={column}
            onChange={(next) =>
              setFooter((prev) => ({
                ...prev,
                columns: prev.columns.map((col, i) => (i === index ? next : col)),
              }))
            }
          />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Copyright text">
          <Input
            value={footer.copyright}
            onChange={(e) => setFooter((prev) => ({ ...prev, copyright: e.target.value }))}
          />
        </Field>
        <Field label="Tagline">
          <Input
            value={footer.tagline}
            onChange={(e) => setFooter((prev) => ({ ...prev, tagline: e.target.value }))}
          />
        </Field>
      </div>
      <SaveBar saving={saving} onSave={() => void save(footer)} />
    </Card>
  );
}

function FooterColumnEditor({
  column,
  onChange,
}: {
  column: FooterColumn;
  onChange: (next: FooterColumn) => void;
}) {
  const linkText = column.links.map((link) => `${link.label}|${link.href}`).join("\n");
  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <Field label="Column title">
        <Input
          value={column.title}
          onChange={(e) => onChange({ ...column, title: e.target.value })}
        />
      </Field>
      <Field label="Links, one per line: Label|/path">
        <Textarea
          value={linkText}
          rows={5}
          onChange={(e) =>
            onChange({
              ...column,
              links: lines(e.target.value).map((line) => {
                const [label = "", href = ""] = line.split("|");
                return { label: label.trim(), href: href.trim() };
              }),
            })
          }
        />
      </Field>
    </div>
  );
}

function PagesEditor({ pages }: { pages: Record<string, InfoPageContent> }) {
  return (
    <Tabs defaultValue="about">
      <TabsList className="flex h-auto flex-wrap justify-start gap-1">
        {Object.keys(DEFAULT_INFO_PAGES).map((slug) => (
          <TabsTrigger key={slug} value={slug}>
            {PAGE_LABELS[slug] ?? slug}
          </TabsTrigger>
        ))}
      </TabsList>
      {Object.keys(DEFAULT_INFO_PAGES).map((slug) => (
        <TabsContent key={slug} value={slug} className="mt-5">
          <InfoPageEditor slug={slug} initial={pages[slug]} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function InfoPageEditor({ slug, initial }: { slug: string; initial: InfoPageContent }) {
  const [page, setPage] = useState(initial);
  const { saving, save } = useSaveSection(`page:${slug}`);
  const set = (key: keyof InfoPageContent, value: unknown) =>
    setPage((prev) => ({ ...prev, [key]: value }));
  const updateSection = (index: number, patch: Partial<InfoPageSection>) =>
    setPage((prev) => ({
      ...prev,
      sections: prev.sections.map((section, i) =>
        i === index ? { ...section, ...patch } : section,
      ),
    }));

  return (
    <Card className="space-y-4 p-5">
      <SectionTitle title={PAGE_LABELS[slug] ?? slug} />
      <Field label="Eyebrow">
        <Input value={page.eyebrow} onChange={(e) => set("eyebrow", e.target.value)} />
      </Field>
      <Field label="Title">
        <Input value={page.title} onChange={(e) => set("title", e.target.value)} />
      </Field>
      <Field label="Intro">
        <Textarea value={page.intro} rows={3} onChange={(e) => set("intro", e.target.value)} />
      </Field>

      {slug === "contact" && (
        <Field label="Contact channels, one per line: Title|Description|email">
          <Textarea
            value={(page.contactChannels ?? [])
              .map((channel) => `${channel.title}|${channel.description}|${channel.contact}`)
              .join("\n")}
            rows={4}
            onChange={(e) =>
              set(
                "contactChannels",
                lines(e.target.value).map((line): ContactChannel => {
                  const [title = "", description = "", contact = ""] = line.split("|");
                  return {
                    title: title.trim(),
                    description: description.trim(),
                    contact: contact.trim(),
                  };
                }),
              )
            }
          />
        </Field>
      )}

      {slug === "report-abuse" && (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <Field label="Safety email">
            <Input
              value={page.reportAbuse?.safetyEmail ?? ""}
              onChange={(e) =>
                set("reportAbuse", { ...page.reportAbuse, safetyEmail: e.target.value })
              }
            />
          </Field>
          <Field label="Form intro">
            <Textarea
              value={page.reportAbuse?.formIntro ?? ""}
              rows={3}
              onChange={(e) =>
                set("reportAbuse", { ...page.reportAbuse, formIntro: e.target.value })
              }
            />
          </Field>
          <Field label="Emergency note">
            <Input
              value={page.reportAbuse?.emergencyNote ?? ""}
              onChange={(e) =>
                set("reportAbuse", { ...page.reportAbuse, emergencyNote: e.target.value })
              }
            />
          </Field>
        </div>
      )}

      {page.sections.map((section, index) => (
        <div key={index} className="space-y-3 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between gap-2">
            <Field label="Section title">
              <Input
                value={section.title}
                onChange={(e) => updateSection(index, { title: e.target.value })}
              />
            </Field>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-destructive"
              onClick={() =>
                setPage((prev) => ({
                  ...prev,
                  sections: prev.sections.filter((_, i) => i !== index),
                }))
              }
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <Field label="Body">
            <Textarea
              value={section.body}
              rows={4}
              onChange={(e) => updateSection(index, { body: e.target.value })}
            />
          </Field>
          <Field label="Bullets, one per line">
            <Textarea
              value={section.bullets.join("\n")}
              rows={4}
              onChange={(e) => updateSection(index, { bullets: lines(e.target.value) })}
            />
          </Field>
        </div>
      ))}
      <div className="flex justify-between">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setPage((prev) => ({
              ...prev,
              sections: [...prev.sections, { title: "New section", body: "", bullets: [] }],
            }))
          }
        >
          <Plus className="mr-1 h-4 w-4" /> Add section
        </Button>
        <SaveBar saving={saving} onSave={() => void save(page)} />
      </div>
    </Card>
  );
}

function TestimonialsEditor({ rows, onReload }: { rows: TestimonialRow[]; onReload: () => void }) {
  const createFn = useServerFn(createCmsRecord);
  const updateFn = useServerFn(updateCmsRecord);
  const deleteFn = useServerFn(deleteCmsRecord);
  const reorderFn = useServerFn(reorderCmsRecords);
  const [localRows, setLocalRows] = useState(rows);

  useEffect(() => setLocalRows(rows), [rows]);

  const save = async (row: TestimonialRow) => {
    const result = await updateFn({ data: { kind: "testimonials", id: row.id, patch: row } });
    if (!result.ok) return toast.error(result.error ?? "Could not save testimonial.");
    toast.success("Saved");
    onReload();
  };

  return (
    <div className="space-y-4">
      <Button
        size="sm"
        onClick={async () => {
          const result = await createFn({ data: { kind: "testimonials" } });
          if (!result.ok) return toast.error(result.error ?? "Could not add testimonial.");
          toast.success("Testimonial added");
          onReload();
        }}
      >
        <Plus className="mr-1 h-4 w-4" /> Add testimonial
      </Button>
      {localRows.map((row, index) => (
        <Card key={row.id} className="space-y-3 p-5">
          <RowHeader
            published={row.is_published}
            first={index === 0}
            last={index === localRows.length - 1}
            onPublished={(is_published) =>
              setLocalRows((prev) =>
                prev.map((r) => (r.id === row.id ? { ...r, is_published } : r)),
              )
            }
            onMove={async (direction) => {
              const next = moveItem(localRows, index, direction);
              setLocalRows(next);
              await reorderFn({ data: { kind: "testimonials", ids: next.map((r) => r.id) } });
              onReload();
            }}
            onDelete={async () => {
              const result = await deleteFn({ data: { kind: "testimonials", id: row.id } });
              if (!result.ok) return toast.error(result.error ?? "Could not delete testimonial.");
              onReload();
            }}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <Input
                value={row.name}
                onChange={(e) =>
                  setLocalRows((prev) =>
                    prev.map((r) => (r.id === row.id ? { ...r, name: e.target.value } : r)),
                  )
                }
              />
            </Field>
            <Field label="Country / location">
              <Input
                value={row.country ?? ""}
                onChange={(e) =>
                  setLocalRows((prev) =>
                    prev.map((r) => (r.id === row.id ? { ...r, country: e.target.value } : r)),
                  )
                }
              />
            </Field>
          </div>
          <Field label="Quote">
            <Textarea
              value={row.quote}
              rows={3}
              onChange={(e) =>
                setLocalRows((prev) =>
                  prev.map((r) => (r.id === row.id ? { ...r, quote: e.target.value } : r)),
                )
              }
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Rating">
              <RatingPicker
                value={row.rating}
                onChange={(rating) =>
                  setLocalRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, rating } : r)))
                }
              />
            </Field>
            <MediaPicker
              label="Photo"
              value={row.photo_path}
              folder="testimonials"
              onChange={(photo_path) =>
                setLocalRows((prev) =>
                  prev.map((r) => (r.id === row.id ? { ...r, photo_path } : r)),
                )
              }
            />
          </div>
          <SaveBar saving={false} onSave={() => void save(row)} />
        </Card>
      ))}
    </div>
  );
}

function StoriesEditor({ rows, onReload }: { rows: StoryRow[]; onReload: () => void }) {
  const createFn = useServerFn(createCmsRecord);
  const updateFn = useServerFn(updateCmsRecord);
  const deleteFn = useServerFn(deleteCmsRecord);
  const reorderFn = useServerFn(reorderCmsRecords);
  const [localRows, setLocalRows] = useState(rows);

  useEffect(() => setLocalRows(rows), [rows]);

  const save = async (row: StoryRow) => {
    const result = await updateFn({ data: { kind: "success_stories", id: row.id, patch: row } });
    if (!result.ok) return toast.error(result.error ?? "Could not save story.");
    toast.success("Saved");
    onReload();
  };

  return (
    <div className="space-y-4">
      <Button
        size="sm"
        onClick={async () => {
          const result = await createFn({ data: { kind: "success_stories" } });
          if (!result.ok) return toast.error(result.error ?? "Could not add story.");
          toast.success("Story added");
          onReload();
        }}
      >
        <Plus className="mr-1 h-4 w-4" /> Add success story
      </Button>
      {localRows.map((row, index) => (
        <Card key={row.id} className="space-y-3 p-5">
          <RowHeader
            published={row.is_published}
            first={index === 0}
            last={index === localRows.length - 1}
            onPublished={(is_published) =>
              setLocalRows((prev) =>
                prev.map((r) => (r.id === row.id ? { ...r, is_published } : r)),
              )
            }
            onMove={async (direction) => {
              const next = moveItem(localRows, index, direction);
              setLocalRows(next);
              await reorderFn({ data: { kind: "success_stories", ids: next.map((r) => r.id) } });
              onReload();
            }}
            onDelete={async () => {
              const result = await deleteFn({ data: { kind: "success_stories", id: row.id } });
              if (!result.ok) return toast.error(result.error ?? "Could not delete story.");
              onReload();
            }}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Title">
              <Input
                value={row.title}
                onChange={(e) =>
                  setLocalRows((prev) =>
                    prev.map((r) => (r.id === row.id ? { ...r, title: e.target.value } : r)),
                  )
                }
              />
            </Field>
            <Field label="Couple names">
              <Input
                value={row.couple_names ?? ""}
                onChange={(e) =>
                  setLocalRows((prev) =>
                    prev.map((r) => (r.id === row.id ? { ...r, couple_names: e.target.value } : r)),
                  )
                }
              />
            </Field>
          </div>
          <Field label="Story">
            <Textarea
              value={row.body}
              rows={4}
              onChange={(e) =>
                setLocalRows((prev) =>
                  prev.map((r) => (r.id === row.id ? { ...r, body: e.target.value } : r)),
                )
              }
            />
          </Field>
          <MediaPicker
            label="Story image"
            value={row.image_path}
            folder="stories"
            onChange={(image_path) =>
              setLocalRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, image_path } : r)))
            }
          />
          <SaveBar saving={false} onSave={() => void save(row)} />
        </Card>
      ))}
    </div>
  );
}

function RowHeader({
  published,
  first,
  last,
  onPublished,
  onMove,
  onDelete,
}: {
  published: boolean;
  first: boolean;
  last: boolean;
  onPublished: (published: boolean) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1 text-muted-foreground">
        <GripVertical className="h-4 w-4" />
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2"
          onClick={() => onMove(-1)}
          disabled={first}
        >
          Up
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2"
          onClick={() => onMove(1)}
          disabled={last}
        >
          Down
        </Button>
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-xs">
          <Switch checked={published} onCheckedChange={onPublished} />
          Published
        </label>
        <Button variant="ghost" size="icon" onClick={onDelete} className="text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <h2 className="font-semibold">{title}</h2>;
}

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

function RatingPicker({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((rating) => (
        <button
          key={rating}
          type="button"
          onClick={() => onChange(rating)}
          aria-label={`${rating} stars`}
        >
          <Star
            className={
              rating <= value ? "h-6 w-6 text-primary" : "h-6 w-6 text-muted-foreground/40"
            }
            fill={rating <= value ? "currentColor" : "none"}
          />
        </button>
      ))}
    </div>
  );
}

function lines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
