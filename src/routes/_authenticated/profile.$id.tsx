import { useCallback, useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Ban, Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/AppShell";
import { ComfortControls } from "@/components/ComfortControls";
import { ProfileView } from "@/components/ProfileView";
import { ReportDialog, blockUser } from "@/components/ReportDialog";
import { Button } from "@/components/ui/button";
import { fetchOneProfile, type ProfileWithPhotos } from "@/lib/profiles";
import { fetchOneCompatibility, logInteraction, type CompatBreakdown } from "@/lib/compatibility";

export const Route = createFileRoute("/_authenticated/profile/$id")({
  head: () => ({ meta: [{ title: "Profile — HeartConnect" }] }),
  component: () => (
    <AppShell>
      <ProfileDetail />
    </AppShell>
  ),
});

function ProfileDetail() {
  const { id } = Route.useParams();
  const { user, profile: myProfile } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileWithPhotos | null>(null);
  const [breakdown, setBreakdown] = useState<CompatBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setBreakdown(null);
    const [p, compat] = await Promise.all([fetchOneProfile(id), fetchOneCompatibility(id)]);
    setProfile(p);
    setBreakdown(compat?.breakdown ?? null);
    setLoading(false);
    if (p) logInteraction("view", id, { source: "profile" });
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleBlock = async () => {
    if (!user || !profile) return;
    try {
      await blockUser(user.id, profile.id);
      toast.success(`${profile.display_name} has been blocked.`);
      navigate({ to: "/discover" });
    } catch {
      toast.error("Could not block user.");
    }
  };

  if (loading) {
    return (
      <div className="grid h-[50vh] place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-md text-center">
        <p className="mt-10 text-muted-foreground">This profile is unavailable.</p>
        <Button
          variant="outline"
          className="mt-4 rounded-full"
          onClick={() => navigate({ to: "/discover" })}
        >
          Back to Discover
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-4 flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          onClick={() =>
            window.history.length > 1 ? window.history.back() : navigate({ to: "/discover" })
          }
          aria-label="Go back"
        >
          <ArrowLeft aria-hidden="true" className="h-5 w-5" />
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => setReportOpen(true)}
          >
            <Flag className="h-4 w-4" /> Report
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full text-destructive hover:text-destructive"
            onClick={handleBlock}
          >
            <Ban className="h-4 w-4" /> Block
          </Button>
        </div>
      </div>
      <ProfileView
        profile={profile}
        viewerCountry={myProfile?.location_country}
        breakdown={breakdown}
        className="shadow-card"
      />
      <ComfortControls
        personName={profile.display_name}
        context="profile"
        onReport={() => setReportOpen(true)}
        onBlock={handleBlock}
        className="mt-6"
      />
      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        reportedId={profile.id}
        reportedName={profile.display_name ?? "this user"}
      />
    </div>
  );
}
