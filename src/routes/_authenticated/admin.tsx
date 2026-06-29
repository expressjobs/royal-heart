import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  Compass,
  CreditCard,
  Database,
  GalleryVerticalEnd,
  History,
  ImagePlay,
  LayoutGrid,
  Loader2,
  MapPinned,
  Megaphone,
  Settings,
  Share2,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserCheck,
  Users,
} from "lucide-react";
import { useAuth, type AppRole } from "@/contexts/AuthContext";
import { requireMinRole } from "@/lib/admin-guard";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminOverview } from "@/components/admin/AdminOverview";
import { UserManagement } from "@/components/admin/UserManagement";
import { ModerationCenter } from "@/components/admin/ModerationCenter";
import { VerificationQueue } from "@/components/admin/VerificationQueue";
import { SubscriptionsPanel } from "@/components/admin/SubscriptionsPanel";
import { BannerManager } from "@/components/admin/BannerManager";
import { SettingsPanel } from "@/components/admin/SettingsPanel";
import { AuditLogPanel } from "@/components/admin/AuditLogPanel";
import { DiscoveryPanel } from "@/components/admin/DiscoveryPanel";
import { MatchingAnalytics } from "@/components/admin/MatchingAnalytics";
import { LocationInsights } from "@/components/admin/LocationInsights";
import { RoleManagement } from "@/components/admin/RoleManagement";
import { RegistrationPanel } from "@/components/admin/RegistrationPanel";
import { DemoUserManager, ImportDatasetPanel } from "@/components/admin/DemoUserManager";
import { MarketerManagement } from "@/components/admin/MarketerManagement";
import { BroadcastManager } from "@/components/admin/BroadcastManager";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: () => requireMinRole("admin"),
  head: () => ({ meta: [{ title: "Admin — HeartConnect" }] }),
  component: () => (
    <AppShell>
      <Admin />
    </AppShell>
  ),
});

/** Minimum role required to see each tab. */
const TABS = [
  { value: "overview", label: "Overview", icon: LayoutGrid, min: "admin" },
  { value: "users", label: "Users", icon: Users, min: "admin" },
  { value: "demo-users", label: "Demo Users", icon: GalleryVerticalEnd, min: "admin" },
  { value: "import-dataset", label: "Import Dataset", icon: Database, min: "admin" },
  { value: "registrations", label: "Registrations", icon: UserCheck, min: "admin" },
  { value: "roles", label: "Roles & access", icon: ShieldCheck, min: "admin" },
  { value: "verification", label: "Verification", icon: BadgeCheck, min: "admin" },
  { value: "reports", label: "Moderation", icon: ShieldAlert, min: "admin" },
  { value: "subscriptions", label: "Subscriptions", icon: CreditCard, min: "admin" },
  { value: "marketers", label: "Marketers", icon: Share2, min: "admin" },
  { value: "broadcasts", label: "Broadcasts", icon: Megaphone, min: "admin" },
  { value: "discovery", label: "Discovery", icon: Compass, min: "admin" },
  { value: "matching", label: "Matching", icon: Sparkles, min: "admin" },
  { value: "locations", label: "Locations", icon: MapPinned, min: "admin" },
  { value: "banners", label: "Banners", icon: ImagePlay, min: "admin" },
  { value: "settings", label: "Settings", icon: SlidersHorizontal, min: "super_admin" },
  { value: "audit", label: "Audit log", icon: History, min: "admin" },
] as const satisfies readonly { value: string; label: string; icon: typeof Users; min: AppRole }[];

function Admin() {
  const { isAdmin, isSuperAdmin, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="grid h-[50vh] place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md text-center">
        <ShieldAlert className="mx-auto mt-10 h-12 w-12 text-muted-foreground" />
        <h1 className="mt-4 font-display text-xl font-semibold">Staff only</h1>
        <p className="mt-2 text-muted-foreground">You don't have access to this area.</p>
      </div>
    );
  }

  const canSee = (min: AppRole) => {
    if (min === "super_admin") return isSuperAdmin;
    if (min === "admin") return isAdmin;
    return false;
  };

  const visibleTabs = TABS.filter((t) => canSee(t.min));
  const defaultTab = visibleTabs[0]?.value ?? "verification";

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">
            {isSuperAdmin ? "Super Admin Dashboard" : isAdmin ? "Admin Dashboard" : "Moderation"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage members, moderation, subscriptions, and content.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Install from browser using Add to Home Screen.
          </p>
        </div>
        {isAdmin && (
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link to="/admin/content">
              <Settings className="h-4 w-4" /> Website content
            </Link>
          </Button>
        )}
      </div>

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="mb-6 flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/60 p-1">
          {visibleTabs.map((t) => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className="gap-1.5 rounded-lg data-[state=active]:bg-card"
            >
              <t.icon className="h-4 w-4" />
              <span>{t.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {canSee("admin") && (
          <TabsContent value="overview">
            <AdminOverview />
          </TabsContent>
        )}
        {canSee("admin") && (
          <TabsContent value="users">
            <UserManagement />
          </TabsContent>
        )}
        {canSee("admin") && (
          <TabsContent value="demo-users">
            <DemoUserManager />
          </TabsContent>
        )}
        {canSee("admin") && (
          <TabsContent value="import-dataset">
            <ImportDatasetPanel />
          </TabsContent>
        )}
        {canSee("admin") && (
          <TabsContent value="registrations">
            <RegistrationPanel />
          </TabsContent>
        )}
        {canSee("admin") && (
          <TabsContent value="roles">
            <RoleManagement />
          </TabsContent>
        )}
        <TabsContent value="verification">
          <VerificationQueue />
        </TabsContent>
        <TabsContent value="reports">
          <ModerationCenter />
        </TabsContent>
        {canSee("admin") && (
          <TabsContent value="subscriptions">
            <SubscriptionsPanel />
          </TabsContent>
        )}
        {canSee("admin") && (
          <TabsContent value="marketers">
            <MarketerManagement />
          </TabsContent>
        )}
        {canSee("admin") && (
          <TabsContent value="broadcasts">
            <BroadcastManager />
          </TabsContent>
        )}
        {canSee("admin") && (
          <TabsContent value="discovery">
            <DiscoveryPanel />
          </TabsContent>
        )}
        {canSee("admin") && (
          <TabsContent value="matching">
            <MatchingAnalytics />
          </TabsContent>
        )}
        {canSee("admin") && (
          <TabsContent value="locations">
            <LocationInsights />
          </TabsContent>
        )}
        {canSee("admin") && (
          <TabsContent value="banners">
            <BannerManager />
          </TabsContent>
        )}
        {isSuperAdmin && (
          <TabsContent value="settings">
            <SettingsPanel />
          </TabsContent>
        )}
        {canSee("admin") && (
          <TabsContent value="audit">
            <AuditLogPanel />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
