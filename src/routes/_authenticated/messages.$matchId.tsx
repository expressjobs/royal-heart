import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Ban,
  Check,
  CheckCheck,
  Flag,
  HeartOff,
  Loader2,
  MoreVertical,
  Send,
  ShieldAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePresence, presenceLabel } from "@/contexts/PresenceContext";
import { AppShell } from "@/components/AppShell";
import { ComfortControls } from "@/components/ComfortControls";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import { PresenceDot } from "@/components/PresenceIndicator";
import { VerifiedBadge } from "@/components/TierBadge";
import { ReportDialog, blockUser } from "@/components/ReportDialog";
import { MessageContent } from "@/components/chat/MessageContent";
import { UpgradeModal } from "@/components/discover/UpgradeModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fetchOneProfile, primaryPhotoPath, type ProfileWithPhotos } from "@/lib/profiles";
import {
  scanMessage,
  FLAG_LABELS,
  FLAG_HINTS,
  FLAG_REPORT_REASON,
  type MessageFlag,
} from "@/lib/moderation";
import { capabilities } from "@/lib/membership";
import { sendMatchMessage } from "@/lib/discover.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/messages/$matchId")({
  head: () => ({ meta: [{ title: "Chat — HeartConnect" }] }),
  component: () => (
    <AppShell>
      <Chat />
    </AppShell>
  ),
});

interface Message {
  id: string;
  sender_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
}

const FREE_MESSAGE_CAP = 10;
const PAGE_SIZE = 30;

function Chat() {
  const { matchId } = Route.useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { isOnline } = usePresence();
  const caps = profile ? capabilities(profile.membership_tier) : capabilities("free");
  const sendMessageServer = useServerFn(sendMatchMessage);

  const [other, setOther] = useState<ProfileWithPhotos | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [reportPrefill, setReportPrefill] = useState<{ reason?: string; details?: string }>({});
  const [unmatchOpen, setUnmatchOpen] = useState(false);
  const [riskyOpen, setRiskyOpen] = useState(false);
  const [pendingRisky, setPendingRisky] = useState<{
    content: string;
    flags: MessageFlag[];
  } | null>(null);
  const [dismissedBanner, setDismissedBanner] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingStopTimer = useRef<number | null>(null);
  const lastTypingSent = useRef(0);

  const myMessageCount = messages.filter((m) => m.sender_id === user?.id).length;
  const otherOnline = isOnline(other?.id);

  // Real-time safety scan of incoming messages only (your own outgoing
  // messages are checked separately, before they're sent).
  const flagsByMessage = useMemo(() => {
    const map = new Map<string, MessageFlag[]>();
    for (const m of messages) {
      if (m.sender_id === user?.id) continue;
      const flags = scanMessage(m.content);
      if (flags.length) map.set(m.id, flags);
    }
    return map;
  }, [messages, user?.id]);

  // Highest-priority flag across the conversation drives the top safety banner.
  const bannerFlag = useMemo<MessageFlag | null>(() => {
    const order: MessageFlag[] = ["scam", "abusive", "link"];
    const present = new Set<MessageFlag>();
    flagsByMessage.forEach((flags) => flags.forEach((f) => present.add(f)));
    return order.find((f) => present.has(f)) ?? null;
  }, [flagsByMessage]);

  const openReport = useCallback((prefill?: { reason?: string; details?: string }) => {
    setReportPrefill(prefill ?? {});
    setReportOpen(true);
  }, []);

  const markRead = useCallback(async () => {
    if (!user) return;
    await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("match_id", matchId)
      .neq("sender_id", user.id)
      .is("read_at", null);
  }, [matchId, user]);

  const load = useCallback(async () => {
    if (!user) return;
    const { data: match } = await supabase
      .from("matches")
      .select("user1_id, user2_id")
      .eq("id", matchId)
      .maybeSingle();
    if (!match) {
      toast.error("Conversation not found.");
      navigate({ to: "/messages" });
      return;
    }
    // Ensure the current user actually belongs to this match.
    if (match.user1_id !== user.id && match.user2_id !== user.id) {
      toast.error("You don't have access to this conversation.");
      navigate({ to: "/messages" });
      return;
    }
    const otherId = match.user1_id === user.id ? match.user2_id : match.user1_id;
    const [prof, { data: msgs }] = await Promise.all([
      fetchOneProfile(otherId),
      supabase
        .from("messages")
        .select("id, sender_id, content, read_at, created_at")
        .eq("match_id", matchId)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE),
    ]);
    setOther(prof);
    const page = (msgs ?? []).slice().reverse();
    setMessages(page);
    setHasMore((msgs ?? []).length === PAGE_SIZE);
    setLoading(false);
    await markRead();
  }, [matchId, user, navigate, markRead]);

  const loadOlder = useCallback(async () => {
    if (loadingOlder || !hasMore || messages.length === 0) return;
    setLoadingOlder(true);
    const oldest = messages[0].created_at;
    const container = scrollRef.current;
    const prevHeight = container?.scrollHeight ?? 0;
    const { data: older } = await supabase
      .from("messages")
      .select("id, sender_id, content, read_at, created_at")
      .eq("match_id", matchId)
      .lt("created_at", oldest)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);
    const batch = (older ?? []).slice().reverse();
    if (batch.length > 0) {
      setMessages((prev) => [...batch, ...prev]);
      // Preserve scroll position after prepending.
      requestAnimationFrame(() => {
        if (container) container.scrollTop = container.scrollHeight - prevHeight;
      });
    }
    setHasMore((older ?? []).length === PAGE_SIZE);
    setLoadingOlder(false);
  }, [loadingOlder, hasMore, messages, matchId]);

  useEffect(() => {
    load();
  }, [load]);

  // realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`chat-${matchId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `match_id=eq.${matchId}` },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          if (m.sender_id !== user.id) markRead();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `match_id=eq.${matchId}` },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) =>
            prev.map((x) => (x.id === m.id ? { ...x, read_at: m.read_at } : x)),
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId, user, markRead]);

  // Typing indicator over an ephemeral broadcast channel (no DB writes).
  useEffect(() => {
    if (!user) return;
    let clearTimer: number | null = null;
    const channel = supabase.channel(`typing-${matchId}`, {
      config: { broadcast: { self: false } },
    });
    channel
      .on("broadcast", { event: "typing" }, (payload) => {
        if (payload.payload?.userId === user.id) return;
        setOtherTyping(Boolean(payload.payload?.typing));
        if (clearTimer) window.clearTimeout(clearTimer);
        if (payload.payload?.typing) {
          clearTimer = window.setTimeout(() => setOtherTyping(false), 4000);
        }
      })
      .subscribe();
    typingChannelRef.current = channel;
    return () => {
      if (clearTimer) window.clearTimeout(clearTimer);
      supabase.removeChannel(channel);
      typingChannelRef.current = null;
    };
  }, [matchId, user]);

  const emitTyping = useCallback(
    (typing: boolean) => {
      if (!user || !typingChannelRef.current) return;
      typingChannelRef.current.send({
        type: "broadcast",
        event: "typing",
        payload: { userId: user.id, typing },
      });
    },
    [user],
  );

  const handleInput = (value: string) => {
    setText(value);
    const now = Date.now();
    if (now - lastTypingSent.current > 1500) {
      lastTypingSent.current = now;
      emitTyping(true);
    }
    if (typingStopTimer.current) window.clearTimeout(typingStopTimer.current);
    typingStopTimer.current = window.setTimeout(() => emitTyping(false), 2000);
  };

  // Auto-scroll to newest, but not while paging in older history.
  useEffect(() => {
    if (loadingOlder) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, otherTyping, loadingOlder]);

  const deliver = async (content: string) => {
    if (!user) return;
    setSending(true);
    setText("");
    emitTyping(false);
    if (typingStopTimer.current) window.clearTimeout(typingStopTimer.current);
    try {
      const result = await sendMessageServer({ data: { matchId, content } });
      if (result.gated) {
        setUpgradeOpen(true);
        setText(content);
        return;
      }
      if (!result.ok) throw new Error(result.error ?? "Message failed to send.");
    } catch (err) {
      const msg =
        err instanceof Error && err.message.includes("limit")
          ? err.message
          : "Message failed to send.";
      toast.error(msg);
      setText(content);
    } finally {
      setSending(false);
    }
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = text.trim();
    if (!content || !user || sending) return;
    if (profile?.membership_tier !== "gold" && profile?.membership_tier !== "platinum") {
      setUpgradeOpen(true);
      return;
    }
    if (!caps.unlimitedMessaging && myMessageCount >= FREE_MESSAGE_CAP) {
      toast.error(
        "You've reached the free messaging limit. Upgrade to Gold for unlimited messaging!",
      );
      return;
    }
    // Real-time outgoing safety check — warn before sending risky content.
    const flags = scanMessage(content);
    if (flags.length) {
      setPendingRisky({ content, flags });
      setRiskyOpen(true);
      return;
    }
    await deliver(content);
  };

  const handleBlock = async () => {
    if (!user || !other) return;
    try {
      await blockUser(user.id, other.id);
      toast.success(`${other.display_name} has been blocked.`);
      navigate({ to: "/messages" });
    } catch {
      toast.error("Could not block user.");
    }
  };

  const handleUnmatch = async () => {
    if (!user) return;
    try {
      const { error } = await supabase.from("matches").delete().eq("id", matchId);
      if (error) throw error;
      toast.success(other ? `You unmatched ${other.display_name}.` : "Unmatched.");
      navigate({ to: "/messages" });
    } catch {
      toast.error("Could not unmatch.");
    }
  };

  if (loading) {
    return (
      <div className="grid h-[60vh] place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-9rem)] max-w-2xl flex-col md:h-[calc(100vh-12rem)]">
      {/* header */}
      <div className="flex items-center gap-3 border-b border-border pb-3">
        <Button asChild variant="ghost" size="icon" className="rounded-full">
          <Link to="/messages" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        {other && (
          <Link
            to="/profile/$id"
            params={{ id: other.id }}
            className="flex min-w-0 flex-1 items-center gap-3"
          >
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full">
              <ProfilePhoto
                path={primaryPhotoPath(other)}
                alt={other.display_name ?? ""}
                rounded="rounded-full"
              />
            </div>
            <PresenceDot
              online={otherOnline}
              lastActive={other.last_active}
              className="-ml-4 mt-6 h-3 w-3"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="truncate font-semibold">{other.display_name}</span>
                {other.is_verified && <VerifiedBadge className="h-4 w-4 shrink-0" />}
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {otherTyping ? (
                  <span className="text-primary">typing…</span>
                ) : (
                  presenceLabel(otherOnline, other.last_active)
                )}
              </p>
            </div>
          </Link>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full" aria-label="More">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openReport()}>
              <Flag className="h-4 w-4" /> Report conversation
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setUnmatchOpen(true)}>
              <HeartOff className="h-4 w-4" /> Unmatch
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleBlock}
              className="text-destructive focus:text-destructive"
            >
              <Ban className="h-4 w-4" /> Block &amp; unmatch
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* real-time safety banner */}
      {bannerFlag && !dismissedBanner && (
        <div className="mt-3 flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-amber-700 dark:text-amber-300">Safety check</p>
            <p className="text-muted-foreground">{FLAG_HINTS[bannerFlag]}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-full border-amber-500/40"
                onClick={() => openReport({ reason: FLAG_REPORT_REASON[bannerFlag] })}
              >
                <Flag className="h-3.5 w-3.5" /> Report
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-full border-destructive/40 text-destructive hover:text-destructive"
                onClick={handleBlock}
              >
                <Ban className="h-3.5 w-3.5" /> Block
              </Button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDismissedBanner(true)}
            className="rounded-full p-1 text-muted-foreground hover:bg-amber-500/10"
            aria-label="Dismiss safety notice"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {other && (
        <ComfortControls
          personName={other.display_name}
          context="chat"
          onReport={() => openReport()}
          onBlock={handleBlock}
          className="mt-3"
        />
      )}

      {/* messages */}
      <div
        ref={scrollRef}
        onScroll={(e) => {
          if (e.currentTarget.scrollTop < 60 && hasMore && !loadingOlder) loadOlder();
        }}
        className="flex-1 space-y-1 overflow-y-auto py-4"
      >
        {loadingOlder && (
          <div className="flex justify-center py-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {!hasMore && messages.length > 0 && (
          <p className="pb-2 text-center text-[11px] text-muted-foreground">
            Start of conversation
          </p>
        )}
        {messages.length === 0 && (
          <p className="mt-10 text-center text-sm text-muted-foreground">
            You matched! Say something nice to break the ice.
          </p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === user?.id;
          const flags = flagsByMessage.get(m.id);
          const time = new Date(m.created_at).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          });
          return (
            <div key={m.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-4 py-2 text-sm",
                  mine
                    ? "rounded-br-md bg-gradient-primary text-primary-foreground"
                    : "rounded-bl-md bg-muted text-foreground",
                  flags && "ring-1 ring-amber-500/50",
                )}
              >
                <MessageContent content={m.content} mine={mine} onReport={openReport} />
                <span
                  className={cn(
                    "mt-0.5 flex items-center justify-end gap-1 text-[10px]",
                    mine ? "text-primary-foreground/70" : "text-muted-foreground",
                  )}
                >
                  {time}
                  {mine &&
                    (m.read_at && caps.readReceipts ? (
                      <CheckCheck className="h-3 w-3" aria-label="Read" />
                    ) : m.read_at ? (
                      <CheckCheck className="h-3 w-3 opacity-80" aria-label="Delivered" />
                    ) : (
                      <Check className="h-3 w-3 opacity-80" aria-label="Sent" />
                    ))}
                </span>
              </div>
              {flags && (
                <div className="mt-1 flex max-w-[75%] flex-wrap items-center gap-1.5">
                  {flags.map((f) => (
                    <span
                      key={f}
                      className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300"
                    >
                      <ShieldAlert className="h-3 w-3" /> {FLAG_LABELS[f]}
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      openReport({
                        reason: FLAG_REPORT_REASON[flags[0]],
                        details: `Flagged message: "${m.content.slice(0, 200)}"`,
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-primary hover:underline"
                  >
                    <Flag className="h-3 w-3" /> Report
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {otherTyping && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-muted px-4 py-3">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* composer */}
      <form onSubmit={send} className="flex items-center gap-2 border-t border-border pt-3">
        <Input
          value={text}
          onChange={(e) => handleInput(e.target.value)}
          onBlur={() => emitTyping(false)}
          placeholder="Type a message..."
          className="rounded-full"
          maxLength={1000}
        />
        <Button
          type="submit"
          variant="hero"
          size="icon"
          className="shrink-0 rounded-full"
          disabled={sending || !text.trim()}
          aria-label="Send"
        >
          <Send className="h-5 w-5" />
        </Button>
      </form>
      {!caps.unlimitedMessaging && (
        <p className="pt-2 text-center text-[11px] text-muted-foreground">
          {Math.max(0, FREE_MESSAGE_CAP - myMessageCount)} free messages left ·{" "}
          <Link
            to="/premium"
            search={{ plan: "gold", period: "month" }}
            className="font-medium text-primary hover:underline"
          >
            Upgrade for unlimited
          </Link>
        </p>
      )}

      {other && (
        <ReportDialog
          open={reportOpen}
          onOpenChange={setReportOpen}
          reportedId={other.id}
          reportedName={other.display_name ?? "this user"}
          matchId={matchId}
          initialReason={reportPrefill.reason}
          initialDetails={reportPrefill.details}
        />
      )}

      <AlertDialog open={riskyOpen} onOpenChange={setRiskyOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              Send this message?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRisky?.flags.map((f) => FLAG_HINTS[f]).join(" ")} Only send if you're sure
              it's safe.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="rounded-full"
              onClick={() => {
                if (pendingRisky) setText(pendingRisky.content);
                setPendingRisky(null);
              }}
            >
              Edit message
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full"
              onClick={() => {
                if (pendingRisky) deliver(pendingRisky.content);
                setPendingRisky(null);
              }}
            >
              Send anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={unmatchOpen} onOpenChange={setUnmatchOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Unmatch {other?.display_name ?? "this person"}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the match and deletes your conversation for both of you. This can't be
              undone, and they won't reappear in your discovery feed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnmatch}
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Unmatch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </div>
  );
}
