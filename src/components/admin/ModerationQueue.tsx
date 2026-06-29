import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Ban,
  Flag,
  Loader2,
  MessageSquare,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  History as HistoryIcon,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { EmptyState, PanelLoader } from "@/components/admin/shared";
import { ModerationNotes } from "@/components/admin/ModerationNotes";
import {
  CATEGORY_LABELS,
  FLAG_LABELS,
  SEVERITY_BADGE,
  SEVERITY_LABELS,
  SEVERITY_ORDER,
  STATUS_LABELS,
  STATUS_ORDER,
  classifyReason,
  deleteReportedContent,
  fetchModerationReports,
  isActiveBan,
  moderateUser,
  scanMessage,
  updateReport,
  warnUser,
  type ModerationAction,
  type ModerationReport,
  type ReportCategory,
  type ReportSeverity,
  type ReportStatus,
} from "@/lib/moderation";

interface ConvoMessage {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

type StatusFilter = "all" | ReportStatus;
type SeverityFilter = "all" | ReportSeverity;
type CategoryFilter = "all" | ReportCategory;

export function ModerationQueue() {
  const { user } = useAuth();
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [query, setQuery] = useState("");

  const [openConvo, setOpenConvo] = useState<string | null>(null);
  const [convoMsgs, setConvoMsgs] = useState<ConvoMessage[]>([]);
  const [convoLoading, setConvoLoading] = useState(false);
  const [openHistory, setOpenHistory] = useState<string | null>(null);

  const [warnTarget, setWarnTarget] = useState<ModerationReport | null>(null);
  const [warnReason, setWarnReason] = useState("");
  const [warnSeverity, setWarnSeverity] = useState<ReportSeverity>("low");
  const [warnSaving, setWarnSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setReports(await fetchModerationReports());
    } catch {
      toast.error("Could not load the moderation queue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const patchLocal = (
    id: string,
    patch: { [K in keyof ModerationReport]?: ModerationReport[K] | null },
  ) =>
    setReports((rs) =>
      rs.map((r) => (r.id === id ? { ...r, ...(patch as Partial<ModerationReport>) } : r)),
    );

  const setStatus = async (r: ModerationReport, status: ReportStatus) => {
    const resolving = status === "resolved" || status === "dismissed";
    try {
      await updateReport(r.id, {
        status,
        resolved_by: resolving ? (user?.id ?? null) : null,
        resolved_at: resolving ? new Date().toISOString() : null,
      });
      patchLocal(r.id, {
        status,
        resolved_at: resolving ? new Date().toISOString() : null,
      });
      toast.success(`Report marked ${STATUS_LABELS[status].toLowerCase()}`);
    } catch {
      toast.error("Could not update the report.");
    }
  };

  const setSeverity = async (r: ModerationReport, severity: ReportSeverity) => {
    try {
      await updateReport(r.id, { severity });
      patchLocal(r.id, { severity });
    } catch {
      toast.error("Could not update severity.");
    }
  };

  const assign = async (r: ModerationReport, toMe: boolean) => {
    try {
      await updateReport(r.id, { assigned_to: toMe ? (user?.id ?? null) : null });
      patchLocal(r.id, {
        assigned_to: toMe ? (user?.id ?? null) : null,
        assignee_name: toMe ? "You" : null,
      });
      toast.success(toMe ? "Assigned to you" : "Unassigned");
    } catch {
      toast.error("Could not assign the report.");
    }
  };

  const moderate = async (r: ModerationReport, action: ModerationAction) => {
    try {
      await moderateUser(r.reported_id, action);
      const banned = action !== "restore";
      const until =
        action === "suspend7"
          ? new Date(Date.now() + 7 * 86400000).toISOString()
          : action === "suspend30"
            ? new Date(Date.now() + 30 * 86400000).toISOString()
            : null;
      // reflect on every report against this user
      setReports((rs) =>
        rs.map((x) =>
          x.reported_id === r.reported_id
            ? ({
                ...x,
                reported_is_banned: banned,
                reported_banned_until: until,
              } as ModerationReport)
            : x,
        ),
      );
      toast.success(
        action === "restore"
          ? `${r.reported_name} restored`
          : action === "ban"
            ? `${r.reported_name} permanently banned`
            : `${r.reported_name} suspended`,
      );
    } catch {
      toast.error("Could not update the account.");
    }
  };

  const submitWarn = async () => {
    if (!warnTarget || !user || !warnReason.trim()) return;
    setWarnSaving(true);
    try {
      await warnUser(
        warnTarget.reported_id,
        user.id,
        warnReason.trim(),
        warnSeverity,
        warnTarget.id,
      );
      toast.success(`Warning issued to ${warnTarget.reported_name}`);
      setWarnTarget(null);
      setWarnReason("");
      setWarnSeverity("low");
    } catch {
      toast.error("Could not issue the warning.");
    } finally {
      setWarnSaving(false);
    }
  };

  const toggleConvo = async (matchId: string) => {
    if (openConvo === matchId) {
      setOpenConvo(null);
      setConvoMsgs([]);
      return;
    }
    setOpenConvo(matchId);
    setConvoMsgs([]);
    setConvoLoading(true);
    const { data } = await supabase
      .from("messages")
      .select("id, sender_id, content, created_at")
      .eq("match_id", matchId)
      .order("created_at", { ascending: true })
      .limit(300);
    setConvoMsgs(data ?? []);
    setConvoLoading(false);
  };

  const removeMessage = async (id: string) => {
    try {
      await deleteReportedContent("message", id);
      setConvoMsgs((ms) => ms.filter((m) => m.id !== id));
      toast.success("Message removed");
    } catch {
      toast.error("Could not remove the message.");
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reports.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (severityFilter !== "all" && r.severity !== severityFilter) return false;
      if (categoryFilter !== "all" && r.category !== categoryFilter) return false;
      if (q) {
        const hay =
          `${r.reported_name} ${r.reporter_name} ${r.reason} ${r.details ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [reports, statusFilter, severityFilter, categoryFilter, query]);

  if (loading) return <PanelLoader />;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search reports…"
          className="min-w-[180px] flex-1 rounded-full"
        />
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-36 rounded-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_ORDER.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={severityFilter}
          onValueChange={(v) => setSeverityFilter(v as SeverityFilter)}
        >
          <SelectTrigger className="w-36 rounded-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severity</SelectItem>
            {SEVERITY_ORDER.map((s) => (
              <SelectItem key={s} value={s}>
                {SEVERITY_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={categoryFilter}
          onValueChange={(v) => setCategoryFilter(v as CategoryFilter)}
        >
          <SelectTrigger className="w-40 rounded-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {(Object.keys(CATEGORY_LABELS) as ReportCategory[]).map((c) => (
              <SelectItem key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-sm text-muted-foreground">
        {filtered.length} of {reports.length} reports
      </p>

      {filtered.length === 0 ? (
        <EmptyState>No reports match these filters. 🎉</EmptyState>
      ) : (
        <ul className="space-y-3">
          {filtered.map((r) => {
            const banned = isActiveBan(r.reported_is_banned, r.reported_banned_until);
            const multiReporter = (r.reported_distinct_reporters ?? 0) >= 2;
            const repeated = (r.reported_total_reports ?? 0) >= 3;
            const history = reports.filter((x) => x.reported_id === r.reported_id);
            return (
              <li key={r.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium text-destructive">{r.reported_name}</span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-medium",
                          SEVERITY_BADGE[r.severity],
                        )}
                      >
                        {SEVERITY_LABELS[r.severity]}
                      </span>
                      <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
                        {CATEGORY_LABELS[r.category]}
                      </span>
                      {banned && (
                        <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                          {r.reported_banned_until ? "Suspended" : "Banned"}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Reported by {r.reporter_name}
                      {r.assignee_name && (
                        <>
                          {" "}
                          · assigned to{" "}
                          <span className="font-medium text-foreground">{r.assignee_name}</span>
                        </>
                      )}
                    </p>
                    <p className="mt-1 text-sm font-medium">{r.reason}</p>
                    {r.details && <p className="mt-1 text-sm text-muted-foreground">{r.details}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()}
                      {r.match_id && " · conversation report"}
                    </p>
                    {(multiReporter || repeated) && (
                      <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {multiReporter
                          ? `Reported by ${r.reported_distinct_reporters} different people`
                          : `${r.reported_total_reports} reports on this member`}
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Select value={r.status} onValueChange={(v) => setStatus(r, v as ReportStatus)}>
                      <SelectTrigger className="w-32 rounded-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_ORDER.map((s) => (
                          <SelectItem key={s} value={s}>
                            {STATUS_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="rounded-full">
                          Actions
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel>Assignment</DropdownMenuLabel>
                        {r.assigned_to === user?.id ? (
                          <DropdownMenuItem onClick={() => assign(r, false)}>
                            <UserCheck className="h-4 w-4" /> Unassign
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => assign(r, true)}>
                            <UserCheck className="h-4 w-4" /> Assign to me
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>Severity</DropdownMenuLabel>
                        {SEVERITY_ORDER.map((s) => (
                          <DropdownMenuItem
                            key={s}
                            disabled={r.severity === s}
                            onClick={() => setSeverity(r, s)}
                          >
                            <Flag className="h-4 w-4" /> {SEVERITY_LABELS[s]}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>Account</DropdownMenuLabel>
                        <DropdownMenuItem
                          onClick={() => {
                            setWarnTarget(r);
                            setWarnReason(r.reason);
                            setWarnSeverity(r.severity);
                          }}
                        >
                          <ShieldAlert className="h-4 w-4" /> Warn user
                        </DropdownMenuItem>
                        {banned ? (
                          <DropdownMenuItem onClick={() => moderate(r, "restore")}>
                            <ShieldCheck className="h-4 w-4" /> Restore account
                          </DropdownMenuItem>
                        ) : (
                          <>
                            <DropdownMenuItem onClick={() => moderate(r, "suspend7")}>
                              <Ban className="h-4 w-4" /> Suspend 7 days
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => moderate(r, "suspend30")}>
                              <Ban className="h-4 w-4" /> Suspend 30 days
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => moderate(r, "ban")}
                            >
                              <Ban className="h-4 w-4" /> Ban permanently
                            </DropdownMenuItem>
                          </>
                        )}
                        {r.match_id && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => toggleConvo(r.match_id!)}>
                              <MessageSquare className="h-4 w-4" />
                              {openConvo === r.match_id
                                ? "Hide conversation"
                                : "Review conversation"}
                            </DropdownMenuItem>
                          </>
                        )}
                        {history.length > 1 && (
                          <DropdownMenuItem
                            onClick={() =>
                              setOpenHistory(openHistory === r.reported_id ? null : r.reported_id)
                            }
                          >
                            <HistoryIcon className="h-4 w-4" />
                            {openHistory === r.reported_id
                              ? "Hide history"
                              : `History (${history.length})`}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {openHistory === r.reported_id && history.length > 1 && (
                  <div className="mt-3 rounded-xl border border-border bg-muted/40 p-3">
                    <p className="mb-2 text-xs font-semibold text-muted-foreground">
                      Report history for {r.reported_name}
                    </p>
                    <ul className="space-y-1.5 text-sm">
                      {history.map((h) => (
                        <li key={h.id} className="flex items-center justify-between gap-2">
                          <span className="truncate">
                            <span className="text-muted-foreground">
                              {CATEGORY_LABELS[h.category]} ·{" "}
                            </span>
                            {h.reason}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {STATUS_LABELS[h.status]} ·{" "}
                            {new Date(h.created_at).toLocaleDateString()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {r.match_id && openConvo === r.match_id && (
                  <div className="mt-3 rounded-xl border border-border bg-muted/40 p-3">
                    {convoLoading ? (
                      <div className="grid h-20 place-items-center">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      </div>
                    ) : convoMsgs.length === 0 ? (
                      <p className="py-4 text-center text-sm text-muted-foreground">
                        No messages in this conversation.
                      </p>
                    ) : (
                      <div className="max-h-80 space-y-2 overflow-y-auto">
                        {convoMsgs.map((m) => {
                          const fromReported = m.sender_id === r.reported_id;
                          const flags = scanMessage(m.content);
                          return (
                            <div
                              key={m.id}
                              className={cn(
                                "group rounded-lg p-2 text-sm",
                                flags.length ? "bg-destructive/5" : "",
                              )}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <span
                                    className={cn(
                                      "font-medium",
                                      fromReported ? "text-destructive" : "text-foreground",
                                    )}
                                  >
                                    {fromReported ? r.reported_name : r.reporter_name}:
                                  </span>{" "}
                                  <span className="text-foreground/90">{m.content}</span>
                                  <span className="ml-2 text-[10px] text-muted-foreground">
                                    {new Date(m.created_at).toLocaleString()}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeMessage(m.id)}
                                  aria-label="Delete message"
                                  className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                              {flags.length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {flags.map((f) => (
                                    <span
                                      key={f}
                                      className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive"
                                    >
                                      {FLAG_LABELS[f]}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Read-only moderator view. Hover a message to remove it.
                    </p>
                  </div>
                )}

                <ModerationNotes reportId={r.id} />
              </li>
            );
          })}
        </ul>
      )}

      {/* Warn dialog */}
      <Dialog open={!!warnTarget} onOpenChange={(o) => !o && setWarnTarget(null)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>Warn {warnTarget?.reported_name}</DialogTitle>
            <DialogDescription>
              The member will see this warning in their account. This action is logged.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select
              value={warnSeverity}
              onValueChange={(v) => setWarnSeverity(v as ReportSeverity)}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEVERITY_ORDER.map((s) => (
                  <SelectItem key={s} value={s}>
                    {SEVERITY_LABELS[s]} severity
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              value={warnReason}
              onChange={(e) => setWarnReason(e.target.value)}
              placeholder="Reason for the warning…"
              className="min-h-24 rounded-xl"
              maxLength={500}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setWarnTarget(null)}>
              Cancel
            </Button>
            <Button onClick={submitWarn} disabled={warnSaving || !warnReason.trim()}>
              {warnSaving && <Loader2 className="h-4 w-4 animate-spin" />} Issue warning
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Re-exported so the dialog stays in sync with classification rules.
export { classifyReason };
