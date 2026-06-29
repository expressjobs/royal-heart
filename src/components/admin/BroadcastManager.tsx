import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Bell,
  CalendarClock,
  Copy,
  Eye,
  ImagePlus,
  Loader2,
  Megaphone,
  RefreshCw,
  Save,
  Send,
  Trash2,
  UploadCloud,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import {
  deleteAdminBroadcast,
  listAdminBroadcasts,
  previewBroadcastAudience,
  removeAdminBroadcastMedia,
  retryFailedBroadcastDeliveries,
  saveAdminBroadcast,
  sendAdminBroadcast,
  uploadAdminBroadcastMedia,
  type BroadcastRow,
  type BroadcastDeliveryRow,
} from "@/lib/broadcasts.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState, PanelLoader } from "@/components/admin/shared";

type AudienceGroup =
  | "all"
  | "free"
  | "gold"
  | "platinum"
  | "incomplete"
  | "inactive"
  | "verified"
  | "location"
  | "marketers"
  | "admin_test";

type BroadcastType =
  | "in_app_notification"
  | "promotional_message"
  | "system_announcement"
  | "upgrade_offer"
  | "safety_notice";

const emptyDraft = {
  id: null as string | null,
  title: "",
  message: "",
  ctaLabel: "",
  ctaUrl: "",
  imageUrl: "",
  mediaUrl: "",
  mediaType: null as "image" | "video" | null,
  mediaPath: "",
  audienceGroup: "free" as AudienceGroup,
  country: "",
  city: "",
  broadcastType: "system_announcement" as BroadcastType,
  confirmAll: false,
  scheduledFor: "",
};

export function BroadcastManager() {
  const listFn = useServerFn(listAdminBroadcasts);
  const saveFn = useServerFn(saveAdminBroadcast);
  const sendFn = useServerFn(sendAdminBroadcast);
  const retryFn = useServerFn(retryFailedBroadcastDeliveries);
  const deleteFn = useServerFn(deleteAdminBroadcast);
  const previewFn = useServerFn(previewBroadcastAudience);
  const uploadMediaFn = useServerFn(uploadAdminBroadcastMedia);
  const removeMediaFn = useServerFn(removeAdminBroadcastMedia);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const [broadcasts, setBroadcasts] = useState<BroadcastRow[]>([]);
  const [deliveries, setDeliveries] = useState<BroadcastDeliveryRow[]>([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [activeBroadcastId, setActiveBroadcastId] = useState<string | null>(null);
  const [viewBroadcastId, setViewBroadcastId] = useState<string | null>(null);

  const load = useCallback(
    async (showLoader = true) => {
      if (showLoader) setLoading(true);
      try {
        const result = await listFn({});
        setBroadcasts(result.broadcasts);
        setDeliveries(result.deliveries);
      } catch {
        toast.error("Could not load broadcasts.");
      } finally {
        if (showLoader) setLoading(false);
      }
    },
    [listFn],
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!activeBroadcastId) return;
    const interval = window.setInterval(() => {
      void load(false);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [activeBroadcastId, load]);

  useEffect(() => {
    setAudienceCount(null);
  }, [draft.audienceGroup, draft.country, draft.city]);

  const audience = useMemo(
    () => ({
      group: draft.audienceGroup,
      country: draft.country || undefined,
      city: draft.city || undefined,
    }),
    [draft.audienceGroup, draft.country, draft.city],
  );

  const preview = async () => {
    const result = await previewFn({ data: audience });
    setAudienceCount(result.count);
    toast.success(`${result.count} users match this audience.`);
  };

  const validateMediaFile = (file: File): string | null => {
    const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    const videoTypes = new Set(["video/mp4", "video/webm"]);
    if (imageTypes.has(file.type)) {
      if (file.size > 5 * 1024 * 1024) return "Image is too large. Maximum size is 5MB.";
      return null;
    }
    if (videoTypes.has(file.type)) {
      if (file.size > 50 * 1024 * 1024) return "Video is too large. Maximum size is 50MB.";
      return null;
    }
    return "Unsupported file type. Upload JPG, PNG, WebP, MP4, or WebM.";
  };

  const uploadMedia = async (file: File) => {
    const validationError = validateMediaFile(file);
    if (validationError) {
      toast.error(validationError);
      if (mediaInputRef.current) mediaInputRef.current.value = "";
      return;
    }

    setUploadingMedia(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const result = await uploadMediaFn({ data: form });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setDraft((d) => ({
        ...d,
        imageUrl: result.mediaType === "image" ? result.url : "",
        mediaUrl: result.url,
        mediaType: result.mediaType,
        mediaPath: result.path,
      }));
      toast.success("Broadcast media uploaded.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Broadcast media upload failed.");
    } finally {
      setUploadingMedia(false);
      if (mediaInputRef.current) mediaInputRef.current.value = "";
    }
  };

  const removeMedia = async () => {
    const path = draft.mediaPath;
    setDraft((d) => ({ ...d, imageUrl: "", mediaUrl: "", mediaType: null, mediaPath: "" }));
    if (!path) return;
    const result = await removeMediaFn({ data: { path } });
    if (!result.ok) toast.error(result.error);
  };

  const save = async (mode: "draft" | "scheduled" | "send") => {
    if (mode === "scheduled" && !draft.scheduledFor) {
      toast.error("Choose a date and time before scheduling.");
      return;
    }
    setSending(true);
    try {
      const scheduledFor = mode === "scheduled" ? new Date(draft.scheduledFor).toISOString() : null;
      const result = await saveFn({
        data: {
          id: draft.id,
          title: draft.title,
          message: draft.message,
          ctaLabel: draft.ctaLabel || null,
          ctaUrl: draft.ctaUrl || null,
          imageUrl: draft.imageUrl || null,
          mediaUrl: draft.mediaUrl || null,
          mediaType: draft.mediaType,
          mediaPath: draft.mediaPath || null,
          audience,
          broadcastType: draft.broadcastType,
          status: mode === "scheduled" ? "scheduled" : "draft",
          scheduledFor,
          sendNow: false,
          confirmAll: draft.confirmAll,
        },
      });
      if (!result.ok) {
        toast.error(result.error ?? "Could not save broadcast.");
        return;
      }
      if (mode === "send" && result.id) {
        setActiveBroadcastId(result.id);
        await load(false);
        const sendResult = await sendFn({
          data: { id: result.id, confirmAll: draft.confirmAll },
        });
        if (!sendResult.ok) {
          toast.error(sendResult.error ?? "Could not send broadcast.");
          return;
        }
        toast.success(
          `Broadcast delivered to ${sendResult.sent ?? 0} of ${sendResult.audienceSize ?? 0} users.`,
        );
      } else {
        toast.success(mode === "scheduled" ? "Broadcast scheduled." : "Broadcast draft saved.");
      }
      setDraft(emptyDraft);
      setAudienceCount(null);
      await load();
    } finally {
      setActiveBroadcastId(null);
      setSending(false);
    }
  };

  const duplicateBroadcast = (row: BroadcastRow) => {
    const audienceFilter = (row.audience_filter ?? {}) as {
      group?: AudienceGroup;
      country?: string;
      city?: string;
    };
    setDraft({
      ...emptyDraft,
      title: `${row.title} (copy)`,
      message: row.message,
      ctaLabel: row.cta_label ?? "",
      ctaUrl: row.cta_url ?? "",
      imageUrl: row.image_url ?? "",
      mediaUrl: row.media_url ?? "",
      mediaType: row.media_type,
      mediaPath: "",
      audienceGroup: audienceFilter.group ?? "free",
      country: audienceFilter.country ?? "",
      city: audienceFilter.city ?? "",
      broadcastType: row.broadcast_type as BroadcastType,
      confirmAll: audienceFilter.group === "all",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast.success("Broadcast copied into a new draft.");
  };

  const deleteBroadcast = async (row: BroadcastRow) => {
    if (!window.confirm(`Delete “${row.title}” and its delivery history?`)) return;
    const result = await deleteFn({ data: { id: row.id } });
    if (!result.ok) {
      toast.error(result.message ?? "Could not delete broadcast.");
      return;
    }
    if (viewBroadcastId === row.id) setViewBroadcastId(null);
    toast.success("Broadcast deleted.");
    await load(false);
  };

  const retryFailed = async (row: BroadcastRow) => {
    setActiveBroadcastId(row.id);
    try {
      const result = await retryFn({ data: { id: row.id } });
      if (!result.ok) {
        toast.error(result.error ?? "Could not retry failed deliveries.");
        return;
      }
      toast.success(
        `Retry complete: ${result.sent ?? 0} delivered, ${result.failed ?? 0} still failed.`,
      );
      await load(false);
    } finally {
      setActiveBroadcastId(null);
    }
  };

  const deliveryStats = useMemo(
    () => ({
      delivered: deliveries.filter((d) => d.status !== "failed" && d.status !== "pending").length,
      failed: deliveries.filter((d) => d.status === "failed").length,
      opened: deliveries.filter((d) => Boolean(d.opened_at)).length,
      clicked: deliveries.filter((d) => Boolean(d.clicked_at)).length,
    }),
    [deliveries],
  );
  const deliveryStatsByBroadcast = useMemo(() => {
    const stats = new Map<
      string,
      { delivered: number; opened: number; clicked: number; failed: number }
    >();
    for (const delivery of deliveries) {
      const current = stats.get(delivery.broadcast_id) ?? {
        delivered: 0,
        opened: 0,
        clicked: 0,
        failed: 0,
      };
      if (delivery.status === "failed") current.failed += 1;
      else if (delivery.status !== "pending") current.delivered += 1;
      if (delivery.opened_at) current.opened += 1;
      if (delivery.clicked_at) current.clicked += 1;
      stats.set(delivery.broadcast_id, current);
    }
    return stats;
  }, [deliveries]);
  const activeBroadcast = broadcasts.find((broadcast) => broadcast.id === activeBroadcastId);

  if (loading) return <PanelLoader />;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Broadcasts" value={broadcasts.length} />
        <Metric label="Delivered" value={deliveryStats.delivered} />
        <Metric label="Opened" value={deliveryStats.opened} />
        <Metric label="Clicked" value={deliveryStats.clicked} />
        <Metric label="Failed" value={deliveryStats.failed} />
      </div>

      <section className="grid gap-4 rounded-3xl border border-border bg-card p-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4 rounded-2xl border border-border bg-background p-4">
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Admin notification composer</h3>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Title">
              <Input
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              />
            </Field>
            <Field label="Broadcast type">
              <Select
                value={draft.broadcastType}
                onValueChange={(value) =>
                  setDraft((d) => ({ ...d, broadcastType: value as BroadcastType }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_app_notification">In-app notification</SelectItem>
                  <SelectItem value="promotional_message">Promotional message</SelectItem>
                  <SelectItem value="system_announcement">System announcement</SelectItem>
                  <SelectItem value="upgrade_offer">Upgrade offer</SelectItem>
                  <SelectItem value="safety_notice">Safety notice</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="CTA label">
              <Input
                value={draft.ctaLabel}
                onChange={(e) => setDraft((d) => ({ ...d, ctaLabel: e.target.value }))}
              />
            </Field>
            <Field label="CTA URL">
              <Input
                value={draft.ctaUrl}
                onChange={(e) => setDraft((d) => ({ ...d, ctaUrl: e.target.value }))}
              />
            </Field>
            <Field label="Media attachment" className="md:col-span-2">
              <div className="rounded-2xl border border-border bg-muted/20 p-3">
                {draft.mediaUrl ? (
                  <div className="space-y-3">
                    <div className="overflow-hidden rounded-xl border border-border bg-background">
                      {draft.mediaType === "video" ? (
                        <video
                          src={draft.mediaUrl}
                          className="max-h-64 w-full bg-black object-contain"
                          controls
                        />
                      ) : (
                        <img
                          src={draft.mediaUrl}
                          alt="Broadcast attachment preview"
                          className="max-h-64 w-full object-contain"
                        />
                      )}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                        {draft.mediaType === "video" ? (
                          <Video className="h-4 w-4" />
                        ) : (
                          <ImagePlus className="h-4 w-4" />
                        )}
                        {draft.mediaType === "video" ? "Video attached" : "Image attached"}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        onClick={removeMedia}
                        disabled={uploadingMedia}
                      >
                        <Trash2 className="h-4 w-4" /> Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => mediaInputRef.current?.click()}
                    disabled={uploadingMedia}
                    className="flex min-h-32 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-background px-4 py-6 text-center transition-colors hover:border-primary/50 disabled:opacity-60"
                  >
                    {uploadingMedia ? (
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    ) : (
                      <UploadCloud className="h-6 w-6 text-muted-foreground" />
                    )}
                    <span className="text-sm font-medium">
                      {uploadingMedia ? "Uploading media..." : "Upload one image or video"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      JPG, PNG, WebP up to 5MB. MP4 or WebM up to 50MB.
                    </span>
                  </button>
                )}
                <input
                  ref={mediaInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadMedia(file);
                  }}
                />
              </div>
            </Field>
            <Field label="Message" className="md:col-span-2">
              <Textarea
                rows={5}
                value={draft.message}
                onChange={(e) => setDraft((d) => ({ ...d, message: e.target.value }))}
              />
            </Field>
          </div>
          <div className="rounded-2xl border border-border p-4">
            <h4 className="font-medium">Audience</h4>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <Select
                value={draft.audienceGroup}
                onValueChange={(value) =>
                  setDraft((d) => ({ ...d, audienceGroup: value as AudienceGroup }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All users</SelectItem>
                  <SelectItem value="free">Free users</SelectItem>
                  <SelectItem value="gold">Gold users</SelectItem>
                  <SelectItem value="platinum">Platinum users</SelectItem>
                  <SelectItem value="incomplete">Incomplete profiles</SelectItem>
                  <SelectItem value="inactive">Inactive users</SelectItem>
                  <SelectItem value="verified">Verified users</SelectItem>
                  <SelectItem value="location">Country/city</SelectItem>
                  <SelectItem value="marketers">Marketers only</SelectItem>
                  <SelectItem value="admin_test">Test send to admin</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Country"
                value={draft.country}
                disabled={draft.audienceGroup !== "location"}
                onChange={(e) => setDraft((d) => ({ ...d, country: e.target.value }))}
              />
              <Input
                placeholder="City"
                value={draft.city}
                disabled={draft.audienceGroup !== "location"}
                onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))}
              />
            </div>
            {draft.audienceGroup === "all" && (
              <label className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
                <Checkbox
                  checked={draft.confirmAll}
                  onCheckedChange={(value) =>
                    setDraft((d) => ({ ...d, confirmAll: value === true }))
                  }
                />
                Confirm this should send to all users.
              </label>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" className="rounded-xl" onClick={preview}>
                Preview audience
              </Button>
              {audienceCount != null && (
                <span className="rounded-full bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
                  Live audience: {audienceCount} recipients
                </span>
              )}
            </div>
          </div>
          <Field label="Schedule send (your local time)">
            <Input
              type="datetime-local"
              value={draft.scheduledFor}
              min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
              onChange={(event) =>
                setDraft((current) => ({ ...current, scheduledFor: event.target.value }))
              }
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="rounded-xl"
              disabled={sending || uploadingMedia || !draft.title || !draft.message}
              onClick={() => save("draft")}
            >
              <Save className="h-4 w-4" /> Save draft
            </Button>
            <Button
              variant="outline"
              className="rounded-xl"
              disabled={
                sending || uploadingMedia || !draft.title || !draft.message || !draft.scheduledFor
              }
              onClick={() => save("scheduled")}
            >
              <CalendarClock className="h-4 w-4" /> Schedule
            </Button>
            <Button
              className="rounded-xl"
              disabled={sending || uploadingMedia || !draft.title || !draft.message}
              onClick={() => save("send")}
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send now
            </Button>
          </div>
          {activeBroadcastId && (
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="inline-flex items-center gap-2 font-medium">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Sending in real time
                </span>
                <span className="text-muted-foreground">
                  {activeBroadcast?.sent_count ?? 0} / {activeBroadcast?.audience_size ?? "…"}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-300"
                  style={{
                    width: `${Math.min(
                      100,
                      ((activeBroadcast?.sent_count ?? 0) /
                        Math.max(activeBroadcast?.audience_size ?? 1, 1)) *
                        100,
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3 rounded-2xl border border-border bg-background p-4">
          <h3 className="flex items-center gap-2 font-semibold">
            <Bell className="h-4 w-4 text-primary" /> Recent broadcasts
          </h3>
          {broadcasts.length === 0 ? (
            <EmptyState>No broadcasts yet.</EmptyState>
          ) : (
            broadcasts.slice(0, 12).map((row) => {
              const stats = deliveryStatsByBroadcast.get(row.id) ?? {
                delivered: 0,
                opened: 0,
                clicked: 0,
                failed: row.failed_count,
              };
              return (
                <div key={row.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{row.title}</p>
                      <p className="text-xs capitalize text-muted-foreground">
                        {row.status}
                        {row.scheduled_for
                          ? ` · ${new Date(row.scheduled_for).toLocaleString()}`
                          : ` · audience ${row.audience_size}`}
                      </p>
                    </div>
                    {row.status === "sending" && (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                    )}
                  </div>
                  {row.media_url && (
                    <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                      {row.media_type === "video" ? (
                        <Video className="h-3.5 w-3.5" />
                      ) : (
                        <ImagePlus className="h-3.5 w-3.5" />
                      )}
                      {row.media_type === "video" ? "Video" : "Image"}
                    </p>
                  )}
                  <div className="mt-2 grid grid-cols-4 gap-1 text-center">
                    <MiniMetric label="Delivered" value={stats.delivered} />
                    <MiniMetric label="Opened" value={stats.opened} />
                    <MiniMetric label="Clicked" value={stats.clicked} />
                    <MiniMetric label="Failed" value={stats.failed} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 rounded-lg px-2"
                      onClick={() =>
                        setViewBroadcastId((current) => (current === row.id ? null : row.id))
                      }
                    >
                      <Eye className="h-3.5 w-3.5" /> View
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 rounded-lg px-2"
                      onClick={() => duplicateBroadcast(row)}
                    >
                      <Copy className="h-3.5 w-3.5" /> Duplicate
                    </Button>
                    {row.failed_count > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 rounded-lg px-2"
                        disabled={activeBroadcastId === row.id}
                        onClick={() => retryFailed(row)}
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Retry failed
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 rounded-lg px-2 text-destructive hover:text-destructive"
                      disabled={row.status === "sending"}
                      onClick={() => deleteBroadcast(row)}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  </div>
                  {viewBroadcastId === row.id && (
                    <div className="mt-2 space-y-2 rounded-lg bg-muted/40 p-2 text-xs">
                      <p className="whitespace-pre-wrap text-foreground">{row.message}</p>
                      {row.cta_url && (
                        <p className="break-all text-muted-foreground">
                          CTA: {row.cta_label || "Open"} · {row.cta_url}
                        </p>
                      )}
                      <p className="text-muted-foreground">
                        Created {new Date(row.created_at).toLocaleString()}
                        {row.sent_at ? ` · Sent ${new Date(row.sent_at).toLocaleString()}` : ""}
                      </p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/50 px-1 py-1.5">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-xs font-semibold">{value}</p>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="mb-2 block">{label}</Label>
      {children}
    </div>
  );
}
