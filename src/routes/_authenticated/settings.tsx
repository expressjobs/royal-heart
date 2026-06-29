import { useCallback, useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Bell,
  Download,
  Eye,
  Ghost,
  KeyRound,
  Loader2,
  LogOut,
  MapPin,
  Moon,
  ShieldCheck,
  Trash2,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { AppShell } from "@/components/AppShell";
import { ConnectionStrength } from "@/components/ConnectionStrength";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import { VerificationSection } from "@/components/VerificationSection";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { LocationSettings } from "@/components/LocationSettings";
import { fetchProfilesWithPhotos, primaryPhotoPath, type ProfileWithPhotos } from "@/lib/profiles";
import { deleteMyAccount, exportMyData } from "@/lib/account.functions";
import { listMyLoginHistory, type LoginHistoryRow } from "@/lib/account-security.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — HeartConnect" }] }),
  component: () => (
    <AppShell>
      <Settings />
    </AppShell>
  ),
});

function Settings() {
  const { user, signOut, profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const exportData = useServerFn(exportMyData);
  const deleteAccount = useServerFn(deleteMyAccount);
  const [blocked, setBlocked] = useState<ProfileWithPhotos[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("blocks").select("blocked_id").eq("blocker_id", user.id);
    setBlocked(await fetchProfilesWithPhotos((data ?? []).map((b) => b.blocked_id)));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const unblock = async (id: string) => {
    if (!user) return;
    await supabase.from("blocks").delete().eq("blocker_id", user.id).eq("blocked_id", id);
    setBlocked((b) => b.filter((p) => p.id !== id));
    toast.success("User unblocked");
  };

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/", replace: true });
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `heartconnect-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Your data export has been downloaded.");
    } catch {
      toast.error("Could not export your data. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteAccount();
      await supabase.auth.signOut();
      toast.success("Your account has been permanently deleted.");
      navigate({ to: "/", replace: true });
    } catch {
      toast.error("Could not delete your account. Please try again.");
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-display text-2xl font-semibold">Settings</h1>

      <section className="rounded-3xl border border-border bg-card p-5">
        <h2 className="mb-4 font-semibold">Appearance</h2>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Moon className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium">Dark mode</p>
              <p className="text-sm text-muted-foreground">Easy on the eyes at night.</p>
            </div>
          </div>
          <Switch
            checked={theme === "dark"}
            onCheckedChange={toggleTheme}
            aria-label="Toggle dark mode"
          />
        </div>
      </section>

      {user && profile && <ConnectionStrength profile={profile} userId={user.id} />}

      <NotificationPreferences />

      <VerificationSection />

      <LocationSettings />

      <PrivacyControls />

      <AccountSecurity />

      <section className="rounded-3xl border border-border bg-card p-5">
        <h2 className="mb-1 flex items-center gap-2 font-semibold">
          <ShieldCheck className="h-5 w-5 text-primary" /> Safety & privacy
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Manage who can reach you. Blocked members can't see your profile or message you.
        </p>
        {loading ? (
          <div className="grid h-24 place-items-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : blocked.length === 0 ? (
          <p className="rounded-2xl bg-muted/50 p-4 text-sm text-muted-foreground">
            You haven't blocked anyone.
          </p>
        ) : (
          <ul className="space-y-2">
            {blocked.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-2xl border border-border p-3"
              >
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full">
                  <ProfilePhoto
                    path={primaryPhotoPath(p)}
                    alt={p.display_name ?? ""}
                    rounded="rounded-full"
                  />
                </div>
                <span className="flex-1 font-medium">{p.display_name ?? "Member"}</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => unblock(p.id)}
                >
                  <UserX className="h-4 w-4" /> Unblock
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-3xl border border-border bg-card p-5">
        <h2 className="mb-1 font-semibold">Your data</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Download a copy of everything we hold about your account in machine-readable JSON.
        </p>
        <Button
          variant="outline"
          className="rounded-xl"
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Export my data
        </Button>
      </section>

      <section className="rounded-3xl border border-border bg-card p-5">
        <h2 className="mb-4 font-semibold">Account</h2>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" className="rounded-xl" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="rounded-xl" disabled={deleting}>
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Delete account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes your profile, photos, matches, messages, and all related
                  data. This action cannot be undone. Consider exporting your data first.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete forever
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </section>
    </div>
  );
}

function AccountSecurity() {
  const historyFn = useServerFn(listMyLoginHistory);
  const [history, setHistory] = useState<LoginHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    historyFn()
      .then((rows) => {
        if (active) setHistory(rows);
      })
      .catch(() => {
        if (active) toast.error("Could not load login history.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [historyFn]);

  const signOutEverywhere = async () => {
    setSigningOut(true);
    const { error } = await supabase.auth.signOut({ scope: "global" });
    setSigningOut(false);
    if (error) {
      toast.error("Could not sign out all devices.");
      return;
    }
    toast.success("Signed out on all devices.");
    navigate({ to: "/", replace: true });
  };

  return (
    <section className="rounded-3xl border border-border bg-card p-5">
      <h2 className="mb-1 flex items-center gap-2 font-semibold">
        <KeyRound className="h-5 w-5 text-primary" /> Account security
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Review recent sign-ins and end active sessions on other devices.
      </p>

      <div className="rounded-2xl border border-border">
        <div className="border-b border-border px-4 py-3 text-sm font-medium">
          Recent login history
        </div>
        {loading ? (
          <div className="grid h-24 place-items-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : history.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No login events recorded yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {history.map((row) => (
              <li key={row.id} className="px-4 py-3 text-sm">
                <p className="font-medium">{new Date(row.created_at).toLocaleString()}</p>
                <p className="mt-1 truncate text-muted-foreground">
                  {row.ip_address ?? "Unknown IP"} · {row.user_agent ?? "Unknown browser"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Button
        type="button"
        variant="outline"
        className="mt-4 rounded-xl"
        onClick={signOutEverywhere}
        disabled={signingOut}
      >
        {signingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
        Sign out on all devices
      </Button>
    </section>
  );
}

interface NotifPrefs {
  new_messages: boolean;
  new_matches: boolean;
  verification: boolean;
  likes: boolean;
}

const PREF_ITEMS: { key: keyof NotifPrefs; label: string; desc: string }[] = [
  { key: "new_messages", label: "New messages", desc: "When someone messages you." },
  { key: "new_matches", label: "New matches", desc: "When you match with someone." },
  { key: "likes", label: "Likes", desc: "When someone likes your profile." },
  { key: "verification", label: "Verification", desc: "When your verification is approved." },
];

function NotificationPreferences() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<NotifPrefs>({
    new_messages: true,
    new_matches: true,
    verification: true,
    likes: true,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let active = true;
    supabase
      .from("notification_preferences")
      .select("new_messages, new_matches, verification, likes")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        if (data) setPrefs(data);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const update = async (key: keyof NotifPrefs, value: boolean) => {
    if (!user) return;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    const { error } = await supabase
      .from("notification_preferences")
      .upsert({ user_id: user.id, ...next }, { onConflict: "user_id" });
    if (error) {
      toast.error("Could not save preference.");
      setPrefs(prefs);
    }
  };

  return (
    <section className="rounded-3xl border border-border bg-card p-5">
      <h2 className="mb-1 flex items-center gap-2 font-semibold">
        <Bell className="h-4 w-4" /> Notifications
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Choose what you want to be notified about.
      </p>
      <div className="space-y-4">
        {PREF_ITEMS.map((item) => (
          <div key={item.key} className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium">{item.label}</p>
              <p className="text-sm text-muted-foreground">{item.desc}</p>
            </div>
            <Switch
              checked={prefs[item.key]}
              disabled={loading}
              onCheckedChange={(v) => update(item.key, v)}
              aria-label={item.label}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

interface PrivacyState {
  hide_age: boolean;
  hide_online_status: boolean;
  location_hidden: boolean;
  hide_distance: boolean;
  incognito: boolean;
}

const PRIVACY_ITEMS: { key: keyof PrivacyState; label: string; desc: string; icon: typeof Eye }[] =
  [
    {
      key: "hide_age",
      label: "Hide my age",
      desc: "Your age won't be shown on your profile.",
      icon: Eye,
    },
    {
      key: "location_hidden",
      label: "Hide exact location",
      desc: "Show only your city and distance, never precise location.",
      icon: MapPin,
    },
    {
      key: "hide_distance",
      label: "Hide my distance",
      desc: "Others won't see how far away you are. Your city can still show.",
      icon: MapPin,
    },
    {
      key: "hide_online_status",
      label: "Hide online status",
      desc: "Others can't see when you're active, and you're excluded from the \"online now\" filter.",
      icon: Eye,
    },
    {
      key: "incognito",
      label: "Incognito mode",
      desc: "Browse privately — you won't appear in other people's discovery or search.",
      icon: Ghost,
    },
  ];

function PrivacyControls() {
  const { user, profile, refreshProfile } = useAuth();
  const [state, setState] = useState<PrivacyState>({
    hide_age: false,
    hide_online_status: false,
    location_hidden: false,
    hide_distance: false,
    incognito: false,
  });

  useEffect(() => {
    if (profile) {
      setState({
        hide_age: profile.hide_age ?? false,
        hide_online_status: profile.hide_online_status ?? false,
        location_hidden: profile.location_hidden ?? false,
        hide_distance: profile.hide_distance ?? false,
        incognito: profile.incognito ?? false,
      });
    }
  }, [profile]);

  const update = async (key: keyof PrivacyState, value: boolean) => {
    if (!user) return;
    const prev = state;
    setState({ ...state, [key]: value });
    const patch: Partial<PrivacyState> = { [key]: value };
    const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
    if (error) {
      toast.error("Could not save setting.");
      setState(prev);
    } else {
      await refreshProfile();
    }
  };

  return (
    <section className="rounded-3xl border border-border bg-card p-5">
      <h2 className="mb-1 flex items-center gap-2 font-semibold">
        <Eye className="h-5 w-5 text-primary" /> Privacy &amp; visibility
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Control what others can see and whether you appear in discovery.
      </p>
      <div className="space-y-4">
        {PRIVACY_ITEMS.map((item) => (
          <div key={item.key} className="flex items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="font-medium">{item.label}</p>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            </div>
            <Switch
              checked={state[item.key]}
              onCheckedChange={(v) => update(item.key, v)}
              aria-label={item.label}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
