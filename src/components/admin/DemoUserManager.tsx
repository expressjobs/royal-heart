import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  Database as DatabaseIcon,
  Copy,
  CheckCircle2,
  Eye,
  EyeOff,
  Filter,
  Loader2,
  Plus,
  Search,
  Save,
  Star,
  Trash2,
  Upload,
  UploadCloud,
  UserCheck,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import {
  deleteDemoPhoto,
  deleteDemoUser,
  duplicateDemoUser,
  addLibraryPhotoToDemoUser,
  bulkManageDemoUsers,
  bulkGenerateDemoUsers,
  fillMissingAvatars,
  fillMissingDemoPhotos,
  convertDemoUserToReal,
  deleteDemoDatasetImport,
  importDemoDataset,
  listDemoBatches,
  listDemoPhotoLibrary,
  listDemoDatasets,
  listDemoUsers,
  manageDemoBatch,
  reorderDemoPhotos,
  replaceDemoPhoto,
  saveDemoUser,
  setDemoPrimaryPhoto,
  setDemoDiscoverVisibility,
  updateDemoDatasetImport,
  uploadDemoLibraryPhoto,
  uploadDemoUserPhoto,
  type BulkDemoGeneratorInput,
  type DemoBatchRow,
  type DemoBulkAction,
  type DemoDatasetOverview,
  type DemoDatasetImportRow,
  type DemoLibraryPhoto,
  type DemoPhotoRow,
  type DemoUserRow,
  type SaveDemoUserInput,
} from "@/lib/demo-users.functions";
import { DEMO_COUNTRIES, generateDemoProfile, pickDemoName } from "@/lib/demo-profile-data";
import { photoPath } from "@/lib/profiles";
import type { Database } from "@/integrations/supabase/types";
import {
  EDUCATION_OPTIONS,
  GENDER_OPTIONS,
  INTERESTED_IN_OPTIONS,
  LANGUAGE_OPTIONS,
  RELATIONSHIP_GOAL_OPTIONS,
  RELIGION_OPTIONS,
} from "@/lib/constants";
import { INTEREST_OPTIONS, TIER_LABELS } from "@/lib/membership";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, PanelLoader } from "@/components/admin/shared";
import { cn } from "@/lib/utils";

type MembershipTier = Database["public"]["Enums"]["membership_tier"];

interface DemoDraft {
  id: string | null;
  displayName: string;
  age: string;
  gender: string;
  interestedIn: string[];
  country: string;
  city: string;
  bio: string;
  occupation: string;
  religion: string;
  education: string;
  relationshipGoal: string;
  interests: string[];
  languages: string[];
  latitude: string;
  longitude: string;
  lastActive: string;
  isVerified: boolean;
  membershipTier: MembershipTier;
  isActive: boolean;
}

const emptyDraft: DemoDraft = {
  id: null,
  displayName: "",
  age: "26",
  gender: "woman",
  interestedIn: ["everyone"],
  country: "",
  city: "",
  bio: "",
  occupation: "",
  religion: "",
  education: "",
  relationshipGoal: "long_term",
  interests: [],
  languages: ["English"],
  latitude: "",
  longitude: "",
  lastActive: toDateTimeLocal(new Date().toISOString()),
  isVerified: false,
  membershipTier: "free",
  isActive: true,
};

function ageFromBirthDate(value: string | null): number {
  if (!value) return 26;
  const birth = new Date(value);
  if (Number.isNaN(birth.getTime())) return 26;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDelta = today.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
}

function toDateTimeLocal(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function fromRow(row: DemoUserRow): DemoDraft {
  return {
    id: row.id,
    displayName: row.display_name ?? "",
    age: String(ageFromBirthDate(row.birth_date)),
    gender: row.gender ?? "woman",
    interestedIn: row.interested_in?.length ? row.interested_in : ["everyone"],
    country: row.location_country ?? "",
    city: row.location_city ?? "",
    bio: row.bio ?? "",
    occupation: row.profession ?? "",
    religion: row.religion ?? "",
    education: row.education ?? "",
    relationshipGoal: row.relationship_goal ?? "long_term",
    interests: row.interests ?? [],
    languages: row.languages?.length ? row.languages : ["English"],
    latitude: row.latitude == null ? "" : String(row.latitude),
    longitude: row.longitude == null ? "" : String(row.longitude),
    lastActive: toDateTimeLocal(row.last_active),
    isVerified: row.is_verified,
    membershipTier: row.membership_tier,
    isActive: row.is_active,
  };
}

function toPayload(draft: DemoDraft): SaveDemoUserInput {
  return {
    id: draft.id,
    displayName: draft.displayName,
    age: Number(draft.age),
    gender: draft.gender,
    interestedIn: draft.interestedIn,
    country: draft.country,
    city: draft.city,
    bio: draft.bio,
    occupation: draft.occupation,
    religion: draft.religion,
    education: draft.education,
    relationshipGoal: draft.relationshipGoal,
    interests: draft.interests,
    languages: draft.languages,
    latitude: draft.latitude ? Number(draft.latitude) : null,
    longitude: draft.longitude ? Number(draft.longitude) : null,
    lastActive: draft.lastActive
      ? new Date(draft.lastActive).toISOString()
      : new Date().toISOString(),
    isVerified: draft.isVerified,
    membershipTier: draft.membershipTier,
    isActive: draft.isActive,
  };
}

export function DemoUserManager() {
  const listFn = useServerFn(listDemoUsers);
  const saveFn = useServerFn(saveDemoUser);
  const deleteFn = useServerFn(deleteDemoUser);
  const duplicateFn = useServerFn(duplicateDemoUser);
  const visibilityFn = useServerFn(setDemoDiscoverVisibility);
  const convertFn = useServerFn(convertDemoUserToReal);
  const bulkManageFn = useServerFn(bulkManageDemoUsers);
  const bulkFn = useServerFn(bulkGenerateDemoUsers);
  const batchesFn = useServerFn(listDemoBatches);
  const batchManageFn = useServerFn(manageDemoBatch);
  const datasetsFn = useServerFn(listDemoDatasets);
  const importDatasetFn = useServerFn(importDemoDataset);
  const libraryFn = useServerFn(listDemoPhotoLibrary);
  const libraryUploadFn = useServerFn(uploadDemoLibraryPhoto);
  const addLibraryPhotoFn = useServerFn(addLibraryPhotoToDemoUser);
  const fillPhotosFn = useServerFn(fillMissingDemoPhotos);
  const fillAvatarsFn = useServerFn(fillMissingAvatars);
  const uploadFn = useServerFn(uploadDemoUserPhoto);
  const replacePhotoFn = useServerFn(replaceDemoPhoto);
  const primaryFn = useServerFn(setDemoPrimaryPhoto);
  const reorderFn = useServerFn(reorderDemoPhotos);
  const deletePhotoFn = useServerFn(deleteDemoPhoto);

  const [rows, setRows] = useState<DemoUserRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DemoDraft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<DemoBulkAction>("show");
  const [bulkTier, setBulkTier] = useState<MembershipTier>("gold");
  const [bulkVerified, setBulkVerified] = useState(true);
  const [query, setQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");
  const [verifiedFilter, setVerifiedFilter] = useState("all");
  const [premiumFilter, setPremiumFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");
  const [library, setLibrary] = useState<DemoLibraryPhoto[]>([]);
  const [batches, setBatches] = useState<DemoBatchRow[]>([]);
  const [overview, setOverview] = useState<DemoDatasetOverview | null>(null);
  const [builderStep, setBuilderStep] = useState(0);
  const [builderReport, setBuilderReport] = useState<string[]>([]);
  const [libraryFolder, setLibraryFolder] = useState<"male" | "female" | "neutral">("female");
  const [bulk, setBulk] = useState<BulkDemoGeneratorInput>({
    gender: "Mixed",
    country: "Any supported country",
    count: 50,
    allowPhotoReuse: false,
    verified: true,
    premium: true,
    active: true,
    discoverVisible: true,
    minAge: 23,
    maxAge: 48,
    verificationPercent: 35,
    freePercent: 68,
    premiumPercent: 25,
    goldPercent: 5,
    platinumPercent: 2,
    batchName: "Demo batch",
    photoSource: "mixed",
    locationMode: "all",
    countries: [],
    cities: [],
    region: "",
    coordinatesOnly: false,
    useImportedOnly: false,
  });

  const selected = useMemo(
    () => rows.find((row) => row.id === selectedId) ?? null,
    [rows, selectedId],
  );
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      const age = ageFromBirthDate(row.birth_date);
      const premium = row.membership_tier !== "free";
      const active = row.is_active && row.onboarding_complete;
      const haystack = [
        row.display_name,
        row.location_country,
        row.location_city,
        row.profession,
        row.bio,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (q && !haystack.includes(q) && !String(age).includes(q)) return false;
      if (countryFilter !== "all" && row.location_country !== countryFilter) return false;
      if (genderFilter !== "all" && row.gender !== genderFilter) return false;
      if (verifiedFilter !== "all" && row.is_verified !== (verifiedFilter === "yes")) return false;
      if (premiumFilter !== "all" && premium !== (premiumFilter === "yes")) return false;
      if (activeFilter !== "all" && active !== (activeFilter === "yes")) return false;
      return true;
    });
  }, [activeFilter, countryFilter, genderFilter, premiumFilter, query, rows, verifiedFilter]);

  const allVisibleSelected =
    visibleRows.length > 0 && visibleRows.every((row) => selectedSet.has(row.id));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listFn({});
      const libraryData = await libraryFn({});
      const batchData = await batchesFn({});
      const datasetData = await datasetsFn({});
      setRows(data);
      setLibrary(libraryData);
      setBatches(batchData);
      setOverview(datasetData as DemoDatasetOverview);
      if (!selectedId && data[0]) {
        setSelectedId(data[0].id);
        setDraft(fromRow(data[0]));
      }
    } catch {
      toast.error("Could not load demo users.");
    } finally {
      setLoading(false);
    }
  }, [batchesFn, datasetsFn, libraryFn, listFn, selectedId]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startNew = () => {
    setSelectedId(null);
    setDraft({ ...emptyDraft, lastActive: toDateTimeLocal(new Date().toISOString()) });
  };

  const selectRow = (row: DemoUserRow) => {
    setSelectedId(row.id);
    setDraft(fromRow(row));
  };

  const patchDraft = <K extends keyof DemoDraft>(key: K, value: DemoDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const toggleArray = (
    key: "interestedIn" | "interests" | "languages",
    value: string,
    max = 20,
  ) => {
    setDraft((current) => {
      const list = current[key];
      const next = list.includes(value)
        ? list.filter((item) => item !== value)
        : [...list, value].slice(0, max);
      return { ...current, [key]: next };
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const result = await saveFn({ data: toPayload(draft) });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (draft.id) toast.success("Demo user updated");
      else if (result.discoverReady) toast.success("Demo profile added to Discover.");
      else toast.success("Demo user created. Add a photo to show it in Discover.");
      const data = await listFn({});
      setRows(data);
      const saved = data.find((row) => row.id === result.id);
      if (saved) {
        setSelectedId(saved.id);
        setDraft(fromRow(saved));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save demo user.");
    } finally {
      setSaving(false);
    }
  };

  const setVisibility = async (row: DemoUserRow, visible: boolean) => {
    setBusyAction(`${visible ? "show" : "hide"}:${row.id}`);
    try {
      const result = await visibilityFn({ data: { id: row.id, visible } });
      if (!result.ok) {
        toast.error(result.error ?? "Could not update Discover visibility.");
        return;
      }
      toast.success(
        visible ? "Demo profile shown in Discover" : "Demo profile hidden from Discover",
      );
      await load();
    } finally {
      setBusyAction(null);
    }
  };

  const convertToReal = async (row: DemoUserRow) => {
    if (
      !window.confirm(
        "After conversion, this profile will be treated as a real user. Convert this demo profile?",
      )
    )
      return;
    setBusyAction(`convert:${row.id}`);
    try {
      const result = await convertFn({ data: { id: row.id } });
      if (!result.ok) {
        toast.error(result.error ?? "Could not convert profile.");
        return;
      }
      toast.success("Demo profile converted to real user");
      await load();
      if (selectedId === row.id) {
        setSelectedId(null);
        setDraft(emptyDraft);
      }
    } finally {
      setBusyAction(null);
    }
  };

  const toggleSelected = (id: string, checked: boolean) => {
    setSelectedIds((current) =>
      checked ? Array.from(new Set([...current, id])) : current.filter((value) => value !== id),
    );
  };

  const toggleAllVisible = (checked: boolean) => {
    setSelectedIds((current) => {
      const visibleIds = visibleRows.map((row) => row.id);
      if (checked) return Array.from(new Set([...current, ...visibleIds]));
      const visible = new Set(visibleIds);
      return current.filter((id) => !visible.has(id));
    });
  };

  const runBulkAction = async () => {
    if (selectedIds.length === 0) {
      toast.error("Select at least one demo user.");
      return;
    }
    if (
      bulkAction === "delete" &&
      !window.confirm(`Delete ${selectedIds.length} selected demo users?`)
    )
      return;
    if (
      bulkAction === "convert" &&
      !window.confirm(
        "After conversion, selected profiles will be treated as real users. Continue?",
      )
    )
      return;
    setBusyAction("bulk");
    try {
      const result = await bulkManageFn({
        data: {
          ids: selectedIds,
          action: bulkAction,
          tier: bulkTier,
          verified: bulkVerified,
        },
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Updated ${result.affected} profile${result.affected === 1 ? "" : "s"}`);
      setSelectedIds([]);
      await load();
    } finally {
      setBusyAction(null);
    }
  };

  const remove = async (row: DemoUserRow) => {
    if (!window.confirm(`Delete ${row.display_name ?? "this demo user"}?`)) return;
    const result = await deleteFn({ data: { id: row.id } });
    if (!result.ok) {
      toast.error(result.error ?? "Could not delete demo user.");
      return;
    }
    toast.success("Demo user deleted");
    const nextRows = await listFn({});
    setRows(nextRows);
    if (selectedId === row.id) {
      setSelectedId(nextRows[0]?.id ?? null);
      setDraft(nextRows[0] ? fromRow(nextRows[0]) : emptyDraft);
    }
  };

  const duplicate = async (row: DemoUserRow) => {
    const result = await duplicateFn({ data: { id: row.id } });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Demo user duplicated");
    await load();
    setSelectedId(result.id);
  };

  const fillRandom = () => {
    const generated = generateDemoProfile(
      draft.country || "Kenya",
      draft.gender || "woman",
      Date.now(),
    );
    setDraft((current) => ({
      ...current,
      ...generated,
      age: String(generated.age),
      membershipTier: generated.membershipTier,
      interestedIn: [...generated.interestedIn],
      interests: [...generated.interests],
      languages: [...generated.languages],
      latitude: "",
      longitude: "",
      lastActive: toDateTimeLocal(generated.lastActive),
      isVerified: current.isVerified || generated.isVerified,
      isActive: true,
    }));
  };

  const randomName = () => {
    const country = draft.country || "Kenya";
    const gender = draft.gender || "woman";
    patchDraft("displayName", pickDemoName(country, gender, Math.floor(Math.random() * 10000)));
  };

  const generateBulk = async () => {
    if ((bulk.count ?? 0) > 1000) {
      toast.error("Generate up to 1,000 demo users per request.");
      return;
    }
    setSaving(true);
    try {
      const result = await bulkFn({ data: bulk });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Created ${result.created} demo users${result.withoutPhotos ? `; ${result.withoutPhotos} need photos` : ""}${result.duplicates ? `; ${result.duplicates} duplicates skipped` : ""}.`,
      );
      await load();
    } finally {
      setSaving(false);
    }
  };

  const manageBatch = async (
    batch: DemoBatchRow,
    action: "show" | "hide" | "feature" | "unfeature" | "delete" | "convert" | "update",
  ) => {
    let name: string | undefined;
    if (action === "update") {
      name = window.prompt("Batch name", batch.name) ?? undefined;
      if (!name || name === batch.name) return;
    }
    if (action === "delete" && !window.confirm(`Delete all demo profiles in "${batch.name}"?`))
      return;
    if (
      action === "convert" &&
      !window.confirm("After conversion, this batch will be treated as real users. Continue?")
    )
      return;
    setBusyAction(`batch:${action}:${batch.id}`);
    try {
      const result = await batchManageFn({
        data: {
          id: batch.id,
          action,
          confirm: action === "delete" || action === "convert",
          name,
        },
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Updated ${result.affected} profile${result.affected === 1 ? "" : "s"}`);
      await load();
    } finally {
      setBusyAction(null);
    }
  };

  const importPhotoZip = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    setBuilderReport([]);
    try {
      const form = new FormData();
      form.append("dataset_type", "photo_library");
      form.append("name", file.name.replace(/\.[^.]+$/, "") || "Demo photo library");
      form.append("file", file);
      const result = await importDatasetFn({ data: form });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setBuilderReport([
        `Imported ${result.imported.toLocaleString()} photos from ${result.totalRows.toLocaleString()} files.`,
        `Skipped ${result.skipped.toLocaleString()} invalid files.`,
        `Duplicates skipped: ${result.duplicates.toLocaleString()}.`,
        ...result.errors,
      ]);
      toast.success("Photo ZIP imported");
      await load();
    } finally {
      setUploading(false);
    }
  };

  const uploadPhotos = async (files: FileList | null) => {
    if (!selectedId || !files?.length) return;
    const currentCount = selected?.photos.length ?? 0;
    const allowed = Math.max(0, 6 - currentCount);
    if (allowed === 0) {
      toast.error("Demo users can have up to 6 photos.");
      return;
    }
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, allowed)) {
        const form = new FormData();
        form.append("user_id", selectedId);
        form.append("file", file);
        const result = await uploadFn({ data: form });
        if (!result.ok) toast.error(result.error);
      }
      await load();
      toast.success("Photos updated");
    } finally {
      setUploading(false);
    }
  };

  const replacePhoto = async (photo: DemoPhotoRow, files: FileList | null) => {
    if (!selectedId || !files?.[0]) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("user_id", selectedId);
      form.append("photo_id", photo.id);
      form.append("file", files[0]);
      const result = await replacePhotoFn({ data: form });
      if (!result.ok) {
        toast.error(result.error ?? "Could not replace photo.");
        return;
      }
      toast.success("Photo replaced");
      await load();
    } finally {
      setUploading(false);
    }
  };

  const uploadLibraryPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("gender", libraryFolder);
        form.append("file", file);
        const result = await libraryUploadFn({ data: form });
        if (!result.ok) toast.error(result.error);
      }
      setLibrary(await libraryFn({}));
      toast.success("Library photos uploaded");
    } finally {
      setUploading(false);
    }
  };

  const fillMissingPhotos = async () => {
    setBusyAction("fill-photos");
    try {
      const result = await fillPhotosFn({ data: { ids: selectedIds } });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Filled ${result.filled} demo photo${result.filled === 1 ? "" : "s"}${result.missingPool ? `; ${result.missingPool} still need library photos` : ""}.`,
      );
      await load();
    } finally {
      setBusyAction(null);
    }
  };

  const fillMissingSafeAvatars = async () => {
    setBusyAction("fill-avatars");
    try {
      const result = await fillAvatarsFn({});
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `${result.missingRealPhotos} real member${result.missingRealPhotos === 1 ? "" : "s"} use safe default avatars.`,
      );
    } finally {
      setBusyAction(null);
    }
  };

  const addLibraryPhoto = async (path: string) => {
    if (!selectedId) return;
    const result = await addLibraryPhotoFn({ data: { userId: selectedId, path } });
    if (!result.ok) toast.error(result.error ?? "Could not add library photo.");
    else {
      toast.success("Photo added from library");
      await load();
    }
  };

  const setPrimary = async (photo: DemoPhotoRow) => {
    if (!selectedId) return;
    const result = await primaryFn({ data: { userId: selectedId, photoId: photo.id } });
    if (!result.ok) toast.error(result.error ?? "Could not update primary photo.");
    else await load();
  };

  const movePhoto = async (photo: DemoPhotoRow, direction: -1 | 1) => {
    if (!selectedId || !selected) return;
    const photos = [...selected.photos].sort((a, b) => a.position - b.position);
    const index = photos.findIndex((p) => p.id === photo.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= photos.length) return;
    [photos[index], photos[target]] = [photos[target], photos[index]];
    const result = await reorderFn({
      data: { userId: selectedId, photoIds: photos.map((p) => p.id) },
    });
    if (!result.ok) toast.error(result.error ?? "Could not reorder photos.");
    else await load();
  };

  const removePhoto = async (photo: DemoPhotoRow) => {
    if (!selectedId) return;
    const result = await deletePhotoFn({ data: { userId: selectedId, photoId: photo.id } });
    if (!result.ok) toast.error(result.error ?? "Could not delete photo.");
    else {
      toast.success("Photo deleted");
      await load();
    }
  };

  if (loading) return <PanelLoader />;

  return (
    <Tabs defaultValue="bulk-builder" className="space-y-5">
      <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/60 p-1">
        <TabsTrigger value="bulk-builder" className="rounded-xl">
          <Wand2 className="h-4 w-4" /> Bulk Builder
        </TabsTrigger>
        <TabsTrigger value="profiles" className="rounded-xl">
          <UserCheck className="h-4 w-4" /> Profiles
        </TabsTrigger>
        <TabsTrigger value="batches" className="rounded-xl">
          <DatabaseIcon className="h-4 w-4" /> Demo Batches
        </TabsTrigger>
      </TabsList>

      <TabsContent value="bulk-builder" className="space-y-5">
        <BulkBuilderWizard
          bulk={bulk}
          setBulk={setBulk}
          overview={overview}
          library={library}
          builderStep={builderStep}
          setBuilderStep={setBuilderStep}
          builderReport={builderReport}
          uploading={uploading}
          saving={saving}
          onImportPhotoZip={importPhotoZip}
          onGenerate={generateBulk}
        />
      </TabsContent>

      <TabsContent value="profiles" className="space-y-5">
        <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-3">
            <Button className="h-11 w-full rounded-xl" onClick={startNew}>
              <Plus className="h-4 w-4" /> Add demo user
            </Button>
            <div className="space-y-3 rounded-2xl border border-border bg-card p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search demo users"
                  className="rounded-xl pl-9"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <MiniSelect label="Country" value={countryFilter} onChange={setCountryFilter}>
                  <SelectItem value="all">All</SelectItem>
                  {Array.from(
                    new Set(
                      rows
                        .map((row) => row.location_country)
                        .filter((country): country is string => Boolean(country)),
                    ),
                  ).map((country) => (
                    <SelectItem key={country} value={country}>
                      {country}
                    </SelectItem>
                  ))}
                </MiniSelect>
                <MiniSelect label="Gender" value={genderFilter} onChange={setGenderFilter}>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="woman">Women</SelectItem>
                  <SelectItem value="man">Men</SelectItem>
                  <SelectItem value="nonbinary">Non-binary</SelectItem>
                </MiniSelect>
                <MiniSelect label="Verified" value={verifiedFilter} onChange={setVerifiedFilter}>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="yes">Verified</SelectItem>
                  <SelectItem value="no">Not verified</SelectItem>
                </MiniSelect>
                <MiniSelect label="Paid tier" value={premiumFilter} onChange={setPremiumFilter}>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="yes">Gold or Platinum</SelectItem>
                  <SelectItem value="no">Free</SelectItem>
                </MiniSelect>
              </div>
              <MiniSelect label="Visibility" value={activeFilter} onChange={setActiveFilter}>
                <SelectItem value="all">All demo users</SelectItem>
                <SelectItem value="yes">Visible</SelectItem>
                <SelectItem value="no">Hidden</SelectItem>
              </MiniSelect>
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Filter className="h-3.5 w-3.5" />
                Showing {visibleRows.length} of {rows.length}
              </p>
            </div>

            <div className="space-y-3 rounded-2xl border border-border bg-card p-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <Checkbox
                  checked={allVisibleSelected}
                  onCheckedChange={(value) => toggleAllVisible(Boolean(value))}
                />
                Select visible
              </label>
              <div className="grid grid-cols-2 gap-2">
                <MiniSelect
                  label="Bulk action"
                  value={bulkAction}
                  onChange={(value) => setBulkAction(value as DemoBulkAction)}
                >
                  <SelectItem value="show">Show in Discover</SelectItem>
                  <SelectItem value="hide">Hide from Discover</SelectItem>
                  <SelectItem value="delete">Delete selected</SelectItem>
                  <SelectItem value="convert">Convert to real</SelectItem>
                  <SelectItem value="tier">Set tier</SelectItem>
                  <SelectItem value="verified">Set verified</SelectItem>
                  <SelectItem value="repair_discover_fields">
                    Generate missing Discover fields
                  </SelectItem>
                  <SelectItem value="fill_photos">Fill missing demo photos</SelectItem>
                </MiniSelect>
                {bulkAction === "tier" ? (
                  <MiniSelect
                    label="Tier"
                    value={bulkTier}
                    onChange={(value) => setBulkTier(value as MembershipTier)}
                  >
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="gold">Gold</SelectItem>
                    <SelectItem value="platinum">Platinum</SelectItem>
                  </MiniSelect>
                ) : bulkAction === "verified" ? (
                  <MiniSelect
                    label="Verified"
                    value={bulkVerified ? "yes" : "no"}
                    onChange={(value) => setBulkVerified(value === "yes")}
                  >
                    <SelectItem value="yes">Verified</SelectItem>
                    <SelectItem value="no">Unverified</SelectItem>
                  </MiniSelect>
                ) : (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Selected</Label>
                    <div className="grid h-9 place-items-center rounded-xl border border-border text-sm">
                      {selectedIds.length}
                    </div>
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                className="w-full rounded-xl"
                disabled={selectedIds.length === 0 || busyAction === "bulk"}
                onClick={runBulkAction}
              >
                {busyAction === "bulk" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Apply to selected
              </Button>
            </div>

            <div className="space-y-3 rounded-2xl border border-border bg-card p-3">
              <div>
                <h4 className="text-sm font-semibold">Demo batches</h4>
                <p className="text-xs text-muted-foreground">
                  Manage generated groups without touching real users.
                </p>
              </div>
              {batches.length === 0 ? (
                <EmptyState>No batches yet.</EmptyState>
              ) : (
                <div className="space-y-2">
                  {batches.slice(0, 5).map((batch) => (
                    <div
                      key={batch.id}
                      className="rounded-xl border border-border bg-background p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{batch.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {batch.created_count.toLocaleString()} profiles ·{" "}
                            {batch.visible_count.toLocaleString()} visible
                          </p>
                        </div>
                        <Badge variant="secondary">{batch.status.replace("_", " ")}</Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => manageBatch(batch, "show")}
                        >
                          Show
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => manageBatch(batch, "hide")}
                        >
                          Hide
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => manageBatch(batch, "convert")}
                        >
                          Convert
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive"
                          onClick={() => manageBatch(batch, "delete")}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {rows.length === 0 ? (
              <EmptyState>No demo users yet.</EmptyState>
            ) : (
              <div className="space-y-2">
                {visibleRows.map((row) => {
                  const primary = row.photos.find((photo) => photo.is_primary) ?? row.photos[0];
                  const active = row.is_active && row.onboarding_complete;
                  const hidden = !row.is_active || row.discovery_blocked_reason;
                  return (
                    <div
                      key={row.id}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-2xl border bg-card p-3 text-left transition-colors",
                        selectedId === row.id
                          ? "border-primary"
                          : "border-border hover:border-primary/50",
                      )}
                    >
                      <Checkbox
                        checked={selectedSet.has(row.id)}
                        onCheckedChange={(value) => toggleSelected(row.id, Boolean(value))}
                        aria-label={`Select ${row.display_name ?? "demo user"}`}
                      />
                      <button
                        type="button"
                        onClick={() => selectRow(row)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl">
                          <ProfilePhoto
                            path={photoPath(primary)}
                            alt={row.display_name ?? "Demo user"}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate font-medium">
                              {row.display_name ?? "Demo user"}
                            </span>
                            {row.is_verified && <BadgeCheck className="h-4 w-4 text-sky-500" />}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">
                            {[row.location_city, row.location_country].filter(Boolean).join(", ") ||
                              "No location"}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <Badge variant="secondary" className="text-[10px]">
                              Demo
                            </Badge>
                            <Badge variant={hidden ? "outline" : "default"} className="text-[10px]">
                              {hidden ? "Hidden" : "Visible"}
                            </Badge>
                          </div>
                        </div>
                      </button>
                      {active ? (
                        <Eye className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </aside>

          <section className="space-y-5 rounded-3xl border border-border bg-card p-4 md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">
                  {draft.id ? "Edit demo user" : "Create demo user"}
                </h3>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <p className="text-sm text-muted-foreground">
                    Demo profiles are marked internally and never create fake engagement.
                  </p>
                  {selected && (
                    <>
                      <Badge variant="secondary">Demo</Badge>
                      <Badge
                        variant={
                          selected.is_active && !selected.discovery_blocked_reason
                            ? "default"
                            : "outline"
                        }
                      >
                        {selected.is_active && !selected.discovery_blocked_reason
                          ? "Visible in Discover"
                          : "Hidden from Discover"}
                      </Badge>
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="rounded-xl" onClick={fillRandom}>
                  <Wand2 className="h-4 w-4" /> Auto-fill
                </Button>
                {draft.id && selected && (
                  <>
                    <Button
                      variant="outline"
                      className="rounded-xl"
                      disabled={busyAction === `show:${selected.id}`}
                      onClick={() => setVisibility(selected, true)}
                    >
                      {busyAction === `show:${selected.id}` ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                      Show in Discover
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-xl"
                      disabled={busyAction === `hide:${selected.id}`}
                      onClick={() => setVisibility(selected, false)}
                    >
                      {busyAction === `hide:${selected.id}` ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <EyeOff className="h-4 w-4" />
                      )}
                      Hide from Discover
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-xl"
                      disabled={busyAction === `convert:${selected.id}`}
                      onClick={() => convertToReal(selected)}
                    >
                      {busyAction === `convert:${selected.id}` ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <UserCheck className="h-4 w-4" />
                      )}
                      Convert to real user
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => duplicate(selected)}
                    >
                      <Copy className="h-4 w-4" /> Duplicate
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-xl text-destructive"
                      onClick={() => remove(selected)}
                    >
                      <Trash2 className="h-4 w-4" /> Delete
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Full name">
                <div className="flex gap-2">
                  <Input
                    value={draft.displayName}
                    onChange={(e) => patchDraft("displayName", e.target.value)}
                    className="rounded-xl"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={randomName}
                  >
                    Random
                  </Button>
                </div>
              </Field>
              <Field label="Age">
                <Input
                  type="number"
                  min={18}
                  max={90}
                  value={draft.age}
                  onChange={(e) => patchDraft("age", e.target.value)}
                  className="rounded-xl"
                />
              </Field>
              <Field label="Gender">
                <Select value={draft.gender} onValueChange={(value) => patchDraft("gender", value)}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GENDER_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Paid membership badge">
                <Select
                  value={draft.membershipTier}
                  onValueChange={(value) => patchDraft("membershipTier", value as MembershipTier)}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["free", "gold", "platinum"] as MembershipTier[]).map((tier) => (
                      <SelectItem key={tier} value={tier}>
                        {TIER_LABELS[tier]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Country">
                <Select
                  value={draft.country || "none"}
                  onValueChange={(value) => patchDraft("country", value === "none" ? "" : value)}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not set</SelectItem>
                    {DEMO_COUNTRIES.map((country) => (
                      <SelectItem key={country} value={country}>
                        {country}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="City">
                <Input
                  value={draft.city}
                  onChange={(e) => patchDraft("city", e.target.value)}
                  className="rounded-xl"
                />
              </Field>
              <Field label="Latitude">
                <Input
                  type="number"
                  step="any"
                  value={draft.latitude}
                  onChange={(e) => patchDraft("latitude", e.target.value)}
                  className="rounded-xl"
                />
              </Field>
              <Field label="Longitude">
                <Input
                  type="number"
                  step="any"
                  value={draft.longitude}
                  onChange={(e) => patchDraft("longitude", e.target.value)}
                  className="rounded-xl"
                />
              </Field>
              <Field label="Occupation">
                <Input
                  value={draft.occupation}
                  onChange={(e) => patchDraft("occupation", e.target.value)}
                  className="rounded-xl"
                />
              </Field>
              <Field label="Relationship intent">
                <Select
                  value={draft.relationshipGoal}
                  onValueChange={(value) => patchDraft("relationshipGoal", value)}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RELATIONSHIP_GOAL_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Religion">
                <Select
                  value={draft.religion || "none"}
                  onValueChange={(value) => patchDraft("religion", value === "none" ? "" : value)}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not set</SelectItem>
                    {RELIGION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Education">
                <Select
                  value={draft.education || "none"}
                  onValueChange={(value) => patchDraft("education", value === "none" ? "" : value)}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not set</SelectItem>
                    {EDUCATION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Last active">
                <Input
                  type="datetime-local"
                  value={draft.lastActive}
                  onChange={(e) => patchDraft("lastActive", e.target.value)}
                  className="rounded-xl"
                />
              </Field>
              <div className="grid gap-3 rounded-2xl border border-border bg-muted/30 p-4 sm:grid-cols-2">
                <Toggle
                  label="Verified"
                  checked={draft.isVerified}
                  onChange={(value) => patchDraft("isVerified", value)}
                />
                <Toggle
                  label="Visible"
                  checked={draft.isActive}
                  onChange={(value) => patchDraft("isActive", value)}
                />
              </div>
            </div>

            <Field label="Bio">
              <Textarea
                value={draft.bio}
                onChange={(e) => patchDraft("bio", e.target.value)}
                maxLength={500}
                className="min-h-24 rounded-xl"
              />
            </Field>

            <ChipGroup
              label="Interested in"
              options={INTERESTED_IN_OPTIONS}
              selected={draft.interestedIn}
              onToggle={(value) => toggleArray("interestedIn", value, 6)}
            />
            <ChipGroup
              label="Interests"
              options={INTEREST_OPTIONS.map((value) => ({ value, label: value }))}
              selected={draft.interests}
              onToggle={(value) => toggleArray("interests", value, 10)}
            />
            <ChipGroup
              label="Languages"
              options={LANGUAGE_OPTIONS.map((value) => ({ value, label: value }))}
              selected={draft.languages}
              onToggle={(value) => toggleArray("languages", value, 10)}
            />

            <div className="flex justify-end">
              <Button
                onClick={save}
                disabled={saving || uploading}
                className="h-12 rounded-xl px-6"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {draft.id ? "Save changes" : "Create demo user"}
              </Button>
            </div>

            <div className="rounded-2xl border border-border bg-muted/20 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="font-medium">Photos</h4>
                  <p className="text-sm text-muted-foreground">
                    Upload up to 6 photos, replace images, reorder them, and choose one primary
                    image.
                  </p>
                  {uploading && (
                    <p className="mt-1 text-xs font-medium text-primary">
                      Uploading photo changes...
                    </p>
                  )}
                </div>
                <label
                  className={cn(
                    "inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-border px-3 text-sm font-medium",
                    (!draft.id || uploading) && "pointer-events-none opacity-50",
                  )}
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Upload
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => uploadPhotos(e.target.files)}
                  />
                </label>
              </div>
              <div className="mb-4 rounded-2xl border border-border bg-background/70 p-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h5 className="text-sm font-semibold">Reusable photo library</h5>
                    <p className="text-xs text-muted-foreground">
                      Stored in profile-photos/demo-library for future demo users.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={libraryFolder}
                      onValueChange={(value) =>
                        setLibraryFolder(value as "male" | "female" | "neutral")
                      }
                    >
                      <SelectTrigger className="h-9 w-28 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="neutral">Neutral</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 rounded-xl"
                      disabled={busyAction === "fill-photos"}
                      onClick={fillMissingPhotos}
                    >
                      {busyAction === "fill-photos" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Wand2 className="h-4 w-4" />
                      )}
                      Fill missing demo photos
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 rounded-xl"
                      disabled={busyAction === "fill-avatars"}
                      onClick={fillMissingSafeAvatars}
                    >
                      {busyAction === "fill-avatars" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <UserCheck className="h-4 w-4" />
                      )}
                      Fill missing avatars
                    </Button>
                    <label
                      className={cn(
                        "inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-border px-3 text-sm font-medium",
                        uploading && "pointer-events-none opacity-50",
                      )}
                    >
                      {uploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      Library
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => uploadLibraryPhotos(e.target.files)}
                      />
                    </label>
                  </div>
                </div>
                {library.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No library photos uploaded yet.</p>
                ) : (
                  <div className="grid max-h-52 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4 md:grid-cols-6">
                    {library.map((photo) => (
                      <button
                        key={photo.path}
                        type="button"
                        disabled={!draft.id}
                        onClick={() => addLibraryPhoto(photo.path)}
                        className={cn(
                          "group relative overflow-hidden rounded-xl border border-border bg-muted disabled:cursor-not-allowed disabled:opacity-50",
                          photo.used && "opacity-70",
                        )}
                        title={photo.used ? "Already used by a demo profile" : "Add to profile"}
                      >
                        <div className="aspect-[3/4]">
                          <ProfilePhoto path={photo.path} alt={photo.name} rounded="rounded-none" />
                        </div>
                        <span className="absolute inset-x-1 bottom-1 rounded bg-black/55 px-1 py-0.5 text-[10px] text-white">
                          {photo.gender}
                          {photo.used ? " · used" : ""}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {!draft.id ? (
                <EmptyState>Save the demo user before adding photos.</EmptyState>
              ) : !selected?.photos.length ? (
                <EmptyState>No photos yet.</EmptyState>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {selected.photos
                    .slice()
                    .sort((a, b) => a.position - b.position)
                    .map((photo, index, list) => (
                      <div
                        key={photo.id}
                        className="overflow-hidden rounded-2xl border border-border bg-card"
                      >
                        <div className="relative aspect-[3/4]">
                          <ProfilePhoto
                            path={photoPath(photo)}
                            alt="Demo profile"
                            className="rounded-none"
                          />
                          {photo.is_primary && (
                            <Badge className="absolute left-2 top-2 gap-1 bg-primary text-primary-foreground">
                              <Star className="h-3 w-3" fill="currentColor" /> Primary
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-1 p-2">
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8 rounded-lg"
                            disabled={index === 0 || uploading}
                            onClick={() => movePhoto(photo, -1)}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8 rounded-lg"
                            disabled={index === list.length - 1 || uploading}
                            onClick={() => movePhoto(photo, 1)}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8 rounded-lg"
                            disabled={photo.is_primary || uploading}
                            onClick={() => setPrimary(photo)}
                          >
                            <Star className="h-4 w-4" />
                          </Button>
                          <label
                            className={cn(
                              "inline-flex h-8 cursor-pointer items-center justify-center rounded-lg border border-border px-2 text-xs font-medium",
                              uploading && "pointer-events-none opacity-50",
                            )}
                          >
                            Replace
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(event) => replacePhoto(photo, event.target.files)}
                            />
                          </label>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8 rounded-lg text-destructive"
                            disabled={uploading}
                            onClick={() => removePhoto(photo)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </TabsContent>

      <TabsContent value="batches" className="space-y-5">
        <DemoBatchesPanel
          batches={batches}
          busyAction={busyAction}
          selectedCount={selectedIds.length}
          bulkAction={bulkAction}
          bulkTier={bulkTier}
          bulkVerified={bulkVerified}
          allVisibleSelected={allVisibleSelected}
          onToggleAllVisible={toggleAllVisible}
          onBulkActionChange={setBulkAction}
          onBulkTierChange={setBulkTier}
          onBulkVerifiedChange={setBulkVerified}
          onRunBulkAction={runBulkAction}
          onManageBatch={manageBatch}
        />
      </TabsContent>
    </Tabs>
  );
}

const BUILDER_STEPS = ["Photos", "Names", "Locations", "Details", "Settings", "Generate"] as const;

function countPreview(overview: DemoDatasetOverview | null, type: string) {
  return (overview?.preview ?? []).filter((item) => item.dataset_type === type && item.enabled)
    .length;
}

function datasetValues(overview: DemoDatasetOverview | null, type: string, max = 24) {
  return Array.from(
    new Set(
      (overview?.preview ?? [])
        .filter((item) => item.dataset_type === type && item.enabled)
        .map((item) => item.value)
        .filter(Boolean),
    ),
  ).slice(0, max);
}

function BulkBuilderWizard({
  bulk,
  setBulk,
  overview,
  library,
  builderStep,
  setBuilderStep,
  builderReport,
  uploading,
  saving,
  onImportPhotoZip,
  onGenerate,
}: {
  bulk: BulkDemoGeneratorInput;
  setBulk: React.Dispatch<React.SetStateAction<BulkDemoGeneratorInput>>;
  overview: DemoDatasetOverview | null;
  library: DemoLibraryPhoto[];
  builderStep: number;
  setBuilderStep: React.Dispatch<React.SetStateAction<number>>;
  builderReport: string[];
  uploading: boolean;
  saving: boolean;
  onImportPhotoZip: (files: FileList | null) => void;
  onGenerate: () => void;
}) {
  const stats = overview?.stats;
  const maleNames = countPreview(overview, "male_names");
  const femaleNames = countPreview(overview, "female_names");
  const genderedNames = countPreview(overview, "names");
  const namesTotal = stats?.names ?? maleNames + femaleNames + genderedNames;
  const importedOnly = bulk.useImportedOnly ?? false;
  const missingNames = namesTotal === 0 && importedOnly;
  const detailCounts = [
    ["Occupations", stats?.occupations ?? 0],
    ["Interests", stats?.interests ?? 0],
    ["Bio templates", stats?.bioTemplates ?? 0],
    ["Languages", stats?.languages ?? 0],
    ["Religions", stats?.religions ?? 0],
    ["Education", stats?.education ?? 0],
    ["Universities", stats?.universities ?? 0],
    ["Companies", stats?.companies ?? 0],
  ] as const;
  const missingDetails = importedOnly && detailCounts.some(([, count]) => count === 0);
  const countries = datasetValues(overview, "countries", 60);
  const cities = datasetValues(overview, "cities", 80);
  const canContinue =
    (builderStep !== 1 || !missingNames) && (builderStep !== 3 || !missingDetails);

  const patchBulk = (patch: Partial<BulkDemoGeneratorInput>) =>
    setBulk((current) => ({ ...current, ...patch }));

  const toggleList = (key: "countries" | "cities", value: string) => {
    setBulk((current) => {
      const list = current[key] ?? [];
      const next = list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
      return { ...current, [key]: next };
    });
  };

  return (
    <section className="space-y-5 rounded-3xl border border-border bg-card p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Bulk Demo Builder</h3>
          <p className="text-sm text-muted-foreground">
            Build demo users from imported pools with fallbacks and no fake engagement.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {BUILDER_STEPS.map((step, index) => (
            <button
              key={step}
              type="button"
              onClick={() => setBuilderStep(index)}
              className={cn(
                "rounded-xl border px-3 py-2 text-xs font-medium",
                builderStep === index
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background",
              )}
            >
              {index + 1}. {step}
            </button>
          ))}
        </div>
      </div>

      {builderStep === 0 && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="grid gap-3 md:grid-cols-2">
            {[
              ["library", "Existing uploaded library", "Use profile-photos/demo-library."],
              ["zip", "Upload new ZIP library", "Import male/ and female/ folders."],
              ["placeholder", "Bundled placeholder SVGs", "Always available fallback."],
              ["mixed", "Mixed mode", "Prefer library photos, then placeholders."],
            ].map(([value, label, text]) => (
              <ChoiceCard
                key={value}
                active={(bulk.photoSource ?? "mixed") === value}
                title={label}
                body={text}
                onClick={() =>
                  patchBulk({ photoSource: value as BulkDemoGeneratorInput["photoSource"] })
                }
              />
            ))}
          </div>
          <div className="space-y-3 rounded-2xl border border-border bg-muted/20 p-3">
            <Stat label="Library photos" value={library.length} />
            <Stat label="Male photos" value={stats?.malePhotos ?? 0} />
            <Stat label="Female photos" value={stats?.femalePhotos ?? 0} />
            <label className="inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-medium">
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Upload ZIP
              <input
                type="file"
                accept=".zip"
                className="hidden"
                disabled={uploading}
                onChange={(event) => {
                  onImportPhotoZip(event.target.files);
                  event.currentTarget.value = "";
                }}
              />
            </label>
            {builderReport.length > 0 && (
              <div className="max-h-32 overflow-y-auto rounded-xl bg-background p-3 text-xs text-muted-foreground">
                {builderReport.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {builderStep === 1 && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <DatasetCount title="Male names dataset" count={maleNames} />
          <DatasetCount title="Female names dataset" count={femaleNames} />
          <DatasetCount title="Names with gender column" count={genderedNames} />
          <DatasetCount title="Mixed names" count={namesTotal} />
          {missingNames && (
            <WarningCard text="Imported-only mode needs at least one names dataset before continuing." />
          )}
          <Toggle
            label="Allow built-in name fallback"
            checked={!importedOnly}
            onChange={(value) => patchBulk({ useImportedOnly: !value })}
          />
        </div>
      )}

      {builderStep === 2 && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <DatasetCount title="Imported countries" count={stats?.countries ?? 0} />
            <DatasetCount title="Imported cities" count={stats?.cities ?? 0} />
            <DatasetCount title="Built-in countries" count={DEMO_COUNTRIES.length} />
            <DatasetCount title="Coordinate cities" count={stats?.cities ?? 0} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <MiniSelect
              label="Location pool"
              value={bulk.locationMode ?? "all"}
              onChange={(value) =>
                patchBulk({ locationMode: value as BulkDemoGeneratorInput["locationMode"] })
              }
            >
              <SelectItem value="all">All countries and cities</SelectItem>
              <SelectItem value="countries">Specific countries</SelectItem>
              <SelectItem value="cities">Specific cities</SelectItem>
              <SelectItem value="region">Region/continent if available</SelectItem>
            </MiniSelect>
            <Field label="Region/continent">
              <Input
                value={bulk.region ?? ""}
                onChange={(event) => patchBulk({ region: event.target.value })}
                className="rounded-xl"
              />
            </Field>
          </div>
          <Toggle
            label="Use cities with coordinates only"
            checked={bulk.coordinatesOnly ?? false}
            onChange={(value) => patchBulk({ coordinatesOnly: value })}
          />
          <OptionCloud
            title="Specific countries"
            values={countries.length ? countries : [...DEMO_COUNTRIES]}
            selected={bulk.countries ?? []}
            onToggle={(value) => toggleList("countries", value)}
          />
          <OptionCloud
            title="Specific cities"
            values={cities}
            selected={bulk.cities ?? []}
            onToggle={(value) => toggleList("cities", value)}
            empty="Import cities to select specific cities."
          />
        </div>
      )}

      {builderStep === 3 && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {detailCounts.map(([label, count]) => (
            <DatasetCount key={label} title={label} count={count} />
          ))}
          {missingDetails && (
            <WarningCard text="Imported-only mode needs every profile detail pool populated, or enable fallback values." />
          )}
          <Toggle
            label="Allow built-in profile-detail fallbacks"
            checked={!importedOnly}
            onChange={(value) => patchBulk({ useImportedOnly: !value })}
          />
        </div>
      )}

      {builderStep === 4 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Batch name">
            <Input
              value={bulk.batchName ?? ""}
              onChange={(event) => patchBulk({ batchName: event.target.value })}
              className="rounded-xl"
            />
          </Field>
          <MiniSelect
            label="Number to generate"
            value={String(bulk.count)}
            onChange={(value) => patchBulk({ count: Number(value) })}
          >
            {[50, 100, 500, 1000].map((count) => (
              <SelectItem key={count} value={String(count)}>
                {count.toLocaleString()}
              </SelectItem>
            ))}
          </MiniSelect>
          <MiniSelect
            label="Gender distribution"
            value={bulk.gender}
            onChange={(value) => patchBulk({ gender: value as BulkDemoGeneratorInput["gender"] })}
          >
            <SelectItem value="Mixed">Mixed</SelectItem>
            <SelectItem value="Female">Female</SelectItem>
            <SelectItem value="Male">Male</SelectItem>
          </MiniSelect>
          <Field label="Minimum age">
            <Input
              type="number"
              min={18}
              max={90}
              value={bulk.minAge ?? 23}
              onChange={(event) => patchBulk({ minAge: Number(event.target.value) })}
              className="rounded-xl"
            />
          </Field>
          <Field label="Maximum age">
            <Input
              type="number"
              min={18}
              max={90}
              value={bulk.maxAge ?? 48}
              onChange={(event) => patchBulk({ maxAge: Number(event.target.value) })}
              className="rounded-xl"
            />
          </Field>
          {[
            ["Verified %", "verificationPercent"],
            ["Free %", "freePercent"],
            ["Additional Gold %", "premiumPercent"],
            ["Gold %", "goldPercent"],
            ["Platinum %", "platinumPercent"],
          ].map(([label, key]) => (
            <Field key={key} label={label}>
              <Input
                type="number"
                min={0}
                max={100}
                value={Number(bulk[key as keyof BulkDemoGeneratorInput] ?? 0)}
                onChange={(event) => patchBulk({ [key]: Number(event.target.value) })}
                className="rounded-xl"
              />
            </Field>
          ))}
          <Toggle
            label="Show in Discover immediately"
            checked={bulk.discoverVisible ?? true}
            onChange={(value) => patchBulk({ discoverVisible: value })}
          />
          <Toggle
            label="Mark as active"
            checked={bulk.active}
            onChange={(value) => patchBulk({ active: value })}
          />
        </div>
      )}

      {builderStep === 5 && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-2xl border border-border bg-muted/20 p-4">
            <h4 className="font-medium">Ready to generate</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              This creates auth users, public profiles, and profile photo rows only. Likes, matches,
              messages, and notifications are never generated.
            </p>
            <div className="mt-4 grid gap-2 text-sm md:grid-cols-2">
              <SummaryLine label="Batch" value={bulk.batchName ?? "Demo batch"} />
              <SummaryLine label="Count" value={(bulk.count ?? 50).toLocaleString()} />
              <SummaryLine label="Gender" value={bulk.gender} />
              <SummaryLine label="Photo source" value={bulk.photoSource ?? "mixed"} />
              <SummaryLine label="Active" value={bulk.active ? "Yes" : "No"} />
              <SummaryLine
                label="Discover"
                value={bulk.discoverVisible && bulk.active ? "Visible" : "Hidden"}
              />
            </div>
          </div>
          <div className="space-y-3 rounded-2xl border border-border bg-background p-4">
            <Button className="h-12 w-full rounded-xl" onClick={onGenerate} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
              Generate batch
            </Button>
            <p className="text-xs text-muted-foreground">
              For larger rollouts, run 1,000-user chunks as separate batches.
            </p>
          </div>
        </div>
      )}

      <div className="flex justify-between gap-3">
        <Button
          variant="outline"
          className="rounded-xl"
          disabled={builderStep === 0}
          onClick={() => setBuilderStep((step) => Math.max(0, step - 1))}
        >
          Back
        </Button>
        <Button
          className="rounded-xl"
          disabled={!canContinue || builderStep === BUILDER_STEPS.length - 1}
          onClick={() => setBuilderStep((step) => Math.min(BUILDER_STEPS.length - 1, step + 1))}
        >
          Next
        </Button>
      </div>
    </section>
  );
}

function DemoBatchesPanel({
  batches,
  busyAction,
  selectedCount,
  bulkAction,
  bulkTier,
  bulkVerified,
  allVisibleSelected,
  onToggleAllVisible,
  onBulkActionChange,
  onBulkTierChange,
  onBulkVerifiedChange,
  onRunBulkAction,
  onManageBatch,
}: {
  batches: DemoBatchRow[];
  busyAction: string | null;
  selectedCount: number;
  bulkAction: DemoBulkAction;
  bulkTier: MembershipTier;
  bulkVerified: boolean;
  allVisibleSelected: boolean;
  onToggleAllVisible: (checked: boolean) => void;
  onBulkActionChange: (action: DemoBulkAction) => void;
  onBulkTierChange: (tier: MembershipTier) => void;
  onBulkVerifiedChange: (verified: boolean) => void;
  onRunBulkAction: () => void;
  onManageBatch: (
    batch: DemoBatchRow,
    action: "show" | "hide" | "feature" | "unfeature" | "delete" | "convert" | "update",
  ) => void;
}) {
  return (
    <section className="space-y-4 rounded-3xl border border-border bg-card p-4 md:p-5">
      <div>
        <h3 className="font-semibold">Demo Batches</h3>
        <p className="text-sm text-muted-foreground">
          Manage generated groups without touching real users.
        </p>
      </div>
      <div className="grid gap-3 rounded-2xl border border-border bg-muted/20 p-3 md:grid-cols-4">
        <label className="flex items-center gap-2 text-sm font-medium">
          <Checkbox
            checked={allVisibleSelected}
            onCheckedChange={(value) => onToggleAllVisible(Boolean(value))}
          />
          Select visible profiles
        </label>
        <MiniSelect
          label="Selected action"
          value={bulkAction}
          onChange={(value) => onBulkActionChange(value as DemoBulkAction)}
        >
          <SelectItem value="show">Show in Discover</SelectItem>
          <SelectItem value="hide">Hide from Discover</SelectItem>
          <SelectItem value="delete">Delete selected</SelectItem>
          <SelectItem value="convert">Convert to real</SelectItem>
          <SelectItem value="tier">Set tier</SelectItem>
          <SelectItem value="verified">Set verified</SelectItem>
          <SelectItem value="repair_discover_fields">Generate missing Discover fields</SelectItem>
          <SelectItem value="fill_photos">Fill missing demo photos</SelectItem>
        </MiniSelect>
        {bulkAction === "tier" ? (
          <MiniSelect
            label="Tier"
            value={bulkTier}
            onChange={(value) => onBulkTierChange(value as MembershipTier)}
          >
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="gold">Gold</SelectItem>
            <SelectItem value="platinum">Platinum</SelectItem>
          </MiniSelect>
        ) : bulkAction === "verified" ? (
          <MiniSelect
            label="Verified"
            value={bulkVerified ? "yes" : "no"}
            onChange={(value) => onBulkVerifiedChange(value === "yes")}
          >
            <SelectItem value="yes">Verified</SelectItem>
            <SelectItem value="no">Unverified</SelectItem>
          </MiniSelect>
        ) : (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Selected</Label>
            <div className="grid h-9 place-items-center rounded-xl border border-border text-sm">
              {selectedCount}
            </div>
          </div>
        )}
        <Button
          variant="outline"
          className="self-end rounded-xl"
          disabled={selectedCount === 0 || busyAction === "bulk"}
          onClick={onRunBulkAction}
        >
          {busyAction === "bulk" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          Apply to {selectedCount}
        </Button>
      </div>

      {batches.length === 0 ? (
        <EmptyState>No batches yet.</EmptyState>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {batches.map((batch) => (
            <div key={batch.id} className="rounded-2xl border border-border bg-background p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{batch.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Created {new Date(batch.created_at).toLocaleString()}
                  </p>
                </div>
                <Badge variant="secondary">{batch.status.replace("_", " ")}</Badge>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <Stat label="Count" value={batch.created_count} />
                <Stat label="Visible" value={batch.visible_count} />
                <Stat label="Hidden" value={batch.hidden_count} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(
                  ["show", "hide", "feature", "unfeature", "update", "convert", "delete"] as const
                ).map((action) => (
                  <Button
                    key={action}
                    size="sm"
                    variant="outline"
                    className={cn("rounded-xl", action === "delete" && "text-destructive")}
                    disabled={busyAction === `batch:${action}:${batch.id}`}
                    onClick={() => onManageBatch(batch, action)}
                  >
                    {busyAction === `batch:${action}:${batch.id}` && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    {action === "show"
                      ? "Show in Discover"
                      : action === "hide"
                        ? "Hide from Discover"
                        : action === "feature"
                          ? "Feature profiles"
                          : action === "unfeature"
                            ? "Unfeature profiles"
                            : action === "update"
                              ? "Edit settings"
                              : action}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ChoiceCard({
  active,
  title,
  body,
  onClick,
}: {
  active: boolean;
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl border p-4 text-left transition-colors",
        active ? "border-primary bg-primary/10" : "border-border bg-background",
      )}
    >
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </button>
  );
}

function DatasetCount({ title, count }: { title: string; count: number }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className={cn("mt-2 text-2xl font-semibold", count === 0 && "text-destructive")}>
        {count.toLocaleString()}
      </p>
      {count === 0 && <p className="mt-1 text-xs text-destructive">No valid rows available.</p>}
    </div>
  );
}

function WarningCard({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive md:col-span-2">
      {text}
    </div>
  );
}

function OptionCloud({
  title,
  values,
  selected,
  onToggle,
  empty = "No imported values available.",
}: {
  title: string;
  values: string[];
  selected: string[];
  onToggle: (value: string) => void;
  empty?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <p className="mb-3 text-sm font-medium">{title}</p>
      {values.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
          {values.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onToggle(value)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium",
                selected.includes(value)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-muted/30",
              )}
            >
              {value}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

const DATASET_LABELS: Record<string, string> = {
  auto: "Auto-detect",
  photo_library: "Photo ZIP library",
  names: "Names",
  male_names: "Male names",
  female_names: "Female names",
  countries: "Country dataset",
  cities: "City dataset",
  occupations: "Occupations",
  education: "Education",
  universities: "Universities",
  companies: "Companies",
  interests: "Interests",
  bio_templates: "Bio templates",
  languages: "Languages",
  religions: "Religions",
};

export function ImportDatasetPanel() {
  const listFn = useServerFn(listDemoDatasets);
  const importFn = useServerFn(importDemoDataset);
  const updateFn = useServerFn(updateDemoDatasetImport);
  const deleteFn = useServerFn(deleteDemoDatasetImport);
  const [overview, setOverview] = useState<DemoDatasetOverview | null>(null);
  const [datasetType, setDatasetType] = useState("auto");
  const [name, setName] = useState("Demo import");
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      setOverview((await listFn({})) as DemoDatasetOverview);
    } catch {
      toast.error("Could not load dataset imports.");
    }
  }, [listFn]);

  useEffect(() => {
    load();
  }, [load]);

  const runImport = async (file: File | null | undefined) => {
    if (!file) return;
    setImporting(true);
    setReport([]);
    try {
      const form = new FormData();
      form.append("dataset_type", datasetType);
      form.append("name", name || file.name);
      form.append("file", file);
      const result = await importFn({ data: form });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setReport(
        [
          `Detected: ${DATASET_LABELS[result.datasetType] ?? result.datasetType}.`,
          `Rows read: ${result.totalRows.toLocaleString()}.`,
          `Imported rows: ${result.imported.toLocaleString()}.`,
          `Duplicates skipped: ${result.duplicates.toLocaleString()}.`,
          `Errors: ${result.errorCount.toLocaleString()}.`,
          `Total available for generator: ${result.totalAvailable.toLocaleString()} ${
            DATASET_LABELS[result.datasetType]?.toLowerCase() ?? "records"
          }.`,
          result.skipped ? `Invalid rows skipped: ${result.skipped.toLocaleString()}.` : "",
          ...result.errors,
        ].filter(Boolean),
      );
      toast.success(
        `Imported ${result.imported.toLocaleString()} ${
          DATASET_LABELS[result.datasetType]?.toLowerCase() ?? "records"
        }.`,
      );
      await load();
      const latest = (await listFn({})) as DemoDatasetOverview;
      setOverview(latest);
    } finally {
      setImporting(false);
      setDragging(false);
    }
  };

  const toggleDataset = async (row: DemoDatasetImportRow) => {
    const result = await updateFn({ data: { id: row.id, enabled: !row.enabled } });
    if (!result.ok) toast.error(result.error ?? "Could not update dataset.");
    else await load();
  };

  const renameDataset = async (row: DemoDatasetImportRow) => {
    const next = window.prompt("Dataset name", row.name);
    if (!next || next === row.name) return;
    const result = await updateFn({ data: { id: row.id, name: next } });
    if (!result.ok) toast.error(result.error ?? "Could not rename dataset.");
    else await load();
  };

  const deleteDataset = async (row: DemoDatasetImportRow) => {
    if (!window.confirm(`Delete dataset "${row.name}"?`)) return;
    const deletePhotos =
      row.dataset_type === "photo_library" &&
      window.confirm("Also delete imported photo files from demo-library storage?");
    const result = await deleteFn({ data: { id: row.id, deletePhotos } });
    if (!result.ok) toast.error(result.error ?? "Could not delete dataset.");
    else await load();
  };

  const stats = overview?.stats;

  return (
    <section className="space-y-4 rounded-3xl border border-border bg-card p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-semibold">
            <DatabaseIcon className="h-4 w-4" /> Import Dataset
          </h3>
          <p className="text-sm text-muted-foreground">
            Import ZIP photo libraries or CSV/JSON datasets for the demo generator.
          </p>
        </div>
        <div className="grid min-w-56 grid-cols-2 gap-2 text-xs md:grid-cols-4">
          <Stat label="Total records" value={stats?.totalRecords ?? 0} />
          <Stat label="Photos" value={stats?.photosTotal ?? 0} />
          <Stat label="Countries" value={stats?.countries ?? 0} />
          <Stat label="Languages" value={stats?.languages ?? 0} />
          <Stat label="Names" value={stats?.names ?? 0} />
          <Stat label="Cities" value={stats?.cities ?? 0} />
          <Stat label="Occupations" value={stats?.occupations ?? 0} />
          <Stat label="Interests" value={stats?.interests ?? 0} />
          <Stat label="Bio templates" value={stats?.bioTemplates ?? 0} />
          <Stat label="Religions" value={stats?.religions ?? 0} />
          <Stat label="Universities" value={stats?.universities ?? 0} />
          <Stat label="Companies" value={stats?.companies ?? 0} />
          <Stat label="Estimate" value={stats?.estimatedUniqueProfiles ?? 0} />
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div
          className={cn(
            "grid min-h-40 place-items-center rounded-2xl border border-dashed border-border bg-muted/20 p-5 text-center transition-colors",
            dragging && "border-primary bg-primary/10",
          )}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            void runImport(event.dataTransfer.files[0]);
          }}
        >
          <div className="max-w-md">
            <UploadCloud className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">Drop a ZIP, CSV, or JSON file here</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Files such as countries.csv, cities.csv, male_names.csv, female_names.csv,
              languages.csv, religions.csv, universities.csv, companies.csv, interests.csv, and
              bio_templates.csv are detected automatically.
            </p>
            <label className="mt-4 inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-border px-4 text-sm font-medium">
              {importing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Choose file
              <input
                type="file"
                accept=".zip,.csv,.json"
                className="hidden"
                disabled={importing}
                onChange={(event) => {
                  void runImport(event.target.files?.[0]).finally(() => {
                    event.currentTarget.value = "";
                  });
                }}
              />
            </label>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-border bg-muted/20 p-3">
          <MiniSelect label="Import type" value={datasetType} onChange={setDatasetType}>
            <SelectItem value="auto">Auto-detect from filename</SelectItem>
            <SelectItem value="photo_library">Photo library ZIP</SelectItem>
            <SelectItem value="names">Names with gender column</SelectItem>
            <SelectItem value="male_names">Male names</SelectItem>
            <SelectItem value="female_names">Female names</SelectItem>
            <SelectItem value="countries">Countries</SelectItem>
            <SelectItem value="cities">City dataset</SelectItem>
            <SelectItem value="occupations">Occupation dataset</SelectItem>
            <SelectItem value="education">Education dataset</SelectItem>
            <SelectItem value="universities">Universities</SelectItem>
            <SelectItem value="companies">Companies</SelectItem>
            <SelectItem value="interests">Interests dataset</SelectItem>
            <SelectItem value="bio_templates">Bio templates</SelectItem>
            <SelectItem value="languages">Languages</SelectItem>
            <SelectItem value="religions">Religions</SelectItem>
          </MiniSelect>
          <Field label="Dataset name">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="rounded-xl"
            />
          </Field>
          {report.length > 0 && (
            <div className="max-h-32 overflow-y-auto rounded-xl bg-background p-3 text-xs text-muted-foreground">
              {report.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {(overview?.imports ?? []).slice(0, 8).map((row) => (
          <div key={row.id} className="rounded-2xl border border-border bg-background p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{row.name}</p>
                <p className="text-xs text-muted-foreground/80">
                  {DATASET_LABELS[row.dataset_type] ?? row.dataset_type} -{" "}
                  {row.valid_rows.toLocaleString()} imported -{" "}
                  {Number(row.summary.duplicates ?? 0).toLocaleString()} duplicates -{" "}
                  {row.error_count.toLocaleString()} errors
                </p>
                <p className="text-xs text-muted-foreground">
                  {row.dataset_type.replace("_", " ")} · {row.valid_rows} imported ·{" "}
                  {row.error_count} warnings
                </p>
              </div>
              <Badge variant={row.enabled ? "default" : "secondary"}>
                {row.enabled ? "Enabled" : "Disabled"}
              </Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl"
                onClick={() => toggleDataset(row)}
              >
                {row.enabled ? "Disable" : "Enable"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl"
                onClick={() => renameDataset(row)}
              >
                Rename
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl text-destructive"
                onClick={() => deleteDataset(row)}
              >
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-background p-2">
      <p className="text-muted-foreground">{label}</p>
      <p className="text-base font-semibold">{value.toLocaleString()}</p>
    </div>
  );
}

function MiniSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 rounded-xl">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm font-medium">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function ChipGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: readonly { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div>
      <Label className="mb-2 block">{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = selected.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onToggle(option.value)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:border-primary/60",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
