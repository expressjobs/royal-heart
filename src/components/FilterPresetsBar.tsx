import { useCallback, useEffect, useState } from "react";
import { Bookmark, Plus, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  listPresets,
  savePreset,
  deletePreset,
  setPresetQuick,
  type FilterPreset,
} from "@/lib/presets";
import { activeFilterCount } from "@/components/DiscoverFilters";
import type { DiscoverFilters } from "@/lib/profiles";
import { cn } from "@/lib/utils";

export function FilterPresetsBar({
  current,
  onApply,
}: {
  current: DiscoverFilters;
  onApply: (f: DiscoverFilters) => void;
}) {
  const { user } = useAuth();
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [manageOpen, setManageOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setPresets(await listPresets(user.id));
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const quick = presets.filter((p) => p.is_quick);

  const handleSave = async () => {
    if (!user) return;
    setBusy(true);
    const created = await savePreset(user.id, name, current);
    setBusy(false);
    if (!created) {
      toast.error("Could not save filter.");
      return;
    }
    setName("");
    setSaveOpen(false);
    toast.success("Filter saved");
    load();
  };

  const handleDelete = async (id: string) => {
    await deletePreset(id);
    setPresets((p) => p.filter((x) => x.id !== id));
  };

  const toggleQuick = async (p: FilterPreset) => {
    await setPresetQuick(p.id, !p.is_quick);
    setPresets((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_quick: !x.is_quick } : x)));
  };

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {quick.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onApply(p.filters)}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary"
        >
          <Star className="h-3.5 w-3.5 text-gold" fill="currentColor" />
          {p.name}
        </button>
      ))}

      <Button
        variant="outline"
        size="sm"
        className="rounded-full text-xs"
        onClick={() => setSaveOpen(true)}
        disabled={activeFilterCount(current) === 0}
      >
        <Plus className="h-3.5 w-3.5" /> Save filter
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="rounded-full text-xs text-muted-foreground"
        onClick={() => setManageOpen(true)}
      >
        <Bookmark className="h-3.5 w-3.5" /> Saved ({presets.length})
      </Button>

      {/* Save dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save current filters</DialogTitle>
            <DialogDescription>Give this set of filters a name to reuse later.</DialogDescription>
          </DialogHeader>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Nearby & verified"
            maxLength={60}
            className="rounded-xl"
          />
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            <Button variant="hero" className="rounded-xl" onClick={handleSave} disabled={busy}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage dialog */}
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Saved filters</DialogTitle>
            <DialogDescription>Apply, pin as a quick filter, or delete.</DialogDescription>
          </DialogHeader>
          {presets.length === 0 ? (
            <p className="rounded-2xl bg-muted/50 p-4 text-sm text-muted-foreground">
              You haven't saved any filters yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {presets.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-2 rounded-2xl border border-border p-2.5"
                >
                  <button
                    type="button"
                    className="flex-1 truncate text-left text-sm font-medium"
                    onClick={() => {
                      onApply(p.filters);
                      setManageOpen(false);
                    }}
                  >
                    {p.name}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {activeFilterCount(p.filters)} active
                    </span>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    onClick={() => toggleQuick(p)}
                    aria-label="Pin as quick filter"
                  >
                    <Star
                      className={cn("h-4 w-4", p.is_quick && "text-gold")}
                      fill={p.is_quick ? "currentColor" : "none"}
                    />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full text-destructive"
                    onClick={() => handleDelete(p.id)}
                    aria-label="Delete filter"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setManageOpen(false)}>
              <X className="h-4 w-4" /> Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
