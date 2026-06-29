import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { REPORT_REASONS } from "@/lib/constants";
import { classifyReason } from "@/lib/moderation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function ReportDialog({
  open,
  onOpenChange,
  reportedId,
  reportedName,
  matchId,
  onReported,
  initialReason,
  initialDetails,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  reportedId: string;
  reportedName: string;
  /** When reporting a conversation, link the report to the match for admin review. */
  matchId?: string;
  onReported?: () => void;
  /** Pre-select a reason (e.g. when reporting a flagged message). */
  initialReason?: string;
  /** Pre-fill the details box (e.g. with the flagged message text). */
  initialDetails?: string;
}) {
  const { user } = useAuth();
  const [reason, setReason] = useState<string>("");
  const [details, setDetails] = useState("");
  const [blockToo, setBlockToo] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setReason(initialReason ?? "");
      setDetails(initialDetails ?? "");
    }
  }, [open, initialReason, initialDetails]);

  const submit = async () => {
    if (!user || !reason) {
      toast.error("Please choose a reason");
      return;
    }
    setSubmitting(true);
    try {
      const { category, severity } = classifyReason(reason);
      const { error } = await supabase.from("reports").insert({
        reporter_id: user.id,
        reported_id: reportedId,
        reason,
        details: details.trim() || null,
        match_id: matchId ?? null,
        category,
        severity,
        content_type: matchId ? "conversation" : "profile",
        content_id: matchId ?? reportedId,
      });
      if (error) throw error;
      if (blockToo) {
        // Best-effort block; ignore duplicate-block errors.
        await supabase.from("blocks").insert({ blocker_id: user.id, blocked_id: reportedId });
      }
      toast.success(
        blockToo
          ? "Report submitted and user blocked. Our team will review it."
          : "Report submitted. Our team will review it.",
      );
      onOpenChange(false);
      setReason("");
      setDetails("");
      onReported?.();
    } catch {
      toast.error("Could not submit report.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle>{matchId ? "Report conversation" : `Report ${reportedName}`}</DialogTitle>
          <DialogDescription>
            {matchId
              ? `Tell us what's wrong with your chat with ${reportedName}. Our moderators can review the conversation. Reports are confidential.`
              : "Help us keep HeartConnect safe. Reports are confidential."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {REPORT_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition-colors",
                  reason === r
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "border-border hover:border-primary",
                )}
              >
                {r}
              </button>
            ))}
          </div>
          <Textarea
            placeholder="Add any details (optional)"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            className="min-h-24 rounded-xl"
            maxLength={1000}
          />
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 text-sm">
            <input
              type="checkbox"
              checked={blockToo}
              onChange={(e) => setBlockToo(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-primary"
            />
            <span>
              <span className="font-medium">Also block {reportedName}</span>
              <span className="block text-muted-foreground">
                You won't see each other or be able to message again.
              </span>
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export async function blockUser(blockerId: string, blockedId: string) {
  const { error } = await supabase
    .from("blocks")
    .insert({ blocker_id: blockerId, blocked_id: blockedId });
  if (error) throw error;
}
