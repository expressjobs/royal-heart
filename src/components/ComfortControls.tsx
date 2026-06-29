import { Ban, EyeOff, Flag, LockKeyhole, ShieldCheck, VolumeX } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ComfortControls({
  personName,
  context = "profile",
  onReport,
  onBlock,
  onHide,
  onMute,
  className,
}: {
  personName?: string | null;
  context?: "discover" | "profile" | "chat";
  onReport: () => void;
  onBlock: () => void | Promise<void>;
  onHide?: () => void | Promise<void>;
  onMute?: () => void | Promise<void>;
  className?: string;
}) {
  const name = personName || "this member";
  const blockLabel = context === "chat" ? "Block conversation" : "Block";

  return (
    <section className={cn("rounded-3xl border border-border bg-card p-5", className)}>
      <h2 className="flex items-center gap-2 font-semibold">
        <ShieldCheck className="h-5 w-5 text-primary" /> Comfort Controls
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Quiet controls for your pace, privacy, and safety.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Button
          type="button"
          variant="outline"
          className="justify-start rounded-xl"
          onClick={onReport}
        >
          <Flag className="h-4 w-4" /> Report
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="outline" className="justify-start rounded-xl">
              <Ban className="h-4 w-4" /> {blockLabel}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="rounded-3xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Block {name}?</AlertDialogTitle>
              <AlertDialogDescription>
                You will stop seeing each other and they will not be able to message you.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={onBlock}
              >
                Block
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {onHide && (
          <Button
            type="button"
            variant="outline"
            className="justify-start rounded-xl"
            onClick={onHide}
          >
            <EyeOff className="h-4 w-4" /> Hide profile
          </Button>
        )}

        {onMute && (
          <Button
            type="button"
            variant="outline"
            className="justify-start rounded-xl"
            onClick={onMute}
          >
            <VolumeX className="h-4 w-4" /> Mute
          </Button>
        )}
      </div>

      <div className="mt-4 space-y-2 rounded-2xl bg-muted/40 p-4 text-sm text-muted-foreground">
        <p className="flex gap-2">
          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          Your exact location is not shown. HeartConnect uses location for relevance and distance.
        </p>
        <p className="flex gap-2">
          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          Profile photos stay inside HeartConnect surfaces and can be reported if misused.
        </p>
      </div>
    </section>
  );
}
