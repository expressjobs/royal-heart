import { useCallback, useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";
import { EmptyState, PanelLoader } from "@/components/admin/shared";
import { VerificationAnalytics } from "@/components/admin/VerificationAnalytics";

type VerificationRow = Database["public"]["Tables"]["verification_requests"]["Row"];
type ReviewRow = Database["public"]["Tables"]["verification_review"]["Row"];
type VerifStatus = "pending" | "approved" | "rejected";

interface VerificationWithName extends VerificationRow {
  memberName: string;
  review: ReviewRow | null;
}

const FILTERS: VerifStatus[] = ["pending", "approved", "rejected"];

const DOCUMENT_LABELS: Record<string, string> = {
  passport: "Passport",
  national_id: "National ID",
  drivers_license: "Driver's license",
};

const FRAUD_LABELS: Record<string, string> = {
  duplicate_selfie: "Selfie re-used by another account",
  repeat_rejections: "Repeated rejected attempts",
  new_account: "Account < 24h old",
  empty_profile: "Empty profile / no bio",
  previously_banned: "Previously banned",
  no_profile_photos: "No profile photos",
  selfie_only: "Selfie only (no ID)",
};

function fraudTone(score: number): string {
  if (score >= 5) return "bg-destructive/10 text-destructive";
  if (score >= 3) return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
  return "bg-muted text-muted-foreground";
}

export function VerificationQueue() {
  const { user } = useAuth();
  const [items, setItems] = useState<VerificationWithName[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<VerifStatus>("pending");
  const [flaggedOnly, setFlaggedOnly] = useState(false);

  const load = useCallback(async () => {
    const { data: rows } = await supabase
      .from("verification_requests")
      .select("*")
      .order("created_at", { ascending: false });
    const list = rows ?? [];
    const ids = [...new Set(list.map((v) => v.user_id))];
    const reqIds = list.map((v) => v.id);
    const { data: profs } = ids.length
      ? await supabase.from("profiles").select("id, display_name").in("id", ids)
      : { data: [] as { id: string; display_name: string | null }[] };
    const { data: reviews } = reqIds.length
      ? await supabase.from("verification_review").select("*").in("request_id", reqIds)
      : { data: [] as ReviewRow[] };
    const nameById = new Map((profs ?? []).map((p) => [p.id, p.display_name ?? "Member"]));
    const reviewByReq = new Map((reviews ?? []).map((r) => [r.request_id, r]));
    setItems(
      list
        .map((v) => ({
          ...v,
          memberName: nameById.get(v.user_id) ?? "Member",
          review: reviewByReq.get(v.id) ?? null,
        }))
        // Highest fraud risk first, then most recent.
        .sort(
          (a, b) =>
            (b.review?.fraud_score ?? 0) - (a.review?.fraud_score ?? 0) ||
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        ),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const review = async (id: string, status: "approved" | "rejected") => {
    if (!user) return;
    const { error } = await supabase
      .from("verification_requests")
      .update({ status, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error("Could not update request.");
    setItems((vs) => vs.map((v) => (v.id === id ? { ...v, status } : v)));
    toast.success(status === "approved" ? "Member verified" : "Request rejected");
  };

  if (loading) return <PanelLoader />;

  const visible = items.filter(
    (v) => v.status === filter && (!flaggedOnly || (v.review?.fraud_score ?? 0) > 0),
  );

  return (
    <div className="space-y-4">
      <VerificationAnalytics />

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const count = items.filter((v) => v.status === f).length;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm capitalize transition-colors",
                filter === f
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-border hover:border-primary",
              )}
            >
              {f} ({count})
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setFlaggedOnly((v) => !v)}
          className={cn(
            "ml-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
            flaggedOnly
              ? "border-transparent bg-amber-500 text-white"
              : "border-border hover:border-amber-500",
          )}
        >
          <ShieldAlert className="h-3.5 w-3.5" /> Flagged only
        </button>
      </div>

      {visible.length === 0 ? (
        <EmptyState>
          No {flaggedOnly ? "flagged " : ""}
          {filter} verification requests.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {visible.map((v) => {
            const flags = Array.isArray(v.review?.fraud_flags)
              ? (v.review?.fraud_flags as string[])
              : [];
            const fraudScore = v.review?.fraud_score ?? 0;
            const idPhotoPath = v.review?.id_photo_path ?? null;
            return (
              <li
                key={v.id}
                className="flex flex-wrap items-start gap-4 rounded-2xl border border-border bg-card p-4"
              >
                <div className="flex shrink-0 gap-2">
                  <div className="h-20 w-20 overflow-hidden rounded-2xl">
                    <ProfilePhoto path={v.photo_path} alt={`${v.memberName} selfie`} />
                  </div>
                  {idPhotoPath && (
                    <div className="h-20 w-20 overflow-hidden rounded-2xl border border-border">
                      <ProfilePhoto path={idPhotoPath} alt={`${v.memberName} ID document`} />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{v.memberName}</p>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {v.document_type
                        ? (DOCUMENT_LABELS[v.document_type] ?? v.document_type)
                        : "Selfie only"}
                    </span>
                    {fraudScore > 0 && (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                          fraudTone(fraudScore),
                        )}
                      >
                        <ShieldAlert className="h-3 w-3" /> Risk {fraudScore}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Submitted {new Date(v.created_at).toLocaleDateString()}
                    {v.reviewed_at && ` · reviewed ${new Date(v.reviewed_at).toLocaleDateString()}`}
                  </p>
                  {flags.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {flags.map((f) => (
                        <li
                          key={f}
                          className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[11px] text-amber-600 dark:text-amber-400"
                        >
                          {FRAUD_LABELS[f] ?? f}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {v.status === "pending" ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="rounded-full"
                      onClick={() => review(v.id, "approved")}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full"
                      onClick={() => review(v.id, "rejected")}
                    >
                      Reject
                    </Button>
                  </div>
                ) : (
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium capitalize",
                      v.status === "approved"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-destructive/10 text-destructive",
                    )}
                  >
                    {v.status}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
