import { Link } from "@tanstack/react-router";
import { Heart, MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProfilePhoto } from "@/components/ProfilePhoto";

export function MatchModal({
  open,
  onClose,
  myPhoto,
  theirPhoto,
  theirName,
  matchId,
}: {
  open: boolean;
  onClose: () => void;
  myPhoto: string | null;
  theirPhoto: string | null;
  theirName: string;
  matchId: string | null;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl bg-gradient-primary p-8 text-center text-primary-foreground shadow-romantic">
        <p className="font-display text-4xl font-semibold animate-heart-pop">It's a Match!</p>
        <p className="mt-2 opacity-90">You and {theirName} liked each other.</p>
        <div className="mt-8 flex items-center justify-center -space-x-4">
          <div className="h-28 w-28 overflow-hidden rounded-full border-4 border-primary-foreground">
            <ProfilePhoto path={myPhoto} alt="You" rounded="rounded-full" />
          </div>
          <div className="h-28 w-28 overflow-hidden rounded-full border-4 border-primary-foreground">
            <ProfilePhoto path={theirPhoto} alt={theirName} rounded="rounded-full" />
          </div>
        </div>
        <div className="mt-8 space-y-3">
          {matchId && (
            <Button asChild size="lg" variant="secondary" className="w-full rounded-xl">
              <Link to="/messages/$matchId" params={{ matchId }}>
                <MessageCircle className="h-4 w-4" /> Send a message
              </Link>
            </Button>
          )}
          <Button
            size="lg"
            variant="ghost"
            className="w-full rounded-xl text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground"
            onClick={onClose}
          >
            <Heart className="h-4 w-4" /> Keep browsing
          </Button>
        </div>
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 opacity-80 hover:opacity-100"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
