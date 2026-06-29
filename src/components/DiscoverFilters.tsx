import { useEffect, useState } from "react";
import { SlidersHorizontal, RotateCcw } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChipSelect, InterestChips } from "@/components/ChipSelect";
import { INTEREST_OPTIONS } from "@/lib/membership";
import {
  LANGUAGE_OPTIONS,
  RELIGION_OPTIONS,
  EDUCATION_OPTIONS,
  RELATIONSHIP_GOAL_OPTIONS,
  PROFESSION_OPTIONS,
  SMOKING_OPTIONS,
  DRINKING_OPTIONS,
  WORKOUT_OPTIONS,
  FAMILY_PLANS_OPTIONS,
  PETS_OPTIONS,
} from "@/lib/constants";
import { fetchOptions, type OptionItem } from "@/lib/filter-options";
import type { DiscoverFilters } from "@/lib/profiles";

export const DEFAULT_FILTERS: DiscoverFilters = {
  maxDistanceKm: null,
  minAge: 18,
  maxAge: 80,
  country: "",
  state: "",
  city: "",
  onlineOnly: false,
  recentlyActive: false,
  verifiedOnly: false,
  premiumOnly: false,
  hasBio: false,
  interests: [],
  languages: [],
  religion: null,
  education: null,
  relationshipGoal: null,
  profession: null,
  smoking: null,
  drinking: null,
  workout: null,
  familyPlans: null,
  pets: null,
};

const ANY = "__any__";

/** Counts how many filters differ from the defaults (for the badge). */
export function activeFilterCount(f: DiscoverFilters): number {
  let n = 0;
  if (f.maxDistanceKm != null) n++;
  if ((f.minAge ?? 18) !== 18 || (f.maxAge ?? 80) !== 80) n++;
  if (f.country) n++;
  if (f.state) n++;
  if (f.city) n++;
  if (f.onlineOnly) n++;
  if (f.recentlyActive) n++;
  if (f.verifiedOnly) n++;
  if (f.premiumOnly) n++;
  if (f.hasBio) n++;
  if (f.interests && f.interests.length) n++;
  if (f.languages && f.languages.length) n++;
  if (f.religion) n++;
  if (f.education) n++;
  if (f.relationshipGoal) n++;
  if (f.profession) n++;
  if (f.smoking) n++;
  if (f.drinking) n++;
  if (f.workout) n++;
  if (f.familyPlans) n++;
  if (f.pets) n++;
  return n;
}

/** The editable filter body, reused by the sheet and the advanced search page. */
export function FilterFields({
  draft,
  set,
  toggleArr,
}: {
  draft: DiscoverFilters;
  set: <K extends keyof DiscoverFilters>(key: K, v: DiscoverFilters[K]) => void;
  toggleArr: (key: "interests" | "languages", v: string) => void;
}) {
  // Admin-managed option lists, with built-in constants as the fallback.
  const [interestOpts, setInterestOpts] = useState<string[]>([...INTEREST_OPTIONS]);
  const [languageOpts, setLanguageOpts] = useState<OptionItem[]>(
    LANGUAGE_OPTIONS.map((l) => ({ value: l, label: l })),
  );
  const [goalOpts, setGoalOpts] = useState<OptionItem[]>([...RELATIONSHIP_GOAL_OPTIONS]);
  const [religionOpts, setReligionOpts] = useState<OptionItem[]>([...RELIGION_OPTIONS]);
  const [educationOpts, setEducationOpts] = useState<OptionItem[]>([...EDUCATION_OPTIONS]);
  const [professionOpts, setProfessionOpts] = useState<OptionItem[]>([...PROFESSION_OPTIONS]);

  useEffect(() => {
    let active = true;
    (async () => {
      const [i, l, g, r, e, p] = await Promise.all([
        fetchOptions("interest"),
        fetchOptions("language"),
        fetchOptions("relationship_goal"),
        fetchOptions("religion"),
        fetchOptions("education"),
        fetchOptions("profession"),
      ]);
      if (!active) return;
      if (i.length) setInterestOpts(i.map((o) => o.value));
      if (l.length) setLanguageOpts(l);
      if (g.length) setGoalOpts(g);
      if (r.length) setReligionOpts(r);
      if (e.length) setEducationOpts(e);
      if (p.length) setProfessionOpts(p);
    })();
    return () => {
      active = false;
    };
  }, []);

  const distance = draft.maxDistanceKm ?? 500;
  const minAge = draft.minAge ?? 18;
  const maxAge = draft.maxAge ?? 80;

  return (
    <div className="flex-1 space-y-7 py-5">
      {/* Distance */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <Label>Maximum distance</Label>
          <span className="text-sm text-muted-foreground">
            {draft.maxDistanceKm == null ? "Any distance" : `${distance} km`}
          </span>
        </div>
        <Slider
          min={1}
          max={500}
          step={1}
          value={[distance]}
          onValueChange={([v]) => set("maxDistanceKm", v)}
        />
        <button
          type="button"
          className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:underline"
          onClick={() => set("maxDistanceKm", draft.maxDistanceKm == null ? 100 : null)}
        >
          {draft.maxDistanceKm == null ? "Set a distance limit" : "Show any distance"}
        </button>
      </div>

      {/* Age */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <Label>Age range</Label>
          <span className="text-sm text-muted-foreground">
            {minAge}–{maxAge}
          </span>
        </div>
        <Slider
          min={18}
          max={80}
          step={1}
          minStepsBetweenThumbs={1}
          value={[minAge, maxAge]}
          onValueChange={([lo, hi]) => {
            set("minAge", lo);
            set("maxAge", hi);
          }}
        />
      </div>

      {/* Country / State / City */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label htmlFor="f-country">Country</Label>
          <Input
            id="f-country"
            value={draft.country ?? ""}
            onChange={(e) => set("country", e.target.value)}
            placeholder="Any"
            className="rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="f-state">State</Label>
          <Input
            id="f-state"
            value={draft.state ?? ""}
            onChange={(e) => set("state", e.target.value)}
            placeholder="Any"
            className="rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="f-city">City</Label>
          <Input
            id="f-city"
            value={draft.city ?? ""}
            onChange={(e) => set("city", e.target.value)}
            placeholder="Any"
            className="rounded-xl"
          />
        </div>
      </div>

      {/* Toggles */}
      <div className="space-y-3">
        <ToggleRow
          label="Online now"
          checked={!!draft.onlineOnly}
          onChange={(v) => set("onlineOnly", v)}
        />
        <ToggleRow
          label="Recently active"
          checked={!!draft.recentlyActive}
          onChange={(v) => set("recentlyActive", v)}
        />
        <ToggleRow
          label="Verified members only"
          checked={!!draft.verifiedOnly}
          onChange={(v) => set("verifiedOnly", v)}
        />
        <ToggleRow
          label="Gold and Platinum members only"
          checked={!!draft.premiumOnly}
          onChange={(v) => set("premiumOnly", v)}
        />
        <ToggleRow label="Has a bio" checked={!!draft.hasBio} onChange={(v) => set("hasBio", v)} />
      </div>

      {/* Selects */}
      <div className="grid gap-4 sm:grid-cols-2">
        <FilterSelect
          label="Looking for"
          value={draft.relationshipGoal}
          onChange={(v) => set("relationshipGoal", v)}
          options={goalOpts}
        />
        <FilterSelect
          label="Profession"
          value={draft.profession}
          onChange={(v) => set("profession", v)}
          options={professionOpts}
        />
        <FilterSelect
          label="Religion"
          value={draft.religion}
          onChange={(v) => set("religion", v)}
          options={religionOpts}
        />
        <FilterSelect
          label="Education"
          value={draft.education}
          onChange={(v) => set("education", v)}
          options={educationOpts}
        />
        <FilterSelect
          label="Smoking"
          value={draft.smoking}
          onChange={(v) => set("smoking", v)}
          options={SMOKING_OPTIONS}
        />
        <FilterSelect
          label="Drinking"
          value={draft.drinking}
          onChange={(v) => set("drinking", v)}
          options={DRINKING_OPTIONS}
        />
        <FilterSelect
          label="Workout"
          value={draft.workout}
          onChange={(v) => set("workout", v)}
          options={WORKOUT_OPTIONS}
        />
        <FilterSelect
          label="Family plans"
          value={draft.familyPlans}
          onChange={(v) => set("familyPlans", v)}
          options={FAMILY_PLANS_OPTIONS}
        />
        <FilterSelect
          label="Pets"
          value={draft.pets}
          onChange={(v) => set("pets", v)}
          options={PETS_OPTIONS}
        />
      </div>

      {/* Interests */}
      <div>
        <Label className="mb-2 block">Interests</Label>
        <InterestChips
          options={interestOpts}
          selected={draft.interests ?? []}
          onToggle={(v) => toggleArr("interests", v)}
        />
      </div>

      {/* Languages */}
      <div>
        <Label className="mb-2 block">Languages</Label>
        <ChipSelect
          options={languageOpts}
          selected={draft.languages ?? []}
          onToggle={(v) => toggleArr("languages", v)}
        />
      </div>
    </div>
  );
}

export function DiscoverFiltersSheet({
  open,
  onOpenChange,
  value,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: DiscoverFilters;
  onApply: (filters: DiscoverFilters) => void;
}) {
  const [draft, setDraft] = useState<DiscoverFilters>(value);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  const set = <K extends keyof DiscoverFilters>(key: K, v: DiscoverFilters[K]) =>
    setDraft((d) => ({ ...d, [key]: v }));

  const toggleArr = (key: "interests" | "languages", v: string) =>
    setDraft((d) => {
      const arr = d[key] ?? [];
      return { ...d, [key]: arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v] };
    });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5" /> Discovery filters
          </SheetTitle>
          <SheetDescription>Fine-tune who you see in Discover.</SheetDescription>
        </SheetHeader>

        <FilterFields draft={draft} set={set} toggleArr={toggleArr} />

        <SheetFooter className="flex-row gap-2 border-t pt-4">
          <Button
            variant="outline"
            className="flex-1 rounded-xl"
            onClick={() => setDraft(DEFAULT_FILTERS)}
          >
            <RotateCcw className="h-4 w-4" /> Reset
          </Button>
          <Button
            variant="hero"
            className="flex-1 rounded-xl"
            onClick={() => {
              onApply(draft);
              onOpenChange(false);
            }}
          >
            Show results
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
      <Label className="cursor-pointer">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  options: readonly { value: string; label: string }[];
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value ?? ANY} onValueChange={(v) => onChange(v === ANY ? null : v)}>
        <SelectTrigger className="rounded-xl">
          <SelectValue placeholder="Any" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Any</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
