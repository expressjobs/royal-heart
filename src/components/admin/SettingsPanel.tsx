import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { audit } from "@/lib/admin.functions";
import { MediaPicker } from "@/components/cms/MediaPicker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export interface SiteSettings {
  siteName: string;
  contactEmail: string;
  logoPath: string | null;
  faviconPath: string | null;
  facebook: string;
  instagram: string;
  twitter: string;
  tiktok: string;
  seoTitle: string;
  seoDescription: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  showDemoProfiles: boolean;
}

const DEFAULT_SETTINGS: SiteSettings = {
  siteName: "HeartConnect",
  contactEmail: "",
  logoPath: null,
  faviconPath: null,
  facebook: "",
  instagram: "",
  twitter: "",
  tiktok: "",
  seoTitle: "",
  seoDescription: "",
  emailNotifications: true,
  pushNotifications: true,
  showDemoProfiles: true,
};

export function SettingsPanel() {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "settings")
        .maybeSingle();
      const row = data as { value?: unknown } | null;
      if (row?.value) setSettings({ ...DEFAULT_SETTINGS, ...(row.value as object) });
      setLoading(false);
    })();
  }, []);

  const set = <K extends keyof SiteSettings>(k: K, v: SiteSettings[K]) =>
    setSettings((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "settings", value: settings as never }, { onConflict: "key" });
    setSaving(false);
    if (error) return toast.error("Could not save settings.");
    audit({ action: "settings.update", entityType: "app_settings", entityId: "settings" });
    toast.success("Settings saved");
  };

  if (loading) {
    return (
      <div className="grid place-items-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-5">
        <h3 className="font-semibold">General</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Site name</Label>
            <Input value={settings.siteName} onChange={(e) => set("siteName", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Contact email</Label>
            <Input
              type="email"
              value={settings.contactEmail}
              onChange={(e) => set("contactEmail", e.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <MediaPicker
            label="Logo"
            value={settings.logoPath}
            folder="branding"
            onChange={(p) => set("logoPath", p)}
          />
          <MediaPicker
            label="Favicon"
            value={settings.faviconPath}
            folder="branding"
            onChange={(p) => set("faviconPath", p)}
          />
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <h3 className="font-semibold">Social links</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Facebook</Label>
            <Input
              value={settings.facebook}
              onChange={(e) => set("facebook", e.target.value)}
              placeholder="https://facebook.com/…"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Instagram</Label>
            <Input
              value={settings.instagram}
              onChange={(e) => set("instagram", e.target.value)}
              placeholder="https://instagram.com/…"
            />
          </div>
          <div className="space-y-1.5">
            <Label>X / Twitter</Label>
            <Input
              value={settings.twitter}
              onChange={(e) => set("twitter", e.target.value)}
              placeholder="https://x.com/…"
            />
          </div>
          <div className="space-y-1.5">
            <Label>TikTok</Label>
            <Input
              value={settings.tiktok}
              onChange={(e) => set("tiktok", e.target.value)}
              placeholder="https://tiktok.com/@…"
            />
          </div>
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <h3 className="font-semibold">SEO defaults</h3>
        <div className="space-y-1.5">
          <Label>Default meta title</Label>
          <Input value={settings.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Default meta description</Label>
          <Textarea
            value={settings.seoDescription}
            rows={3}
            onChange={(e) => set("seoDescription", e.target.value)}
          />
        </div>
      </Card>

      <Card className="space-y-3 p-5">
        <h3 className="font-semibold">Notifications</h3>
        <label className="flex items-center justify-between rounded-lg border border-border p-3">
          <span className="text-sm font-medium">Send email notifications</span>
          <Switch
            checked={settings.emailNotifications}
            onCheckedChange={(v) => set("emailNotifications", v)}
          />
        </label>
        <label className="flex items-center justify-between rounded-lg border border-border p-3">
          <span className="text-sm font-medium">Send push notifications</span>
          <Switch
            checked={settings.pushNotifications}
            onCheckedChange={(v) => set("pushNotifications", v)}
          />
        </label>
      </Card>

      <Card className="space-y-3 p-5">
        <h3 className="font-semibold">Demo profiles</h3>
        <p className="text-sm text-muted-foreground">
          Demo profiles help the app feel active during launch. They are clearly flagged in the
          database, never counted as real members, and can be hidden from Discover at any time.
        </p>
        <label className="flex items-center justify-between rounded-lg border border-border p-3">
          <span className="text-sm font-medium">Show demo profiles in Discover &amp; search</span>
          <Switch
            checked={settings.showDemoProfiles}
            onCheckedChange={(v) => set("showDemoProfiles", v)}
          />
        </label>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-1 h-4 w-4" />
          )}
          Save settings
        </Button>
      </div>
    </div>
  );
}
