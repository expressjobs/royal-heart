import { useCallback, useEffect, useState } from "react";
import { Loader2, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface NoteRow {
  id: string;
  note: string;
  author_id: string | null;
  created_at: string;
}

export function ModerationNotes({ reportId }: { reportId: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("moderation_notes")
      .select("id, note, author_id, created_at")
      .eq("report_id", reportId)
      .order("created_at", { ascending: true });
    const rows = data ?? [];
    setNotes(rows);
    const ids = [...new Set(rows.map((r) => r.author_id).filter(Boolean) as string[])];
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", ids);
      setNames(new Map((profs ?? []).map((p) => [p.id, p.display_name ?? "Moderator"])));
    }
    setLoading(false);
  }, [reportId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const add = async () => {
    if (!draft.trim() || !user) return;
    setSaving(true);
    const { error } = await supabase
      .from("moderation_notes")
      .insert({ report_id: reportId, author_id: user.id, note: draft.trim() });
    setSaving(false);
    if (error) return toast.error("Could not add note.");
    setDraft("");
    load();
  };

  return (
    <div className="mt-3 border-t border-border pt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <StickyNote className="h-4 w-4" />
        {open ? "Hide moderator notes" : "Moderator notes"}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {loading ? (
            <div className="grid h-12 place-items-center">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
          ) : notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notes yet.</p>
          ) : (
            <ul className="space-y-2">
              {notes.map((n) => (
                <li key={n.id} className="rounded-xl bg-muted/40 p-3 text-sm">
                  <p className="whitespace-pre-wrap">{n.note}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {n.author_id ? (names.get(n.author_id) ?? "Moderator") : "System"} ·{" "}
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              placeholder="Add an internal note…"
              className="flex-1"
            />
            <Button size="sm" onClick={add} disabled={saving || !draft.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
