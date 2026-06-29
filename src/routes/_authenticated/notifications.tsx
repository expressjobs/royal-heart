import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  CreditCard,
  Heart,
  Loader2,
  Megaphone,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  browserNotificationsSupported,
  useNotifications,
  type AppNotification,
} from "@/hooks/useNotifications";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { trackBroadcastClick } from "@/lib/broadcasts.functions";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — HeartConnect" }] }),
  component: () => (
    <AppShell>
      <NotificationCenter />
    </AppShell>
  ),
});

const ICONS: Record<AppNotification["type"], typeof Bell> = {
  message: MessageCircle,
  match: Heart,
  verification: ShieldCheck,
  like: Sparkles,
  payment: CreditCard,
  system: Bell,
  promotion: Megaphone,
  safety: ShieldCheck,
};

const ICON_TONE: Record<AppNotification["type"], string> = {
  message: "bg-blue-500/15 text-blue-500",
  match: "bg-pink-500/15 text-pink-500",
  verification: "bg-emerald-500/15 text-emerald-500",
  like: "bg-primary/15 text-primary",
  payment: "bg-amber-500/15 text-amber-600",
  system: "bg-slate-500/15 text-slate-600",
  promotion: "bg-violet-500/15 text-violet-600",
  safety: "bg-emerald-500/15 text-emerald-600",
};

interface NotificationPayload {
  match_id?: string;
  cta_label?: string | null;
  cta_url?: string | null;
  image_url?: string | null;
  media_url?: string | null;
  media_type?: "image" | "video" | null;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function NotificationCenter() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { notifications, unread, loading, markAllRead, markRead, remove } = useNotifications();
  const trackBroadcastClickFn = useServerFn(trackBroadcastClick);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    browserNotificationsSupported() ? Notification.permission : "unsupported",
  );

  const enableBrowserNotifications = async () => {
    if (!browserNotificationsSupported()) {
      toast.error("Your browser doesn't support notifications.");
      return;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") {
      if (user) {
        await supabase
          .from("notification_preferences")
          .upsert({ user_id: user.id, browser_push: true }, { onConflict: "user_id" });
      }
      toast.success("Browser notifications enabled!");
    } else {
      toast.error("Notifications were not allowed.");
    }
  };

  const handleOpen = (n: AppNotification) => {
    if (!n.read_at) markRead(n.id);
    const data = (n.data ?? {}) as NotificationPayload;
    if (n.type === "message" || n.type === "match") {
      if (data.match_id) navigate({ to: "/messages/$matchId", params: { matchId: data.match_id } });
      else navigate({ to: "/messages" });
    } else if (n.type === "like") {
      navigate({ to: "/likes" });
    } else if (n.type === "verification") {
      navigate({ to: "/profile" });
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">Notifications</h1>
        {unread > 0 && (
          <Button variant="ghost" size="sm" className="rounded-full" onClick={markAllRead}>
            <CheckCheck className="h-4 w-4" /> Mark all read
          </Button>
        )}
      </div>

      {/* Browser notification opt-in */}
      {permission !== "granted" && permission !== "unsupported" && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
            <Bell className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Turn on browser notifications</p>
            <p className="text-xs text-muted-foreground">
              Get alerted about new matches and messages instantly.
            </p>
          </div>
          <Button
            variant="hero"
            size="sm"
            className="shrink-0 rounded-full"
            onClick={enableBrowserNotifications}
          >
            Enable
          </Button>
        </div>
      )}
      {permission === "denied" && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          <BellOff className="h-5 w-5 shrink-0" />
          Browser notifications are blocked. Enable them in your browser settings to get instant
          alerts.
        </div>
      )}

      {loading ? (
        <div className="grid h-[40vh] place-items-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="grid h-[40vh] place-items-center rounded-3xl border border-dashed border-border bg-card/50 text-center">
          <div>
            <Bell className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 font-medium">You're all caught up</p>
            <p className="mt-1 text-sm text-muted-foreground">New activity will show up here.</p>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-card">
          {notifications.map((n) => {
            const Icon = ICONS[n.type] ?? Bell;
            const payload = (n.data ?? {}) as NotificationPayload;
            const mediaUrl = payload.media_url ?? payload.image_url ?? null;
            const mediaType = payload.media_type ?? (payload.image_url ? "image" : null);
            return (
              <li
                key={n.id}
                className={cn(
                  "group flex items-start gap-3 p-4 transition-colors",
                  !n.read_at && "bg-primary/5",
                )}
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div
                    className={cn(
                      "grid h-10 w-10 shrink-0 place-items-center rounded-full",
                      ICON_TONE[n.type],
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => handleOpen(n)}
                      className="block w-full text-left"
                    >
                      <p className="truncate text-sm font-semibold">{n.title}</p>
                      {n.body && (
                        <p className="line-clamp-2 text-sm text-muted-foreground">{n.body}</p>
                      )}
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {timeAgo(n.created_at)}
                      </p>
                    </button>
                    {mediaUrl && (
                      <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-background">
                        {mediaType === "video" ? (
                          <video src={mediaUrl} className="max-h-80 w-full bg-black" controls />
                        ) : (
                          <img
                            src={mediaUrl}
                            alt=""
                            className="max-h-80 w-full object-cover"
                            loading="lazy"
                          />
                        )}
                      </div>
                    )}
                    {payload.cta_url && (
                      <a
                        href={payload.cta_url}
                        className="mt-3 inline-flex rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                        onClick={async (event) => {
                          event.preventDefault();
                          if (!n.read_at) markRead(n.id);
                          await trackBroadcastClickFn({
                            data: { notificationId: n.id },
                          }).catch(() => undefined);
                          window.location.assign(payload.cta_url!);
                        }}
                      >
                        {payload.cta_label || "Open"}
                      </a>
                    )}
                  </div>
                  {!n.read_at && (
                    <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  {!n.read_at && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      aria-label="Mark read"
                      onClick={() => markRead(n.id)}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive"
                    aria-label="Delete"
                    onClick={() => remove(n.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
