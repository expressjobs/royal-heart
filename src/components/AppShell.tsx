import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  Compass,
  Heart,
  Home,
  MessageCircle,
  Menu,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Receipt,
  Share2,
  LogOut,
  UserRound,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { PresenceProvider } from "@/contexts/PresenceContext";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { useUnreadLikes } from "@/hooks/useUnreadLikes";
import { useUnreadNotificationCount } from "@/hooks/useNotifications";
import { primaryPhotoFromRows } from "@/lib/profiles";
import { cn } from "@/lib/utils";

type BadgeKey = "messages" | "likes" | "notifications";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: BadgeKey;
}

const NAV: NavItem[] = [
  { to: "/discover", label: "Home", icon: Home },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/recommendations", label: "For You", icon: Sparkles },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/matches", label: "Matches", icon: Heart },
  { to: "/messages", label: "Messages", icon: MessageCircle, badge: "messages" },
  { to: "/likes", label: "Likes", icon: Heart, badge: "likes" },
  { to: "/notifications", label: "Notifications", icon: Bell, badge: "notifications" },
  { to: "/marketer", label: "Marketer", icon: Share2 },
  { to: "/safety", label: "Safety", icon: ShieldCheck },
  { to: "/settings", label: "Settings", icon: Settings },
];

// "Home" and "Discover" both point at /discover (the in-app landing); de-dupe
// for the main nav so we don't render it twice, keeping "Discover" as the label.
const PRIMARY_NAV = NAV.filter((n) => n.label !== "Home");

function Badge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground ring-2 ring-background",
        className,
      )}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { isAdmin, signOut, profile, loading, user } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const unreadMessages = useUnreadMessages();
  const unreadLikes = useUnreadLikes();
  const notifCount = useUnreadNotificationCount();
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [suspendedUntil, setSuspendedUntil] = useState<string | null>(null);
  const [suspended, setSuspended] = useState(false);
  const [warnings, setWarnings] = useState<{ id: string; reason: string; severity: string }[]>([]);

  const badgeFor = (key?: BadgeKey): number => {
    if (key === "messages") return unreadMessages;
    if (key === "likes") return unreadLikes;
    if (key === "notifications") return notifCount;
    return 0;
  };

  useEffect(() => {
    if (!user) {
      setSuspended(false);
      setAvatarPath(null);
      setWarnings([]);
      return;
    }
    let active = true;
    supabase
      .from("user_warnings")
      .select("id, reason, severity")
      .eq("user_id", user.id)
      .eq("acknowledged", false)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (!active) return;
        setWarnings(data ?? []);
      });
    supabase
      .from("user_moderation")
      .select("is_banned, banned_until")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active || !data) return;
        const stillBanned =
          data.is_banned && (!data.banned_until || new Date(data.banned_until) > new Date());
        setSuspended(Boolean(stillBanned));
        setSuspendedUntil(data.banned_until ?? null);
      });
    supabase
      .from("profile_photos")
      .select("url, storage_path, is_primary")
      .eq("user_id", user.id)
      .order("is_primary", { ascending: false })
      .order("position", { ascending: true })
      .then(({ data }) => {
        if (!active) return;
        setAvatarPath(primaryPhotoFromRows(data));
      });
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (!loading && profile && !profile.onboarding_complete) {
      navigate({ to: "/onboarding" });
    }
  }, [loading, profile, navigate]);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/", replace: true });
  };

  const acknowledgeWarning = async (id: string) => {
    setWarnings((ws) => ws.filter((w) => w.id !== id));
    await supabase.from("user_warnings").update({ acknowledged: true }).eq("id", id);
  };

  const isActive = (to: string) => pathname === to || pathname.startsWith(to + "/");

  if (loading || (profile && !profile.onboarding_complete)) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const displayName = profile?.display_name ?? "Member";

  return (
    <PresenceProvider>
      <div className="flex min-h-dvh flex-col bg-background">
        {/* Top bar */}
        <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-lg supports-[backdrop-filter]:bg-background/60">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-3 sm:px-4">
            <Link to="/discover" aria-label="HeartConnect home" className="shrink-0">
              <Logo />
            </Link>

            {/* Desktop nav (icons from lg, labels from xl) */}
            <nav className="hidden min-w-0 items-center gap-0.5 lg:flex">
              {PRIMARY_NAV.map((item) => {
                const active = isActive(item.to);
                return (
                  <Link
                    key={item.label}
                    to={item.to}
                    aria-label={item.label}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <span className="relative">
                      <item.icon className="h-[18px] w-[18px]" />
                      <Badge count={badgeFor(item.badge)} className="absolute -right-2 -top-2" />
                    </span>
                    <span className="hidden xl:inline">{item.label}</span>
                  </Link>
                );
              })}
              {isAdmin && (
                <Link
                  to="/admin"
                  aria-label="Admin Dashboard"
                  aria-current={isActive("/admin") ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors",
                    isActive("/admin")
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Shield className="h-[18px] w-[18px]" />
                  <span className="hidden xl:inline">Admin</span>
                </Link>
              )}
            </nav>

            {/* Right controls */}
            <div className="flex shrink-0 items-center gap-1">
              <ThemeToggle />

              {user ? (
                <>
                  {/* Avatar menu (desktop) */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label="Account menu"
                        className="hidden h-9 w-9 overflow-hidden rounded-full ring-1 ring-border transition-shadow hover:ring-primary lg:block"
                      >
                        <ProfilePhoto
                          path={avatarPath}
                          alt={displayName}
                          rounded="rounded-full"
                          className="h-9 w-9"
                        />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel className="truncate">{displayName}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link to="/profile">
                          <UserRound className="h-4 w-4" /> My profile
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/premium" search={{ plan: undefined, period: undefined }}>
                          <Sparkles className="h-4 w-4" /> Membership
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/billing">
                          <Receipt className="h-4 w-4" /> Billing
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/marketer">
                          <Share2 className="h-4 w-4" /> Marketer dashboard
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/settings">
                          <Settings className="h-4 w-4" /> Settings
                        </Link>
                      </DropdownMenuItem>
                      {isAdmin && (
                        <DropdownMenuItem asChild>
                          <Link to="/admin">
                            <Shield className="h-4 w-4" /> Admin Dashboard
                          </Link>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={handleSignOut}
                        className="text-destructive focus:text-destructive"
                      >
                        <LogOut className="h-4 w-4" /> Sign out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Hamburger (mobile / tablet) */}
                  <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
                    <SheetTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="relative rounded-full lg:hidden"
                        aria-label="Open menu"
                      >
                        <Menu className="h-5 w-5" />
                        <Badge
                          count={unreadMessages + unreadLikes + notifCount}
                          className="absolute right-1 top-1"
                        />
                      </Button>
                    </SheetTrigger>
                    <SheetContent
                      side="right"
                      aria-label="Main menu"
                      className="flex w-[88vw] max-w-xs flex-col p-0"
                    >
                      <SheetHeader className="border-b border-border/60 p-4 text-left">
                        <SheetTitle className="sr-only">Navigation menu</SheetTitle>
                        <SheetDescription className="sr-only">
                          Browse HeartConnect, manage your account, and sign out. Press Escape or
                          tap outside to close.
                        </SheetDescription>
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full ring-1 ring-border">
                            <ProfilePhoto
                              path={avatarPath}
                              alt={displayName}
                              rounded="rounded-full"
                              className="h-11 w-11"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{displayName}</p>
                            <Link to="/profile" className="text-xs text-primary hover:underline">
                              View profile
                            </Link>
                          </div>
                        </div>
                      </SheetHeader>

                      <nav aria-label="Mobile navigation" className="flex-1 overflow-y-auto p-2">
                        {NAV.filter((n) => n.label !== "Discover").map((item) => {
                          const active = isActive(item.to);
                          return (
                            <SheetClose asChild key={item.label}>
                              <Link
                                to={item.to}
                                aria-current={active ? "page" : undefined}
                                className={cn(
                                  "flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-colors",
                                  active
                                    ? "bg-accent text-accent-foreground"
                                    : "text-foreground hover:bg-muted",
                                )}
                              >
                                <item.icon className="h-5 w-5 shrink-0" />
                                <span className="flex-1">{item.label}</span>
                                <Badge count={badgeFor(item.badge)} />
                              </Link>
                            </SheetClose>
                          );
                        })}
                        <SheetClose asChild>
                          <Link
                            to="/premium"
                            search={{ plan: undefined, period: undefined }}
                            className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                          >
                            <Sparkles className="h-5 w-5 shrink-0" />
                            <span className="flex-1">Membership</span>
                          </Link>
                        </SheetClose>
                        {isAdmin && (
                          <SheetClose asChild>
                            <Link
                              to="/admin"
                              aria-current={isActive("/admin") ? "page" : undefined}
                              className={cn(
                                "flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-colors",
                                isActive("/admin")
                                  ? "bg-accent text-accent-foreground"
                                  : "text-foreground hover:bg-muted",
                              )}
                            >
                              <Shield className="h-5 w-5 shrink-0" />
                              <span className="flex-1">Admin Dashboard</span>
                            </Link>
                          </SheetClose>
                        )}
                      </nav>

                      <div className="border-t border-border/60 p-3">
                        <Button
                          variant="outline"
                          className="w-full rounded-full"
                          onClick={handleSignOut}
                        >
                          <LogOut className="h-4 w-4" /> Sign out
                        </Button>
                      </div>
                    </SheetContent>
                  </Sheet>
                </>
              ) : (
                <>
                  <Button asChild variant="ghost" size="sm" className="rounded-full">
                    <Link to="/auth">Login</Link>
                  </Button>
                  <Button asChild variant="hero" size="sm" className="rounded-full">
                    <Link to="/auth">Join Free</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-6 md:pb-10">
          {suspended && (
            <div className="mb-6 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              <p className="font-semibold">Your account is suspended</p>
              <p className="mt-1 text-destructive/90">
                {suspendedUntil
                  ? `Access is limited until ${new Date(suspendedUntil).toLocaleString()}.`
                  : "Your account has been suspended by our moderation team."}{" "}
                You can't send new messages or likes during this time. Contact support if you
                believe this is a mistake.
              </p>
            </div>
          )}
          {warnings.map((w) => (
            <div
              key={w.id}
              className="mb-4 flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm"
            >
              <div className="min-w-0">
                <p className="font-semibold text-amber-700 dark:text-amber-400">
                  Warning from our moderation team
                </p>
                <p className="mt-1 text-amber-700/90 dark:text-amber-300/90">{w.reason}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 rounded-full"
                onClick={() => acknowledgeWarning(w.id)}
              >
                I understand
              </Button>
            </div>
          ))}
          {children}
        </main>

        {/* Mobile bottom nav */}
        <nav
          aria-label="Primary"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden"
        >
          <div className="mx-auto flex max-w-md items-center justify-around px-2 py-1">
            {BOTTOM_NAV.map((item) => {
              const active = isActive(item.to);
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-xl py-2 text-[11px] font-medium transition-colors",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <span className="relative">
                    <item.icon
                      aria-hidden="true"
                      className={cn("h-5 w-5 transition-transform", active && "scale-110")}
                    />
                    <Badge count={badgeFor(item.badge)} className="absolute -right-2 -top-1.5" />
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </PresenceProvider>
  );
}

const BOTTOM_NAV: NavItem[] = [
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/matches", label: "Matches", icon: Heart },
  { to: "/messages", label: "Messages", icon: MessageCircle, badge: "messages" },
  { to: "/likes", label: "Likes", icon: Heart, badge: "likes" },
  { to: "/profile", label: "Profile", icon: UserRound },
];
