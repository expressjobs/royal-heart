import { ProfileView } from "@/components/ProfileView";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { CompatBreakdown } from "@/lib/compatibility";
import type { ProfileWithPhotos } from "@/lib/profiles";

export function ProfileDetailSheet({
  open,
  onOpenChange,
  profile,
  viewerCountry,
  breakdown,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: ProfileWithPhotos | null;
  viewerCountry?: string | null;
  breakdown?: CompatBreakdown | null;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[92svh] overflow-y-auto rounded-t-3xl px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-5 sm:left-1/2 sm:max-w-md sm:-translate-x-1/2"
      >
        <SheetHeader className="px-2 text-left">
          <SheetTitle>{profile?.display_name ?? "Profile"}</SheetTitle>
          <SheetDescription>Full profile details</SheetDescription>
        </SheetHeader>
        {profile && (
          <ProfileView
            profile={profile}
            viewerCountry={viewerCountry}
            breakdown={breakdown}
            className="mt-4 shadow-card"
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
