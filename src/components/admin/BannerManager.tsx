import { useCallback, useEffect, useState } from "react";
import { BarChart3, ExternalLink, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  BANNER_PLACEMENTS,
  bannerCtr,
  createBanner,
  deleteBanner,
  listAllBanners,
  updateBanner,
  type Banner,
} from "@/lib/banners";
import { audit } from "@/lib/admin.functions";
import { MediaPicker } from "@/components/cms/MediaPicker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, PanelLoader } from "@/components/admin/shared";

function toLocalInput(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

export function BannerManager() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setBanners(await listAllBanners());
    } catch {
      toast.error("Could not load banners.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    try {
      const created = await createBanner({
        title: "New banner",
        placement: "home_top",
        is_active: false,
        sort_order: banners.length,
      });
      setBanners((b) => [...b, created]);
      audit({ action: "banner.create", entityType: "banner", entityId: created.id });
      toast.success("Banner created — fill in the details and activate it.");
    } catch {
      toast.error("Could not create banner.");
    }
  };

  const patch = (id: string, fields: Partial<Banner>) =>
    setBanners((b) => b.map((x) => (x.id === id ? { ...x, ...fields } : x)));

  const save = async (banner: Banner) => {
    try {
      await updateBanner(banner.id, {
        title: banner.title,
        image_path: banner.image_path,
        link_url: banner.link_url,
        placement: banner.placement,
        is_active: banner.is_active,
        starts_at: banner.starts_at,
        ends_at: banner.ends_at,
        sort_order: banner.sort_order,
      });
      audit({ action: "banner.update", entityType: "banner", entityId: banner.id });
      toast.success("Banner saved");
    } catch {
      toast.error("Could not save banner.");
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteBanner(id);
      setBanners((b) => b.filter((x) => x.id !== id));
      audit({ action: "banner.delete", entityType: "banner", entityId: id });
    } catch {
      toast.error("Could not delete banner.");
    }
  };

  if (loading) return <PanelLoader />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Create promotional banners, schedule them, and track impressions and clicks.
        </p>
        <Button onClick={add} size="sm">
          <Plus className="mr-1 h-4 w-4" /> New banner
        </Button>
      </div>

      {banners.length === 0 ? (
        <EmptyState>No banners yet. Create one to promote offers across the site.</EmptyState>
      ) : (
        banners.map((banner) => (
          <Card key={banner.id} className="space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1 rounded-full bg-accent px-2.5 py-1">
                  <BarChart3 className="h-3.5 w-3.5" />
                  {banner.impressions} views · {banner.clicks} clicks · {bannerCtr(banner)} CTR
                </span>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs font-medium">
                  <Switch
                    checked={banner.is_active}
                    onCheckedChange={(v) => patch(banner.id, { is_active: v })}
                  />
                  {banner.is_active ? "Active" : "Inactive"}
                </label>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  onClick={() => remove(banner.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input
                  value={banner.title}
                  onChange={(e) => patch(banner.id, { title: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Placement</Label>
                <Select
                  value={banner.placement}
                  onValueChange={(v) => patch(banner.id, { placement: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BANNER_PLACEMENTS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Link URL</Label>
                <Input
                  placeholder="https://…"
                  value={banner.link_url ?? ""}
                  onChange={(e) => patch(banner.id, { link_url: e.target.value || null })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Display order</Label>
                <Input
                  type="number"
                  value={banner.sort_order}
                  onChange={(e) => patch(banner.id, { sort_order: Number(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Starts (optional)</Label>
                <Input
                  type="datetime-local"
                  value={toLocalInput(banner.starts_at)}
                  onChange={(e) => patch(banner.id, { starts_at: fromLocalInput(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Ends (optional)</Label>
                <Input
                  type="datetime-local"
                  value={toLocalInput(banner.ends_at)}
                  onChange={(e) => patch(banner.id, { ends_at: fromLocalInput(e.target.value) })}
                />
              </div>
            </div>

            <MediaPicker
              label="Banner image"
              value={banner.image_path}
              folder="banners"
              onChange={(p) => patch(banner.id, { image_path: p })}
            />

            <div className="flex items-center justify-between">
              {banner.link_url ? (
                <a
                  href={banner.link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  Preview link <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : (
                <span />
              )}
              <Button size="sm" onClick={() => save(banner)}>
                Save
              </Button>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
