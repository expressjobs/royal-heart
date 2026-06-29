import { Link } from "@tanstack/react-router";
import { Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function UpgradeModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader>
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
            <Crown className="h-5 w-5" />
          </span>
          <DialogTitle className="text-center font-display text-2xl">Start connecting</DialogTitle>
          <DialogDescription className="text-center leading-6">
            Upgrade to start connecting with members. Choose Gold or Platinum to like, match, and
            message.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:flex-col sm:space-x-0">
          <Button asChild variant="gold" className="w-full rounded-2xl">
            <Link to="/premium" search={{ plan: "gold", period: "month" }}>
              Upgrade to Gold
            </Link>
          </Button>
          <Button asChild variant="platinum" className="w-full rounded-2xl">
            <Link to="/premium" search={{ plan: "platinum", period: "month" }}>
              Upgrade to Platinum
            </Link>
          </Button>
          <Button
            variant="ghost"
            className="w-full rounded-2xl"
            onClick={() => onOpenChange(false)}
          >
            Maybe later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
