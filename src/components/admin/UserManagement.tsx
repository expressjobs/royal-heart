import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Ban,
  BadgeCheck,
  CheckSquare,
  Clock,
  Edit,
  Eye,
  EyeOff,
  History,
  KeyRound,
  Loader2,
  MailCheck,
  ImagePlus,
  Receipt,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Upload,
  UserPlus,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ChipSelect } from "@/components/ChipSelect";
import { TIER_LABELS, type MembershipTier } from "@/lib/membership";
import { INTEREST_OPTIONS } from "@/lib/membership";
import {
  EDUCATION_OPTIONS,
  GENDER_OPTIONS,
  INTERESTED_IN_OPTIONS,
  RELATIONSHIP_GOAL_OPTIONS,
} from "@/lib/constants";
import { EmptyState, isBannedNow, PanelLoader, type BanInfo } from "@/components/admin/shared";
import { cn } from "@/lib/utils";
import {
  COMMUNICATION_STYLE_OPTIONS,
  CONFLICT_RESOLUTION_STYLE_OPTIONS,
  CULTURE_BACKGROUND_OPTIONS,
  DEALBREAKER_OPTIONS,
  EDUCATION_IMPORTANCE_OPTIONS,
  FAITH_VALUES_IMPORTANCE_OPTIONS,
  FAMILY_VALUES_OPTIONS,
  FUTURE_PLANS_OPTIONS,
  HAS_CHILDREN_OPTIONS,
  HOBBY_OPTIONS,
  LONG_DISTANCE_OPENNESS_OPTIONS,
  LOVE_LANGUAGE_OPTIONS,
  MARRIAGE_INTENTION_OPTIONS,
  MARRIAGE_TIMELINE_OPTIONS,
  PARTNER_EXPECTATIONS_OPTIONS,
  PERSONALITY_TYPE_OPTIONS,
  RELOCATION_OPENNESS_OPTIONS,
  WANTS_CHILDREN_OPTIONS,
  WORK_LIFE_BALANCE_OPTIONS,
  isSeriousProfileComplete,
} from "@/lib/serious-relationship";
import {
  moderateAdminMember,
  runAdminHealthCheck,
  updateAdminMemberProfile,
  type AdminActionResult,
  type AdminHealthCheckRow,
} from "@/lib/admin.functions";
import {
  bulkUpdateRealProfileDiscoverability,
  createMissingRealProfiles,
  getAdminFullProfileEditor,
  listAdminProfileAuditHistory,
  listAdminRealUsers,
  makeAllEligibleRealUsersDiscoverable,
  repairRealProfileSystemFields,
  saveAdminFullProfileEditor,
  type AdminRealProfileBulkResult,
  type AdminAutoCompleteOptions,
  type AdminFullProfileEditorData,
  type AdminProfileAuditHistoryRow,
  type AdminRealProfileStats,
  type AdminRealUserRow,
  type RealProfileBulkAction,
  type RealProfileStatus,
  type AdminFullProfileEditorLoadResult,
} from "@/lib/real-profiles.functions";
import {
  createAdminPasswordResetLink,
  listAdminLoginHistory,
  type LoginHistoryRow,
} from "@/lib/account-security.functions";
import {
  deleteAdminMemberPhoto,
  listAdminMemberPhotos,
  listAdminReferralDetails,
  replaceAdminMemberPhoto,
  reorderAdminMemberPhotos,
  updateAdminMemberPhoto,
  uploadAdminMemberPhoto,
  type AdminMemberPhotoRow,
  type MarketerCommissionRow,
} from "@/lib/referrals.functions";

type MemberRow = AdminRealUserRow;

type TierFilter = "all" | MembershipTier;
type StatusFilter = "all" | "verified" | "featured" | "suspended";
type ProfileScope = "real" | "managed";
type SeriousFilter =
  | "all"
  | "complete_serious"
  | "marriage_minded"
  | "verified_only"
  | "low_trust"
  | "medium_trust"
  | "high_trust";

const DEFAULT_AUTO_COMPLETE_OPTIONS: AdminAutoCompleteOptions = {
  fillSafeFieldsOnly: true,
  generateAge18Plus: false,
  inferGender: false,
  generateLocationFromAvailable: true,
  acceptAgreements: true,
  makeDiscoverableAfterCompletion: true,
  dryRun: true,
  overwriteInvalidOnly: false,
};

const DEFAULT_FORCE_COMPLETE_OPTIONS: AdminAutoCompleteOptions = {
  defaultCity: "Nairobi",
  defaultCountry: "Kenya",
  defaultGenderFallback: "nonbinary",
  defaultInterestedInFallback: "everyone",
  generateAge18Plus: true,
  inferGender: false,
  generateAdultAge: 30,
  acceptAgreements: true,
  makeDiscoverableAfterCompletion: true,
  dryRun: false,
};

const PLACEHOLDER_PROFILE_ID_RE = /^00000000-0000-(?:0000|4000)-8000-[0-9a-f]{12}$/i;

type AdminReferralDetailRow = {
  id: string;
  marketer?: { full_name?: string | null; referral_code?: string | null } | null;
  referral_code?: string | null;
  status?: string | null;
  created_at: string;
};

type AdminPaymentDetailRow = {
  id: string;
  created_at: string;
  description: string | null;
  amount_cents: number;
  currency: string | null;
  status: string | null;
  reference: string | null;
};

type AdminReferralDetails = {
  referrals: AdminReferralDetailRow[];
  commissions: MarketerCommissionRow[];
  payments: AdminPaymentDetailRow[];
};

export function UserManagement() {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [stats, setStats] = useState<AdminRealProfileStats | null>(null);
  const [banById, setBanById] = useState<Map<string, BanInfo>>(new Map());
  const [loading, setLoading] = useState(true);
  const [repairing, setRepairing] = useState<"create" | "repair" | null>(null);
  const [bulkActioning, setBulkActioning] = useState<RealProfileBulkAction | "all_eligible" | null>(
    null,
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastBulkReport, setLastBulkReport] = useState<AdminRealProfileBulkResult | null>(null);
  const [query, setQuery] = useState("");
  const [profileScope, setProfileScope] = useState<ProfileScope>("real");
  const [showIncompleteOnly, setShowIncompleteOnly] = useState(false);
  const [autoCompleteOpen, setAutoCompleteOpen] = useState(false);
  const [autoCompleteOptions, setAutoCompleteOptions] = useState<AdminAutoCompleteOptions>(
    DEFAULT_AUTO_COMPLETE_OPTIONS,
  );
  const [forceCompleteOpen, setForceCompleteOpen] = useState(false);
  const [forceCompleteOptions, setForceCompleteOptions] = useState<AdminAutoCompleteOptions>(
    DEFAULT_FORCE_COMPLETE_OPTIONS,
  );
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [seriousFilter, setSeriousFilter] = useState<SeriousFilter>("all");
  const [historyMember, setHistoryMember] = useState<MemberRow | null>(null);
  const [photoMember, setPhotoMember] = useState<MemberRow | null>(null);
  const [editorMember, setEditorMember] = useState<MemberRow | null>(null);
  const [editorData, setEditorData] = useState<AdminFullProfileEditorData | null>(null);
  const [editorPhotos, setEditorPhotos] = useState<AdminMemberPhotoRow[]>([]);
  const [editorAudit, setEditorAudit] = useState<AdminProfileAuditHistoryRow[]>([]);
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorSaving, setEditorSaving] = useState(false);
  const [referralMember, setReferralMember] = useState<MemberRow | null>(null);
  const [loginHistory, setLoginHistory] = useState<LoginHistoryRow[]>([]);
  const [memberPhotos, setMemberPhotos] = useState<AdminMemberPhotoRow[]>([]);
  const [memberDetails, setMemberDetails] = useState<AdminReferralDetails>({
    referrals: [],
    commissions: [],
    payments: [],
  });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [healthRows, setHealthRows] = useState<AdminHealthCheckRow[]>([]);
  const [healthLoading, setHealthLoading] = useState(false);
  const listPhotosFn = useServerFn(listAdminMemberPhotos);
  const uploadPhotoFn = useServerFn(uploadAdminMemberPhoto);
  const replacePhotoFn = useServerFn(replaceAdminMemberPhoto);
  const updatePhotoFn = useServerFn(updateAdminMemberPhoto);
  const deletePhotoFn = useServerFn(deleteAdminMemberPhoto);
  const reorderPhotoFn = useServerFn(reorderAdminMemberPhotos);
  const detailsFn = useServerFn(listAdminReferralDetails);
  const fullProfileFn = useServerFn(getAdminFullProfileEditor);
  const saveFullProfileFn = useServerFn(saveAdminFullProfileEditor);
  const profileAuditFn = useServerFn(listAdminProfileAuditHistory);
  const listRealUsersFn = useServerFn(listAdminRealUsers);
  const createMissingProfilesFn = useServerFn(createMissingRealProfiles);
  const repairSystemFieldsFn = useServerFn(repairRealProfileSystemFields);
  const bulkUpdateFn = useServerFn(bulkUpdateRealProfileDiscoverability);
  const makeAllEligibleFn = useServerFn(makeAllEligibleRealUsersDiscoverable);
  const updateMemberProfileFn = useServerFn(updateAdminMemberProfile);
  const moderateMemberFn = useServerFn(moderateAdminMember);
  const healthCheckFn = useServerFn(runAdminHealthCheck);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ rows, stats: nextStats }, { data: mods }] = await Promise.all([
      listRealUsersFn(),
      supabase.from("user_moderation").select("user_id, is_banned, banned_until"),
    ]);
    setMembers(rows);
    setStats(nextStats);
    setSelectedIds(
      (current) => new Set(rows.filter((row) => current.has(row.id)).map((row) => row.id)),
    );
    setBanById(
      new Map(
        (mods ?? []).map((m) => [
          m.user_id,
          { is_banned: m.is_banned, banned_until: m.banned_until },
        ]),
      ),
    );
    setLoading(false);
  }, [listRealUsersFn]);

  useEffect(() => {
    load();
  }, [load]);

  const updateProfile = async (
    id: string,
    patch: { membership_tier?: MembershipTier; is_verified?: boolean; is_featured?: boolean },
    message: string,
  ) => {
    const result = await updateMemberProfileFn({ data: { userId: id, patch } });
    if (!result.ok) {
      toast.error(adminErrorMessage(result, "Could not update member."));
      return;
    }
    setMembers((ms) => ms.map((m) => (m.id === id ? { ...m, ...patch } : m)));
    toast.success(message);
  };

  const moderate = async (id: string, action: "suspend7" | "ban" | "lift", name: string) => {
    const payload =
      action === "lift"
        ? { is_banned: false, banned_until: null, ban_reason: null }
        : action === "suspend7"
          ? {
              is_banned: true,
              banned_until: new Date(Date.now() + 7 * 86400000).toISOString(),
              ban_reason: "Suspended 7 days by admin",
            }
          : { is_banned: true, banned_until: null, ban_reason: "Banned by admin" };
    const result = await moderateMemberFn({ data: { userId: id, action } });
    if (!result.ok) {
      toast.error(adminErrorMessage(result, "Could not update account status."));
      return;
    }
    setBanById((m) => {
      const next = new Map(m);
      next.set(id, { is_banned: payload.is_banned, banned_until: payload.banned_until });
      return next;
    });
    toast.success(
      action === "lift"
        ? `Suspension lifted for ${name}`
        : action === "suspend7"
          ? `${name} suspended 7 days`
          : `${name} banned`,
    );
  };

  const openLoginHistory = async (member: MemberRow) => {
    setHistoryMember(member);
    setHistoryLoading(true);
    try {
      const rows = await listAdminLoginHistory({ data: { userId: member.id } });
      setLoginHistory(rows);
    } catch (error) {
      toast.error(adminErrorMessage(error, "Could not load login history.", member.id));
      setLoginHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const resetPassword = async (member: MemberRow) => {
    try {
      const result = await createAdminPasswordResetLink({ data: { userId: member.id } });
      if (!result.actionLink) throw new Error("No reset link was created.");
      await navigator.clipboard.writeText(result.actionLink);
      toast.success("Password reset link copied.");
    } catch (error) {
      toast.error(adminErrorMessage(error, "Could not create a password reset link.", member.id));
    }
  };

  const loadFullEditor = async (member: MemberRow) => {
    setEditorLoading(true);
    try {
      const [profileResult, photosResult, auditResult, detailsResult] = await Promise.allSettled([
        fullProfileFn({ data: { userId: member.id } }) as Promise<AdminFullProfileEditorLoadResult>,
        listPhotosFn({ data: { userId: member.id } }),
        profileAuditFn({ data: { userId: member.id } }),
        detailsFn({ data: { userId: member.id } }),
      ]);
      if (profileResult.status === "rejected") {
        throw profileResult.reason;
      }
      const profile = profileResult.value;
      if (!profile.ok) {
        toast.error(adminErrorMessage(profile, "Could not load full profile editor.", member.id));
        setEditorData(null);
        setEditorPhotos([]);
        setEditorAudit([]);
        return;
      }
      setEditorData({ profile: profile.profile });
      if (photosResult.status === "fulfilled") {
        setEditorPhotos(photosResult.value);
      } else {
        console.error("[admin-full-profile-editor] optional photos failed", photosResult.reason);
        setEditorPhotos([]);
        toast.message(
          adminErrorMessage(photosResult.reason, "Photos could not be loaded.", member.id),
        );
      }
      if (auditResult.status === "fulfilled") {
        setEditorAudit(auditResult.value);
      } else {
        console.error("[admin-full-profile-editor] optional audit failed", auditResult.reason);
        setEditorAudit([]);
        toast.message(
          adminErrorMessage(auditResult.reason, "Audit history could not be loaded.", member.id),
        );
      }
      if (detailsResult.status === "fulfilled") {
        setMemberDetails(detailsResult.value);
      } else {
        console.error(
          "[admin-full-profile-editor] optional referrals/payments failed",
          detailsResult.reason,
        );
        setMemberDetails({ referrals: [], commissions: [], payments: [] });
      }
    } catch (error) {
      console.error("[admin-full-profile-editor] load failed", error);
      toast.error(adminErrorMessage(error, "Could not load full profile editor.", member.id));
      setEditorData(null);
      setEditorPhotos([]);
      setEditorAudit([]);
    } finally {
      setEditorLoading(false);
    }
  };

  const openFullProfileEditor = async (member: MemberRow) => {
    setEditorMember(member);
    setEditorData(null);
    setEditorPhotos([]);
    setEditorAudit([]);
    await loadFullEditor(member);
  };

  const patchEditorProfile = <K extends keyof AdminFullProfileEditorData["profile"]>(
    key: K,
    value: AdminFullProfileEditorData["profile"][K],
  ) => {
    setEditorData((current) =>
      current ? { profile: { ...current.profile, [key]: value } } : current,
    );
  };

  const saveFullProfile = async () => {
    if (!editorMember || !editorData) return;
    if (!window.confirm("This can change sensitive dating profile fields. Save these admin edits?"))
      return;
    setEditorSaving(true);
    try {
      const result = await saveFullProfileFn({
        data: { userId: editorMember.id, profile: editorData.profile },
      });
      if (!result.ok) {
        const detail = [
          result.error,
          result.dbError?.code ? `Code: ${result.dbError.code}` : null,
          result.dbError?.details ? `Details: ${result.dbError.details}` : null,
          result.dbError?.hint ? `Hint: ${result.dbError.hint}` : null,
        ]
          .filter(Boolean)
          .join(" | ");
        console.error("[admin-full-profile-editor] save failed", result);
        toast.error(detail || "Could not save profile.");
        if (result.missingFields?.length) {
          toast.message(`Missing fields: ${result.missingFields.join(", ")}`);
        }
        return;
      }
      setEditorData({ profile: result.profile });
      setMembers(result.rows);
      setStats(result.stats);
      setEditorAudit(await profileAuditFn({ data: { userId: editorMember.id } }));
      toast.success("Profile saved.");
      if (result.profile.missing_fields.length) {
        toast.message(`Kept out of Discover: ${result.profile.missing_fields.join(", ")}`);
      }
    } finally {
      setEditorSaving(false);
    }
  };

  const openPhotos = async (member: MemberRow) => {
    setPhotoMember(member);
    setPhotoLoading(true);
    try {
      setMemberPhotos(await listPhotosFn({ data: { userId: member.id } }));
    } catch (error) {
      toast.error(adminErrorMessage(error, "Could not load member photos.", member.id));
    } finally {
      setPhotoLoading(false);
    }
  };

  const refreshPhotos = async () => {
    if (!photoMember) return;
    setMemberPhotos(await listPhotosFn({ data: { userId: photoMember.id } }));
    await load();
  };

  const refreshEditorPhotos = async () => {
    if (!editorMember) return;
    const [photos, profileResult] = await Promise.all([
      listPhotosFn({ data: { userId: editorMember.id } }),
      fullProfileFn({ data: { userId: editorMember.id } }),
    ]);
    setEditorPhotos(photos);
    if (profileResult.ok) setEditorData({ profile: profileResult.profile });
    else
      toast.error(adminErrorMessage(profileResult, "Could not refresh profile.", editorMember.id));
    await load();
  };

  const uploadMemberPhoto = async (files: FileList | null) => {
    if (!photoMember || !files?.[0]) return;
    setUploadingPhoto(true);
    try {
      const form = new FormData();
      form.append("user_id", photoMember.id);
      form.append("file", files[0]);
      const result = await uploadPhotoFn({ data: form });
      if (!result.ok) toast.error(result.error ?? "Could not upload photo.");
      else {
        toast.success("Photo added.");
        await refreshPhotos();
      }
    } finally {
      setUploadingPhoto(false);
    }
  };

  const uploadEditorPhoto = async (files: FileList | null) => {
    if (!editorMember || !files?.[0]) return;
    setUploadingPhoto(true);
    try {
      const form = new FormData();
      form.append("user_id", editorMember.id);
      form.append("file", files[0]);
      const result = await uploadPhotoFn({ data: form });
      if (!result.ok) toast.error(result.error ?? "Could not upload photo.");
      else {
        toast.success("Photo added.");
        await refreshEditorPhotos();
      }
    } finally {
      setUploadingPhoto(false);
    }
  };

  const replaceEditorPhoto = async (photo: AdminMemberPhotoRow, files: FileList | null) => {
    if (!editorMember || !files?.[0]) return;
    setUploadingPhoto(true);
    try {
      const form = new FormData();
      form.append("user_id", editorMember.id);
      form.append("photo_id", photo.id);
      form.append("file", files[0]);
      const result = await replacePhotoFn({ data: form });
      if (!result.ok) toast.error(result.error ?? "Could not replace photo.");
      else {
        toast.success("Photo replaced.");
        await refreshEditorPhotos();
      }
    } finally {
      setUploadingPhoto(false);
    }
  };

  const updatePhoto = async (
    photo: AdminMemberPhotoRow,
    action: "primary" | "approve" | "reject" | "public" | "private" | "replace-url",
  ) => {
    if (!photoMember) return;
    const url =
      action === "replace-url"
        ? window.prompt("Replacement storage path or URL", photo.storage_path ?? photo.url)
        : null;
    if (action === "replace-url" && !url) return;
    const result = await updatePhotoFn({
      data: { userId: photoMember.id, photoId: photo.id, action, url: url ?? undefined },
    });
    if (!result.ok) toast.error(result.error ?? "Could not update photo.");
    else {
      toast.success("Photo updated.");
      await refreshPhotos();
    }
  };

  const updateEditorPhoto = async (
    photo: AdminMemberPhotoRow,
    action: "primary" | "approve" | "reject" | "public" | "private",
  ) => {
    if (!editorMember) return;
    const result = await updatePhotoFn({
      data: { userId: editorMember.id, photoId: photo.id, action },
    });
    if (!result.ok) toast.error(result.error ?? "Could not update photo.");
    else {
      toast.success("Photo updated.");
      await refreshEditorPhotos();
    }
  };

  const deletePhoto = async (photo: AdminMemberPhotoRow) => {
    if (!photoMember || !window.confirm("Remove this member photo?")) return;
    const result = await deletePhotoFn({ data: { userId: photoMember.id, photoId: photo.id } });
    if (!result.ok) toast.error(result.error ?? "Could not delete photo.");
    else {
      toast.success("Photo removed.");
      await refreshPhotos();
    }
  };

  const deleteEditorPhoto = async (photo: AdminMemberPhotoRow) => {
    if (!editorMember || !window.confirm("Remove this member photo?")) return;
    const result = await deletePhotoFn({ data: { userId: editorMember.id, photoId: photo.id } });
    if (!result.ok) toast.error(result.error ?? "Could not delete photo.");
    else {
      toast.success("Photo removed.");
      await refreshEditorPhotos();
    }
  };

  const movePhoto = async (photo: AdminMemberPhotoRow, direction: -1 | 1) => {
    if (!photoMember) return;
    const photos = [...memberPhotos].sort((a, b) => a.position - b.position);
    const index = photos.findIndex((item) => item.id === photo.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= photos.length) return;
    [photos[index], photos[target]] = [photos[target], photos[index]];
    const result = await reorderPhotoFn({
      data: { userId: photoMember.id, photoIds: photos.map((item) => item.id) },
    });
    if (!result.ok) toast.error(result.error ?? "Could not reorder photos.");
    else await refreshPhotos();
  };

  const moveEditorPhoto = async (photo: AdminMemberPhotoRow, direction: -1 | 1) => {
    if (!editorMember) return;
    const photos = [...editorPhotos].sort((a, b) => a.position - b.position);
    const index = photos.findIndex((item) => item.id === photo.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= photos.length) return;
    [photos[index], photos[target]] = [photos[target], photos[index]];
    const result = await reorderPhotoFn({
      data: { userId: editorMember.id, photoIds: photos.map((item) => item.id) },
    });
    if (!result.ok) toast.error(result.error ?? "Could not reorder photos.");
    else await refreshEditorPhotos();
  };

  const openReferralDetails = async (member: MemberRow) => {
    setReferralMember(member);
    try {
      setMemberDetails(await detailsFn({ data: { userId: member.id } }));
    } catch (error) {
      setMemberDetails({ referrals: [], commissions: [], payments: [] });
      toast.error(adminErrorMessage(error, "Could not load referrals and payments.", member.id));
    }
  };

  const runHealthCheck = async () => {
    setHealthLoading(true);
    try {
      setHealthRows(await healthCheckFn());
    } catch (error) {
      toast.error(adminErrorMessage(error, "Could not run admin health check."));
      setHealthRows([
        {
          name: "Admin health check",
          passed: false,
          stage: "run",
          error: adminErrorMessage(error, "Could not run admin health check."),
        },
      ]);
    } finally {
      setHealthLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter((m) => {
      const managed =
        PLACEHOLDER_PROFILE_ID_RE.test(m.id) ||
        m.profile_source === "managed_profile" ||
        m.profile_source === "admin_created";
      if (profileScope === "real" ? managed : !managed) return false;
      if (showIncompleteOnly && m.missing_fields.length === 0) return false;
      if (tierFilter !== "all" && m.membership_tier !== tierFilter) return false;
      if (statusFilter === "verified" && !m.is_verified) return false;
      if (statusFilter === "featured" && !m.is_featured) return false;
      if (statusFilter === "suspended" && !isBannedNow(banById.get(m.id))) return false;
      if (seriousFilter === "complete_serious" && !isSeriousProfileComplete(m)) return false;
      if (seriousFilter === "marriage_minded" && m.marriage_intention !== "marriage") return false;
      if (seriousFilter === "verified_only" && !m.is_verified) return false;
      if (seriousFilter === "low_trust" && m.trust_level !== "low") return false;
      if (seriousFilter === "medium_trust" && m.trust_level !== "medium") return false;
      if (
        seriousFilter === "high_trust" &&
        m.trust_level !== "high" &&
        m.trust_level !== "verified"
      )
        return false;
      if (q) {
        const hay =
          `${m.display_name ?? ""} ${m.username ?? ""} ${m.location_city ?? ""} ${m.location_country ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    members,
    query,
    profileScope,
    showIncompleteOnly,
    tierFilter,
    statusFilter,
    seriousFilter,
    banById,
  ]);

  const selectedCount = selectedIds.size;
  const incompleteIds = useMemo(
    () => filtered.filter((member) => member.missing_fields.length > 0).map((member) => member.id),
    [filtered],
  );
  const filteredIds = useMemo(() => filtered.map((member) => member.id), [filtered]);
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id));

  const toggleSelected = (id: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleFilteredSelection = (checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const id of filteredIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const selectAllIncomplete = () => {
    setShowIncompleteOnly(true);
    setSelectedIds(new Set(incompleteIds));
  };

  const summarizeBulkResult = (result: AdminRealProfileBulkResult) => {
    setMembers(result.rows);
    setStats(result.stats);
    setLastBulkReport(result);
    if (result.auditWarning) toast.warning(result.auditWarning);
    const missingRequired = result.skippedRows.filter((row) =>
      row.reason.includes("required fields are missing"),
    ).length;
    if ((result.failed ?? 0) > 0) {
      toast.error(
        `${result.updated} updated, ${result.failed} failed. See the final report for exact database errors.`,
      );
    } else if (result.skipped > 0) {
      toast.message(
        `${result.updated} updated, ${result.skipped} skipped${
          missingRequired > 0 ? " because required fields are missing." : "."
        }`,
      );
    } else {
      toast.success(`${result.updated} user${result.updated === 1 ? "" : "s"} updated.`);
    }
  };

  const runBulkAction = async (action: RealProfileBulkAction) => {
    if (selectedIds.size === 0) {
      toast.error("Select at least one user first.");
      return;
    }
    if (
      action === "admin_assisted_complete" &&
      !window.confirm(
        "Auto-complete only safe, generic, or inferable fields for selected real users? Age and gender will remain manual.",
      )
    ) {
      return;
    }
    if (
      action === "accept_agreements" &&
      !window.confirm("Accept safety and terms/privacy agreements for the selected real users?")
    ) {
      return;
    }
    setBulkActioning(action);
    try {
      const result = await bulkUpdateFn({ data: { action, ids: [...selectedIds] } });
      summarizeBulkResult(result);
      if (action === "make_discoverable" || action === "hide_from_discover") {
        setSelectedIds(new Set());
      }
    } catch (error) {
      console.error("[real-profile-bulk-action]", error);
      toast.error(adminErrorMessage(error, "Bulk action failed.", [...selectedIds].join(", ")));
    } finally {
      setBulkActioning(null);
    }
  };

  const runAutoCompleteMissingRequired = async () => {
    if (selectedIds.size === 0) {
      toast.error("Select at least one incomplete profile first.");
      return;
    }
    if (
      (autoCompleteOptions.generateAge18Plus || autoCompleteOptions.inferGender) &&
      !window.confirm(
        "Admin-assisted completion will fill missing public dating fields for selected users. Age and gender can affect matching. Only enable age/gender auto-fill if you understand this.",
      )
    ) {
      return;
    }
    setAutoCompleteOpen(false);
    setBulkActioning("auto_complete_missing_required_fields");
    try {
      const result = await bulkUpdateFn({
        data: {
          action: "auto_complete_missing_required_fields",
          ids: [...selectedIds],
          options: autoCompleteOptions,
        },
      });
      summarizeBulkResult(result);
      toast.message(
        autoCompleteOptions.dryRun
          ? "Dry run preview complete. Review the final report before applying changes."
          : "Admin-assisted completion finished. Review the final report for remaining fields.",
      );
    } catch (error) {
      console.error("[real-profile-auto-complete]", error);
      toast.error(adminErrorMessage(error, "Bulk action failed.", [...selectedIds].join(", ")));
    } finally {
      setBulkActioning(null);
    }
  };

  const runForceComplete = async () => {
    if (selectedIds.size === 0) {
      toast.error("Select at least one profile first.");
      return;
    }
    if (
      !window.confirm(
        `Force complete ${selectedIds.size} selected profile${
          selectedIds.size === 1 ? "" : "s"
        } using the defaults in this modal? Verification, photos, likes, matches, and conversations will not be changed.`,
      )
    ) {
      return;
    }
    setForceCompleteOpen(false);
    setBulkActioning("force_complete_profile");
    try {
      const result = await bulkUpdateFn({
        data: {
          action: "force_complete_profile",
          ids: [...selectedIds],
          options: forceCompleteOptions,
        },
      });
      summarizeBulkResult(result);
    } catch (error) {
      toast.error(adminErrorMessage(error, "Force complete failed.", [...selectedIds].join(", ")));
    } finally {
      setBulkActioning(null);
    }
  };

  const runConvertPlaceholdersToManaged = async () => {
    const placeholderIds = [...selectedIds].filter((id) => PLACEHOLDER_PROFILE_ID_RE.test(id));
    if (placeholderIds.length === 0) {
      toast.error("Select at least one placeholder UUID profile first.");
      return;
    }
    if (
      !window.confirm(
        "These profiles do not belong to real authenticated users. They will appear as managed member profiles controlled by admin.\n\nConvert the selected placeholder profiles? This will not mark them verified or create messages, likes, matches, or activity.",
      )
    ) {
      return;
    }
    setBulkActioning("convert_placeholder_to_managed");
    try {
      const result = await bulkUpdateFn({
        data: {
          action: "convert_placeholder_to_managed",
          ids: placeholderIds,
          options: {
            ...forceCompleteOptions,
            confirmManagedProfileConversion: true,
            generateAge18Plus: true,
            acceptAgreements: true,
            makeDiscoverableAfterCompletion: true,
          },
        },
      });
      summarizeBulkResult(result);
      toast.success("Placeholder profiles converted to managed member profiles.");
    } catch (error) {
      toast.error(
        adminErrorMessage(error, "Managed profile conversion failed.", placeholderIds.join(", ")),
      );
    } finally {
      setBulkActioning(null);
    }
  };

  const makeEditorDiscoverableIfComplete = async () => {
    if (!editorMember || !editorData) return;
    if (editorData.profile.missing_fields.length > 0) {
      toast.warning(
        `Still missing: ${editorData.profile.missing_fields.join(", ")}. Age and gender must be completed manually.`,
      );
      return;
    }
    setEditorSaving(true);
    try {
      const result = await bulkUpdateFn({
        data: { action: "make_discoverable", ids: [editorMember.id] },
      });
      summarizeBulkResult(result);
      const refreshed = await fullProfileFn({ data: { userId: editorMember.id } });
      if (refreshed.ok) setEditorData({ profile: refreshed.profile });
      if (result.updated > 0) toast.success("Profile is discoverable.");
    } catch (error) {
      console.error("[admin-full-profile-editor] make discoverable failed", error);
      toast.error(adminErrorMessage(error, "Could not make profile discoverable."));
    } finally {
      setEditorSaving(false);
    }
  };

  const runMakeAllEligible = async () => {
    setBulkActioning("all_eligible");
    try {
      const result = await makeAllEligibleFn();
      summarizeBulkResult(result);
    } catch (error) {
      console.error("[real-profile-bulk-action]", error);
      toast.error(adminErrorMessage(error, "Could not make eligible users discoverable."));
    } finally {
      setBulkActioning(null);
    }
  };

  const runCreateMissingProfiles = async () => {
    setRepairing("create");
    try {
      const result = await createMissingProfilesFn();
      setMembers(result.rows);
      setStats(result.stats);
      toast.success(
        `Created ${result.created ?? 0} missing real profile row${result.created === 1 ? "" : "s"}.`,
      );
    } catch (error) {
      toast.error(adminErrorMessage(error, "Could not create missing real profiles."));
    } finally {
      setRepairing(null);
    }
  };

  const runRepairSystemFields = async () => {
    setRepairing("repair");
    try {
      const result = await repairSystemFieldsFn();
      if (!result.ok) {
        console.error("[real-profile-repair]", result);
        const detail = [
          result.error,
          result.dbError?.code ? `Code: ${result.dbError.code}` : null,
          result.dbError?.details ? `Details: ${result.dbError.details}` : null,
          result.dbError?.hint ? `Hint: ${result.dbError.hint}` : null,
          result.rowId ? `Row: ${result.rowId}` : null,
          result.failingQuery ? `Query: ${result.failingQuery}` : null,
          `Stage: ${result.stage}`,
        ]
          .filter(Boolean)
          .join(" | ");
        toast.error(import.meta.env.DEV ? detail : "Could not repair real profile system fields.");
        return;
      }
      setMembers(result.rows);
      setStats(result.stats);
      const report = {
        ...result,
        action: "repair_system_fields" as const,
        updated: result.updated ?? result.repaired ?? 0,
        skipped: result.skipped ?? 0,
        skippedRows: result.skippedRows ?? [],
      };
      setLastBulkReport(report);
      if ((result.failed ?? 0) > 0) {
        toast.error(
          `${report.updated} updated, ${result.failed} failed. See the final report for exact database errors.`,
        );
      } else {
        toast.success(
          `Processed ${result.processed ?? result.rows.length}, updated ${report.updated}, made discoverable ${result.madeDiscoverable ?? 0}.`,
        );
      }
    } catch (error) {
      console.error("[real-profile-repair] unexpected client failure", error);
      toast.error(adminErrorMessage(error, "Could not repair real profile system fields."));
    } finally {
      setRepairing(null);
    }
  };

  if (loading) return <PanelLoader />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or location…"
            className="rounded-full pl-9"
          />
        </div>
        <Select value={tierFilter} onValueChange={(v) => setTierFilter(v as TierFilter)}>
          <SelectTrigger className="w-36 rounded-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tiers</SelectItem>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="gold">Gold</SelectItem>
            <SelectItem value="platinum">Platinum</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-36 rounded-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="featured">Featured</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
        <Select value={seriousFilter} onValueChange={(v) => setSeriousFilter(v as SeriousFilter)}>
          <SelectTrigger className="w-48 rounded-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All relationship profiles</SelectItem>
            <SelectItem value="complete_serious">Complete serious profile</SelectItem>
            <SelectItem value="marriage_minded">Marriage-minded</SelectItem>
            <SelectItem value="verified_only">Verified only</SelectItem>
            <SelectItem value="low_trust">Low trust / needs review</SelectItem>
            <SelectItem value="medium_trust">Medium trust</SelectItem>
            <SelectItem value="high_trust">High or verified trust</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-xs">
          <MetricBadge label="Real users" value={stats?.totalRealUsers ?? members.length} />
          <MetricBadge label="Missing profiles" value={stats?.missingProfileRows ?? 0} />
          <MetricBadge label="Incomplete" value={stats?.incompleteProfiles ?? 0} />
          <MetricBadge label="Eligible hidden" value={stats?.eligibleButHiddenRealUsers ?? 0} />
          <MetricBadge label="Discoverable" value={stats?.discoverableRealUsers ?? 0} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={showIncompleteOnly ? "hero" : "outline"}
            size="sm"
            className="rounded-full"
            onClick={() => setShowIncompleteOnly((current) => !current)}
          >
            <Search className="h-4 w-4" />
            Incomplete profiles
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={selectAllIncomplete}
            disabled={incompleteIds.length === 0 || Boolean(bulkActioning || repairing)}
          >
            <CheckSquare className="h-4 w-4" />
            Select all incomplete
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={runHealthCheck}
            disabled={healthLoading}
          >
            {healthLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            Admin health check
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => void load()}
            disabled={Boolean(repairing)}
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={runCreateMissingProfiles}
            disabled={Boolean(repairing)}
          >
            {repairing === "create" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            Create missing real profiles
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={runRepairSystemFields}
            disabled={Boolean(repairing)}
          >
            {repairing === "repair" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wrench className="h-4 w-4" />
            )}
            Repair real profile system fields
          </Button>
          <Button
            variant="hero"
            size="sm"
            className="rounded-full"
            onClick={runMakeAllEligible}
            disabled={Boolean(bulkActioning || repairing)}
          >
            {bulkActioning === "all_eligible" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
            Make all eligible users discoverable
          </Button>
        </div>
      </div>

      {healthRows.length > 0 && (
        <div className="rounded-3xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-semibold">Admin Health Check</h3>
              <p className="text-xs text-muted-foreground">
                {healthRows.filter((row) => row.passed).length} passed,{" "}
                {healthRows.filter((row) => !row.passed).length} failed.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setHealthRows([])}>
              Clear
            </Button>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {healthRows.map((row) => (
              <div
                key={`${row.name}-${row.stage}`}
                className="rounded-2xl border border-border p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{row.name}</p>
                  <Badge variant={row.passed ? "default" : "destructive"}>
                    {row.passed ? "Passed" : "Failed"}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Stage: {row.stage}</p>
                {!row.passed && (
                  <p className="mt-1 break-words text-xs text-destructive">
                    {adminErrorMessage(row, row.error ?? "Health check failed.")}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <Tabs
        value={profileScope}
        onValueChange={(value) => {
          setProfileScope(value as ProfileScope);
          setSelectedIds(new Set());
          setLastBulkReport(null);
        }}
      >
        <TabsList>
          <TabsTrigger value="real">
            Real users (
            {
              members.filter(
                (member) =>
                  !PLACEHOLDER_PROFILE_ID_RE.test(member.id) &&
                  member.profile_source !== "managed_profile" &&
                  member.profile_source !== "admin_created",
              ).length
            }
            )
          </TabsTrigger>
          <TabsTrigger value="managed">
            Managed profiles (
            {
              members.filter(
                (member) =>
                  PLACEHOLDER_PROFILE_ID_RE.test(member.id) ||
                  member.profile_source === "managed_profile" ||
                  member.profile_source === "admin_created",
              ).length
            }
            )
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <p className="text-sm text-muted-foreground">
        {filtered.length} {profileScope === "real" ? "real users" : "managed profiles"}
      </p>

      <div className="rounded-2xl border border-border bg-card p-3">
        {profileScope === "managed" && (
          <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-medium">Managed profile conversion</p>
            <p className="mt-1">
              These profiles do not belong to real authenticated users. They will appear as managed
              member profiles controlled by admin.
            </p>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <Checkbox
              checked={allFilteredSelected ? true : selectedCount > 0 ? "indeterminate" : false}
              onCheckedChange={(checked) => toggleFilteredSelection(checked === true)}
              aria-label="Select visible users"
            />
            {selectedCount > 0 ? `${selectedCount} selected` : "Select users"}
          </label>
          <div className="flex flex-wrap gap-2">
            {profileScope === "real" && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => runBulkAction("make_discoverable")}
                  disabled={
                    profileScope !== "real" ||
                    selectedCount === 0 ||
                    Boolean(bulkActioning || repairing)
                  }
                >
                  {bulkActioning === "make_discoverable" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                  Make discoverable
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => runBulkAction("hide_from_discover")}
                  disabled={selectedCount === 0 || Boolean(bulkActioning || repairing)}
                >
                  <EyeOff className="h-4 w-4" /> Hide from Discover
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => runBulkAction("mark_active")}
                  disabled={selectedCount === 0 || Boolean(bulkActioning || repairing)}
                >
                  <CheckSquare className="h-4 w-4" /> Mark active
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => runBulkAction("mark_inactive")}
                  disabled={selectedCount === 0 || Boolean(bulkActioning || repairing)}
                >
                  <Ban className="h-4 w-4" /> Mark inactive
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => runBulkAction("repair_system_fields")}
                  disabled={selectedCount === 0 || Boolean(bulkActioning || repairing)}
                >
                  <Wrench className="h-4 w-4" /> Repair selected
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => runBulkAction("accept_agreements")}
                  disabled={selectedCount === 0 || Boolean(bulkActioning || repairing)}
                >
                  {bulkActioning === "accept_agreements" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" />
                  )}
                  Accept agreements
                </Button>
                <Button
                  variant="hero"
                  size="sm"
                  className="rounded-full"
                  onClick={() => setAutoCompleteOpen(true)}
                  disabled={selectedCount === 0 || Boolean(bulkActioning || repairing)}
                >
                  {bulkActioning === "auto_complete_missing_required_fields" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Auto-complete missing required fields
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="rounded-full"
                  onClick={() => setForceCompleteOpen(true)}
                  disabled={selectedCount === 0 || Boolean(bulkActioning || repairing)}
                >
                  {bulkActioning === "force_complete_profile" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Force Complete Profile
                </Button>
              </>
            )}
            {profileScope === "managed" && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-full border-amber-500 text-amber-700"
                onClick={runConvertPlaceholdersToManaged}
                disabled={
                  profileScope !== "managed" ||
                  selectedCount === 0 ||
                  Boolean(bulkActioning || repairing)
                }
              >
                {bulkActioning === "convert_placeholder_to_managed" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                Convert placeholder profiles to managed profiles
              </Button>
            )}
          </div>
        </div>
        {lastBulkReport && (
          <div className="mt-3 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">
              Final report: {lastBulkReport.processed ?? selectedCount} processed,{" "}
              {lastBulkReport.updated} updated, {lastBulkReport.madeDiscoverable ?? 0} made
              discoverable, {lastBulkReport.stillIncomplete ?? 0} still incomplete,{" "}
              {lastBulkReport.failed ?? 0} failed
            </p>
            {lastBulkReport.auditWarning && (
              <p className="mt-1 text-amber-600">{lastBulkReport.auditWarning}</p>
            )}
            <div className="mt-2 grid gap-2 sm:grid-cols-5">
              <MetricMini
                label="Real users processed"
                value={lastBulkReport.realUsersProcessed ?? 0}
              />
              <MetricMini
                label="Managed profiles skipped"
                value={lastBulkReport.managedProfilesSkipped ?? 0}
              />
              <MetricMini
                label="Managed profiles converted"
                value={lastBulkReport.managedProfilesConverted ?? 0}
              />
              <MetricMini label="Updated" value={lastBulkReport.updated} />
              <MetricMini label="Made discoverable" value={lastBulkReport.madeDiscoverable ?? 0} />
              <MetricMini label="Still incomplete" value={lastBulkReport.stillIncomplete ?? 0} />
              <MetricMini label="Failed" value={lastBulkReport.failed ?? 0} />
              <MetricMini
                label="Still missing age/gender"
                value={lastBulkReport.stillMissingAgeGender ?? 0}
              />
              <MetricMini label="Now discoverable" value={lastBulkReport.nowDiscoverable ?? 0} />
              <MetricMini label="Not discoverable" value={lastBulkReport.notDiscoverable ?? 0} />
              <MetricMini label="Skipped" value={lastBulkReport.skipped} />
            </div>
            {lastBulkReport.blockedReasonCounts &&
              Object.keys(lastBulkReport.blockedReasonCounts).length > 0 && (
                <div className="mt-2">
                  <p className="font-medium text-foreground">Blocked reason counts</p>
                  <ul className="mt-1 space-y-1">
                    {Object.entries(lastBulkReport.blockedReasonCounts).map(([reason, count]) => (
                      <li key={reason}>
                        {count}: {reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            {lastBulkReport.stillBlockedByField &&
              Object.keys(lastBulkReport.stillBlockedByField).length > 0 && (
                <div className="mt-2">
                  <p className="font-medium text-foreground">Still blocked by field</p>
                  <ul className="mt-1 space-y-1">
                    {Object.entries(lastBulkReport.stillBlockedByField).map(([field, count]) => (
                      <li key={field}>
                        {count}: {field}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            {lastBulkReport.skippedRows.length > 0 && (
              <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto">
                {lastBulkReport.skippedRows.slice(0, 20).map((row) => (
                  <li key={row.id}>
                    {row.name ?? row.id}: {row.reason}
                    {row.remainingFields?.length
                      ? ` Remaining: ${row.remainingFields.join(", ")}`
                      : ""}
                  </li>
                ))}
                {lastBulkReport.skippedRows.length > 20 && (
                  <li>{lastBulkReport.skippedRows.length - 20} more skipped users...</li>
                )}
              </ul>
            )}
            {lastBulkReport.failures?.length ? (
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-destructive">
                {lastBulkReport.failures.slice(0, 20).map((failure) => (
                  <li key={`${failure.id}-${failure.stage}-${failure.query}`}>
                    {failure.name ?? failure.id}: {failure.error} | Stage: {failure.stage} | Query:{" "}
                    {failure.query}
                    {failure.dbError.code ? ` | Code: ${failure.dbError.code}` : ""}
                    {failure.dbError.details ? ` | Details: ${failure.dbError.details}` : ""}
                    {failure.dbError.hint ? ` | Hint: ${failure.dbError.hint}` : ""}
                  </li>
                ))}
                {lastBulkReport.failures.length > 20 && (
                  <li>{lastBulkReport.failures.length - 20} more failed users...</li>
                )}
              </ul>
            ) : null}
          </div>
        )}
      </div>

      <Dialog open={autoCompleteOpen} onOpenChange={setAutoCompleteOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Admin-assisted completion</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Admin-assisted completion will fill missing public dating fields for selected users.
              Age and gender can affect matching. Only enable age/gender auto-fill if you understand
              this.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <OptionCheckbox
                label="Fill safe fields only"
                checked={autoCompleteOptions.fillSafeFieldsOnly !== false}
                onCheckedChange={(checked) =>
                  setAutoCompleteOptions((current) => ({
                    ...current,
                    fillSafeFieldsOnly: checked,
                  }))
                }
              />
              <OptionCheckbox
                label="Generate adult birth date (18-60 years)"
                checked={Boolean(autoCompleteOptions.generateAge18Plus)}
                onCheckedChange={(checked) =>
                  setAutoCompleteOptions((current) => ({
                    ...current,
                    generateAge18Plus: checked,
                  }))
                }
              />
              <OptionCheckbox
                label="Infer gender from profile if admin confirms"
                checked={Boolean(autoCompleteOptions.inferGender)}
                onCheckedChange={(checked) =>
                  setAutoCompleteOptions((current) => ({ ...current, inferGender: checked }))
                }
              />
              <OptionCheckbox
                label="Generate city/country from available location"
                checked={Boolean(autoCompleteOptions.generateLocationFromAvailable)}
                onCheckedChange={(checked) =>
                  setAutoCompleteOptions((current) => ({
                    ...current,
                    generateLocationFromAvailable: checked,
                  }))
                }
              />
              <OptionCheckbox
                label="Accept agreements"
                checked={Boolean(autoCompleteOptions.acceptAgreements)}
                onCheckedChange={(checked) =>
                  setAutoCompleteOptions((current) => ({
                    ...current,
                    acceptAgreements: checked,
                  }))
                }
              />
              <OptionCheckbox
                label="Make discoverable automatically"
                checked={Boolean(autoCompleteOptions.makeDiscoverableAfterCompletion)}
                onCheckedChange={(checked) =>
                  setAutoCompleteOptions((current) => ({
                    ...current,
                    makeDiscoverableAfterCompletion: checked,
                  }))
                }
              />
              <OptionCheckbox
                label="Preview changes"
                checked={Boolean(autoCompleteOptions.dryRun)}
                onCheckedChange={(checked) =>
                  setAutoCompleteOptions((current) => ({ ...current, dryRun: checked }))
                }
              />
              <OptionCheckbox
                label="Overwrite invalid only"
                checked={Boolean(autoCompleteOptions.overwriteInvalidOnly)}
                onCheckedChange={(checked) =>
                  setAutoCompleteOptions((current) => ({
                    ...current,
                    overwriteInvalidOnly: checked,
                  }))
                }
              />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => setAutoCompleteOpen(false)}>
                Cancel
              </Button>
              <Button variant="hero" onClick={runAutoCompleteMissingRequired}>
                {autoCompleteOptions.dryRun ? "Preview changes" : "Apply completion"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={forceCompleteOpen} onOpenChange={setForceCompleteOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Force Complete Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              Fills required non-sensitive discover fields only. Photos, verification, likes,
              matches, messages, and conversations are not changed.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="force-default-city">Default city</Label>
                <Input
                  id="force-default-city"
                  value={forceCompleteOptions.defaultCity ?? ""}
                  onChange={(event) =>
                    setForceCompleteOptions((current) => ({
                      ...current,
                      defaultCity: event.target.value,
                    }))
                  }
                  placeholder="Nairobi"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="force-default-country">Default country</Label>
                <Input
                  id="force-default-country"
                  value={forceCompleteOptions.defaultCountry ?? ""}
                  onChange={(event) =>
                    setForceCompleteOptions((current) => ({
                      ...current,
                      defaultCountry: event.target.value,
                    }))
                  }
                  placeholder="Kenya"
                />
              </div>
              <div className="space-y-2">
                <Label>Default gender fallback</Label>
                <Select
                  value={forceCompleteOptions.defaultGenderFallback ?? "nonbinary"}
                  onValueChange={(value) =>
                    setForceCompleteOptions((current) => ({
                      ...current,
                      defaultGenderFallback: value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GENDER_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Default interested_in fallback</Label>
                <Select
                  value={forceCompleteOptions.defaultInterestedInFallback ?? "everyone"}
                  onValueChange={(value) =>
                    setForceCompleteOptions((current) => ({
                      ...current,
                      defaultInterestedInFallback: value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERESTED_IN_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="force-adult-age">Generate adult age</Label>
                <Input
                  id="force-adult-age"
                  type="number"
                  min={18}
                  max={60}
                  value={forceCompleteOptions.generateAdultAge ?? 30}
                  onChange={(event) =>
                    setForceCompleteOptions((current) => ({
                      ...current,
                      generateAdultAge: Number(event.target.value),
                    }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <OptionCheckbox
                label="Generate adult age"
                checked={forceCompleteOptions.generateAge18Plus === true}
                onCheckedChange={(checked) =>
                  setForceCompleteOptions((current) => ({
                    ...current,
                    generateAge18Plus: checked,
                  }))
                }
              />
              <OptionCheckbox
                label="Fill missing gender with selected fallback"
                checked={forceCompleteOptions.inferGender === true}
                onCheckedChange={(checked) =>
                  setForceCompleteOptions((current) => ({
                    ...current,
                    inferGender: checked,
                  }))
                }
              />
              <OptionCheckbox
                label="Accept agreements"
                checked={forceCompleteOptions.acceptAgreements !== false}
                onCheckedChange={(checked) =>
                  setForceCompleteOptions((current) => ({
                    ...current,
                    acceptAgreements: checked,
                  }))
                }
              />
              <OptionCheckbox
                label="Make discoverable"
                checked={forceCompleteOptions.makeDiscoverableAfterCompletion !== false}
                onCheckedChange={(checked) =>
                  setForceCompleteOptions((current) => ({
                    ...current,
                    makeDiscoverableAfterCompletion: checked,
                  }))
                }
              />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => setForceCompleteOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={runForceComplete}>
                {bulkActioning === "force_complete_profile" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Force complete selected
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {filtered.length === 0 ? (
        <EmptyState>No members match these filters.</EmptyState>
      ) : (
        <ul className="space-y-2">
          {filtered.map((m) => {
            const banned = isBannedNow(banById.get(m.id));
            const name = m.display_name ?? "Member";
            const locked =
              m.account_locked_until && new Date(m.account_locked_until).getTime() > Date.now();
            const status = profileStatusLabel(m.profile_status);
            return (
              <li
                key={m.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3 sm:flex-nowrap"
              >
                <Checkbox
                  checked={selectedIds.has(m.id)}
                  onCheckedChange={(checked) => toggleSelected(m.id, checked === true)}
                  aria-label={`Select ${name}`}
                />
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl">
                  <ProfilePhoto path={m.primary_photo} alt={name} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate font-medium">{name}</span>
                    {m.is_verified && <BadgeCheck className="h-4 w-4 text-sky-500" />}
                    {m.email_verified && <MailCheck className="h-4 w-4 text-emerald-600" />}
                    {m.is_featured && <Star className="h-4 w-4 fill-amber-400 text-amber-400" />}
                    {banned && (
                      <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                        Suspended
                      </Badge>
                    )}
                    {locked && (
                      <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                        Locked
                      </Badge>
                    )}
                    <Badge variant={status.variant} className="h-5 px-1.5 text-[10px]">
                      {status.label}
                    </Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {[m.location_city, m.location_country].filter(Boolean).join(", ") ||
                      "No location"}{" "}
                    - joined {new Date(m.created_at).toLocaleDateString()}
                  </p>
                  <p className="truncate text-xs text-muted-foreground/80">
                    @{m.username ?? "no-username"} - Last login{" "}
                    {m.last_login_at ? new Date(m.last_login_at).toLocaleString() : "not recorded"}
                    {m.failed_login_attempts > 0 && ` - ${m.failed_login_attempts} failed attempts`}
                  </p>
                  {m.missing_fields.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {m.missing_fields.map((field) => (
                        <Badge
                          key={`${m.id}-${field}`}
                          variant="outline"
                          className="border-amber-400/50 text-[10px] text-amber-700 dark:text-amber-300"
                        >
                          {field}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                {showIncompleteOnly && (
                  <div className="flex flex-wrap gap-1 text-[10px]">
                    <Badge variant={m.photo_count > 0 ? "default" : "outline"}>
                      {m.photo_count > 0 ? "Has photo" : "Avatar fallback"}
                    </Badge>
                    <Badge variant={m.is_active === false ? "destructive" : "outline"}>
                      {m.is_active === false ? "Inactive" : "Active"}
                    </Badge>
                    <Badge variant={m.is_discoverable ? "default" : "outline"}>
                      {m.is_discoverable ? "Discoverable" : "Hidden"}
                    </Badge>
                  </div>
                )}
                <Badge
                  variant="outline"
                  className={
                    m.membership_tier === "platinum"
                      ? "border-violet-400/40 text-violet-600 dark:text-violet-400"
                      : m.membership_tier === "gold"
                        ? "border-amber-400/40 text-amber-600 dark:text-amber-400"
                        : ""
                  }
                >
                  {TIER_LABELS[m.membership_tier]}
                </Badge>
                {showIncompleteOnly && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => openFullProfileEditor(m)}
                  >
                    <Edit className="h-4 w-4" />
                    Quick edit
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="rounded-full">
                      Manage
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuLabel>Membership tier</DropdownMenuLabel>
                    {(["free", "gold", "platinum"] as MembershipTier[]).map((t) => (
                      <DropdownMenuItem
                        key={t}
                        disabled={m.membership_tier === t}
                        onClick={() =>
                          updateProfile(
                            m.id,
                            { membership_tier: t },
                            `${name} set to ${TIER_LABELS[t]}`,
                          )
                        }
                      >
                        <Sparkles className="h-4 w-4" /> {TIER_LABELS[t]}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() =>
                        updateProfile(
                          m.id,
                          { is_verified: !m.is_verified },
                          m.is_verified ? "Verification removed" : `${name} verified`,
                        )
                      }
                    >
                      <BadgeCheck className="h-4 w-4" />{" "}
                      {m.is_verified ? "Remove verification" : "Verify member"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        updateProfile(
                          m.id,
                          { is_featured: !m.is_featured },
                          m.is_featured ? "Unfeatured" : `${name} featured`,
                        )
                      }
                    >
                      <Star className="h-4 w-4" />{" "}
                      {m.is_featured ? "Remove featured" : "Feature profile"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => openFullProfileEditor(m)}>
                      <Edit className="h-4 w-4" /> Edit full profile
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openLoginHistory(m)}>
                      <History className="h-4 w-4" /> View login history
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openPhotos(m)}>
                      <ImagePlus className="h-4 w-4" /> Edit photos
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openReferralDetails(m)}>
                      <Receipt className="h-4 w-4" /> Referrals & payments
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => resetPassword(m)}>
                      <KeyRound className="h-4 w-4" /> Create reset link
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {banned ? (
                      <DropdownMenuItem onClick={() => moderate(m.id, "lift", name)}>
                        <ShieldCheck className="h-4 w-4" /> Lift suspension
                      </DropdownMenuItem>
                    ) : (
                      <>
                        <DropdownMenuItem onClick={() => moderate(m.id, "suspend7", name)}>
                          <Ban className="h-4 w-4" /> Suspend 7 days
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => moderate(m.id, "ban", name)}
                        >
                          <Ban className="h-4 w-4" /> Ban permanently
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            );
          })}
        </ul>
      )}
      <Dialog
        open={Boolean(editorMember)}
        onOpenChange={(open) => {
          if (!open) {
            setEditorMember(null);
            setEditorData(null);
            setEditorPhotos([]);
            setEditorAudit([]);
          }
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit full profile</DialogTitle>
          </DialogHeader>
          {editorLoading || !editorData ? (
            <PanelLoader />
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{editorData.profile.display_name ?? "Member"}</p>
                  <p className="text-xs text-muted-foreground">
                    Completion {editorData.profile.profile_completion_score}% ·{" "}
                    {editorData.profile.photo_count} photo
                    {editorData.profile.photo_count === 1 ? "" : "s"}
                  </p>
                  {editorData.profile.missing_fields.length > 0 && (
                    <div className="mt-2 rounded-xl border border-amber-300/60 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                      <p className="font-medium">
                        Missing fields: {editorData.profile.missing_fields.join(", ")}
                      </p>
                      {(editorData.profile.missing_fields.includes("Age 18+") ||
                        editorData.profile.missing_fields.includes("Gender")) && (
                        <p className="mt-1">Age and gender must be completed manually.</p>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={makeEditorDiscoverableIfComplete}
                    disabled={editorSaving || editorData.profile.missing_fields.length > 0}
                  >
                    <Eye className="h-4 w-4" />
                    Make discoverable if complete
                  </Button>
                  <Button onClick={saveFullProfile} disabled={editorSaving}>
                    {editorSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Save and recalculate
                  </Button>
                </div>
              </div>

              <Tabs defaultValue="basic" className="space-y-4">
                <TabsList className="flex h-auto flex-wrap justify-start">
                  <TabsTrigger value="basic">Basic info</TabsTrigger>
                  <TabsTrigger value="dating">Dating preferences</TabsTrigger>
                  <TabsTrigger value="location">Location</TabsTrigger>
                  <TabsTrigger value="photos">Photos</TabsTrigger>
                  <TabsTrigger value="visibility">Visibility & status</TabsTrigger>
                  <TabsTrigger value="audit">Audit history</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="grid gap-4 md:grid-cols-2">
                  <Field label="Display name">
                    <Input
                      value={editorData.profile.display_name ?? ""}
                      onChange={(e) => patchEditorProfile("display_name", e.target.value)}
                    />
                  </Field>
                  <Field label="Username">
                    <Input
                      value={editorData.profile.username ?? ""}
                      onChange={(e) => patchEditorProfile("username", e.target.value)}
                    />
                  </Field>
                  <Field label="Date of birth">
                    <Input
                      type="date"
                      value={editorData.profile.birth_date ?? ""}
                      onChange={(e) => patchEditorProfile("birth_date", e.target.value)}
                    />
                  </Field>
                  <Field label="Gender">
                    <Select
                      value={editorData.profile.gender ?? ""}
                      onValueChange={(value) => patchEditorProfile("gender", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        {GENDER_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Occupation">
                    <Input
                      value={editorData.profile.profession ?? ""}
                      onChange={(e) => patchEditorProfile("profession", e.target.value)}
                    />
                  </Field>
                  <Field label="Education">
                    <Select
                      value={editorData.profile.education ?? ""}
                      onValueChange={(value) => patchEditorProfile("education", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select education" />
                      </SelectTrigger>
                      <SelectContent>
                        {EDUCATION_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Bio" className="md:col-span-2">
                    <Textarea
                      rows={5}
                      value={editorData.profile.bio ?? ""}
                      onChange={(e) => patchEditorProfile("bio", e.target.value)}
                    />
                  </Field>
                </TabsContent>

                <TabsContent value="dating" className="grid gap-4 md:grid-cols-2">
                  <Field label="Interested in">
                    <Input
                      value={editorData.profile.interested_in.join(", ")}
                      onChange={(e) =>
                        patchEditorProfile("interested_in", commaList(e.target.value))
                      }
                      placeholder="men, women, everyone"
                    />
                    <p className="text-xs text-muted-foreground">
                      Common values: {INTERESTED_IN_OPTIONS.map((o) => o.value).join(", ")}
                    </p>
                  </Field>
                  <Field label="Relationship goal">
                    <Select
                      value={editorData.profile.relationship_goal ?? ""}
                      onValueChange={(value) => patchEditorProfile("relationship_goal", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select goal" />
                      </SelectTrigger>
                      <SelectContent>
                        {RELATIONSHIP_GOAL_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <AdminOptionSelect
                    label="Marriage intention"
                    value={editorData.profile.marriage_intention}
                    options={MARRIAGE_INTENTION_OPTIONS}
                    onChange={(value) => patchEditorProfile("marriage_intention", value)}
                  />
                  <AdminOptionSelect
                    label="Marriage timeline"
                    value={editorData.profile.marriage_timeline}
                    options={MARRIAGE_TIMELINE_OPTIONS}
                    onChange={(value) => patchEditorProfile("marriage_timeline", value)}
                  />
                  <AdminOptionSelect
                    label="Wants children"
                    value={editorData.profile.wants_children}
                    options={WANTS_CHILDREN_OPTIONS}
                    onChange={(value) => patchEditorProfile("wants_children", value)}
                  />
                  <AdminOptionSelect
                    label="Has children"
                    value={editorData.profile.has_children}
                    options={HAS_CHILDREN_OPTIONS}
                    onChange={(value) => patchEditorProfile("has_children", value)}
                  />
                  <AdminOptionSelect
                    label="Faith or values importance"
                    value={editorData.profile.faith_or_values_importance}
                    options={FAITH_VALUES_IMPORTANCE_OPTIONS}
                    onChange={(value) => patchEditorProfile("faith_or_values_importance", value)}
                  />
                  <AdminOptionSelect
                    label="Family values"
                    value={editorData.profile.family_values}
                    options={FAMILY_VALUES_OPTIONS}
                    onChange={(value) => patchEditorProfile("family_values", value)}
                  />
                  <AdminOptionSelect
                    label="Relocation openness"
                    value={editorData.profile.relocation_openness}
                    options={RELOCATION_OPENNESS_OPTIONS}
                    onChange={(value) => patchEditorProfile("relocation_openness", value)}
                  />
                  <AdminOptionSelect
                    label="Communication style"
                    value={editorData.profile.communication_style}
                    options={COMMUNICATION_STYLE_OPTIONS}
                    onChange={(value) => patchEditorProfile("communication_style", value)}
                  />
                  <AdminOptionSelect
                    label="Long-distance openness"
                    value={editorData.profile.long_distance_openness}
                    options={LONG_DISTANCE_OPENNESS_OPTIONS}
                    onChange={(value) => patchEditorProfile("long_distance_openness", value)}
                  />
                  <AdminOptionSelect
                    label="Conflict resolution"
                    value={editorData.profile.conflict_resolution_style}
                    options={CONFLICT_RESOLUTION_STYLE_OPTIONS}
                    onChange={(value) => patchEditorProfile("conflict_resolution_style", value)}
                  />
                  <AdminOptionSelect
                    label="Love language"
                    value={editorData.profile.love_language}
                    options={LOVE_LANGUAGE_OPTIONS}
                    onChange={(value) => patchEditorProfile("love_language", value)}
                  />
                  <AdminOptionSelect
                    label="Work-life balance"
                    value={editorData.profile.work_life_balance}
                    options={WORK_LIFE_BALANCE_OPTIONS}
                    onChange={(value) => patchEditorProfile("work_life_balance", value)}
                  />
                  <AdminOptionSelect
                    label="Education importance"
                    value={editorData.profile.education_importance}
                    options={EDUCATION_IMPORTANCE_OPTIONS}
                    onChange={(value) => patchEditorProfile("education_importance", value)}
                  />
                  <AdminOptionSelect
                    label="Faith importance"
                    value={editorData.profile.faith_importance}
                    options={FAITH_VALUES_IMPORTANCE_OPTIONS}
                    onChange={(value) => patchEditorProfile("faith_importance", value)}
                  />
                  <AdminOptionSelect
                    label="Culture background"
                    value={editorData.profile.culture_background}
                    options={CULTURE_BACKGROUND_OPTIONS}
                    onChange={(value) => patchEditorProfile("culture_background", value)}
                  />
                  <AdminOptionSelect
                    label="Personality"
                    value={editorData.profile.personality_type}
                    options={PERSONALITY_TYPE_OPTIONS}
                    onChange={(value) => patchEditorProfile("personality_type", value)}
                  />
                  <AdminOptionSelect
                    label="Partner expectations"
                    value={editorData.profile.partner_expectations}
                    options={PARTNER_EXPECTATIONS_OPTIONS}
                    onChange={(value) => patchEditorProfile("partner_expectations", value)}
                  />
                  <AdminOptionSelect
                    label="Future plans"
                    value={editorData.profile.future_plans}
                    options={FUTURE_PLANS_OPTIONS}
                    onChange={(value) => patchEditorProfile("future_plans", value)}
                  />
                  <Field label="Parenting preferences" className="md:col-span-2">
                    <Textarea
                      rows={3}
                      value={editorData.profile.parenting_preferences ?? ""}
                      onChange={(e) => patchEditorProfile("parenting_preferences", e.target.value)}
                    />
                  </Field>
                  <Field label="Dealbreakers" className="md:col-span-2">
                    <ChipSelect
                      options={DEALBREAKER_OPTIONS}
                      selected={editorData.profile.dealbreakers}
                      onToggle={(value) => {
                        const current = editorData.profile.dealbreakers;
                        patchEditorProfile(
                          "dealbreakers",
                          current.includes(value)
                            ? current.filter((item) => item !== value)
                            : [...current, value],
                        );
                      }}
                    />
                  </Field>
                  <Field label="Hobbies" className="md:col-span-2">
                    <ChipSelect
                      options={HOBBY_OPTIONS}
                      selected={editorData.profile.hobbies}
                      onToggle={(value) => {
                        const current = editorData.profile.hobbies;
                        patchEditorProfile(
                          "hobbies",
                          current.includes(value)
                            ? current.filter((item) => item !== value)
                            : [...current, value],
                        );
                      }}
                    />
                  </Field>
                  <Field label="Interests" className="md:col-span-2">
                    <Textarea
                      rows={4}
                      value={editorData.profile.interests.join(", ")}
                      onChange={(e) => patchEditorProfile("interests", commaList(e.target.value))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Examples: {INTEREST_OPTIONS.slice(0, 8).join(", ")}
                    </p>
                  </Field>
                </TabsContent>

                <TabsContent value="location" className="grid gap-4 md:grid-cols-2">
                  <Field label="City">
                    <Input
                      value={editorData.profile.location_city ?? ""}
                      onChange={(e) => patchEditorProfile("location_city", e.target.value)}
                    />
                  </Field>
                  <Field label="Country">
                    <Input
                      value={editorData.profile.location_country ?? ""}
                      onChange={(e) => patchEditorProfile("location_country", e.target.value)}
                    />
                  </Field>
                  <Field label="Location text" className="md:col-span-2">
                    <Input
                      value={editorData.profile.location_state ?? ""}
                      onChange={(e) => patchEditorProfile("location_state", e.target.value)}
                      placeholder="State, province, neighborhood, or display location"
                    />
                  </Field>
                </TabsContent>

                <TabsContent value="photos" className="space-y-4">
                  <div className="flex justify-end">
                    <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-border px-3 text-sm font-medium">
                      {uploadingPhoto ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      Add photo
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploadingPhoto}
                        onChange={(event) => {
                          void uploadEditorPhoto(event.target.files).finally(() => {
                            event.currentTarget.value = "";
                          });
                        }}
                      />
                    </label>
                  </div>
                  {editorPhotos.length === 0 ? (
                    <EmptyState>No profile photos.</EmptyState>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {editorPhotos.map((photo, index) => (
                        <div
                          key={photo.id}
                          className="overflow-hidden rounded-2xl border border-border"
                        >
                          <div className="relative aspect-[3/4] bg-muted">
                            <ProfilePhoto
                              path={photo.storage_path || photo.url}
                              alt="Member photo"
                              rounded="rounded-none"
                            />
                            <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                              {photo.is_primary && <Badge>Main</Badge>}
                              <Badge
                                variant={
                                  photo.moderation_status === "approved" ? "default" : "outline"
                                }
                              >
                                {photo.moderation_status}
                              </Badge>
                              {photo.is_private && <Badge variant="outline">Private</Badge>}
                            </div>
                          </div>
                          <div className="space-y-2 p-3">
                            <div className="flex flex-wrap gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => moveEditorPhoto(photo, -1)}
                                disabled={index === 0}
                              >
                                Up
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => moveEditorPhoto(photo, 1)}
                                disabled={index === editorPhotos.length - 1}
                              >
                                Down
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateEditorPhoto(photo, "primary")}
                              >
                                Main
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateEditorPhoto(photo, "approve")}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateEditorPhoto(photo, "reject")}
                              >
                                Reject
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  updateEditorPhoto(photo, photo.is_private ? "public" : "private")
                                }
                              >
                                {photo.is_private ? "Public" : "Private"}
                              </Button>
                              <label className="inline-flex h-8 cursor-pointer items-center rounded-md border border-border px-3 text-xs font-medium">
                                Replace
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(event) => {
                                    void replaceEditorPhoto(photo, event.target.files).finally(
                                      () => {
                                        event.currentTarget.value = "";
                                      },
                                    );
                                  }}
                                />
                              </label>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive"
                                onClick={() => deleteEditorPhoto(photo)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="visibility" className="grid gap-4 md:grid-cols-2">
                  <ToggleField
                    label="Verified"
                    checked={editorData.profile.is_verified}
                    onChange={(value) => patchEditorProfile("is_verified", value)}
                  />
                  <ToggleField
                    label="Active"
                    checked={editorData.profile.is_active}
                    onChange={(value) => patchEditorProfile("is_active", value)}
                  />
                  <ToggleField
                    label="Discoverable"
                    checked={editorData.profile.is_discoverable}
                    onChange={(value) => patchEditorProfile("is_discoverable", value)}
                  />
                  <ToggleField
                    label="Featured profile"
                    checked={editorData.profile.is_featured}
                    onChange={(value) => patchEditorProfile("is_featured", value)}
                  />
                  <ToggleField
                    label="Safety agreement"
                    checked={Boolean(editorData.profile.safety_agreement_accepted_at)}
                    onChange={(value) =>
                      patchEditorProfile(
                        "safety_agreement_accepted_at",
                        value ? new Date().toISOString() : null,
                      )
                    }
                  />
                  <ToggleField
                    label="Terms/privacy agreement"
                    checked={Boolean(
                      editorData.profile.terms_accepted_at &&
                      editorData.profile.privacy_accepted_at,
                    )}
                    onChange={(value) => {
                      const timestamp = value ? new Date().toISOString() : null;
                      patchEditorProfile("terms_accepted_at", timestamp);
                      patchEditorProfile("privacy_accepted_at", timestamp);
                    }}
                  />
                  <Field label="Membership tier">
                    <Select
                      value={editorData.profile.membership_tier}
                      onValueChange={(value) =>
                        patchEditorProfile("membership_tier", value as MembershipTier)
                      }
                    >
                      <SelectTrigger>
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
                  <Field label="Profile completion status">
                    <Select
                      value={editorData.profile.profile_completion_status}
                      onValueChange={(value) =>
                        patchEditorProfile("profile_completion_status", value as RealProfileStatus)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="complete">Complete</SelectItem>
                        <SelectItem value="incomplete">Incomplete</SelectItem>
                        <SelectItem value="not_discoverable">Not discoverable</SelectItem>
                        <SelectItem value="missing_required_fields">
                          Missing required fields
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </TabsContent>

                <TabsContent value="audit" className="space-y-2">
                  {editorAudit.length === 0 ? (
                    <EmptyState>No admin profile edits recorded yet.</EmptyState>
                  ) : (
                    <ul className="max-h-[55vh] space-y-2 overflow-y-auto">
                      {editorAudit.map((row) => {
                        const details = row.details as {
                          field?: string;
                          old_value?: unknown;
                          new_value?: unknown;
                        };
                        return (
                          <li key={row.id} className="rounded-2xl border border-border p-3 text-sm">
                            <div className="flex flex-wrap justify-between gap-2">
                              <span className="font-medium">
                                {details.field ?? row.action.replaceAll("_", " ")}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(row.created_at).toLocaleString()}
                              </span>
                            </div>
                            <p className="mt-1 break-words text-xs text-muted-foreground">
                              Old: {formatAuditValue(details.old_value)} · New:{" "}
                              {formatAuditValue(details.new_value)}
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(historyMember)}
        onOpenChange={(open) => !open && setHistoryMember(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Login history</DialogTitle>
          </DialogHeader>
          {historyLoading ? (
            <PanelLoader />
          ) : loginHistory.length === 0 ? (
            <EmptyState>No login activity has been recorded.</EmptyState>
          ) : (
            <ul className="space-y-2">
              {loginHistory.map((row) => (
                <li key={row.id} className="rounded-2xl border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 text-sm font-medium">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      {new Date(row.created_at).toLocaleString()}
                    </span>
                    <Badge variant={row.success === false ? "destructive" : "outline"}>
                      {row.event_type.replaceAll("_", " ")}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.failure_reason ? `${row.failure_reason} - ` : ""}
                    {row.ip_address ?? "IP not recorded"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(photoMember)} onOpenChange={(open) => !open && setPhotoMember(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Edit member photos</DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {photoMember?.display_name ?? "Member"} · {memberPhotos.length}/6 photos
            </p>
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-border px-3 text-sm font-medium">
              {uploadingPhoto ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Add photo
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploadingPhoto}
                onChange={(event) => {
                  void uploadMemberPhoto(event.target.files).finally(() => {
                    event.currentTarget.value = "";
                  });
                }}
              />
            </label>
          </div>
          {photoLoading ? (
            <PanelLoader />
          ) : memberPhotos.length === 0 ? (
            <EmptyState>No profile photos.</EmptyState>
          ) : (
            <div className="grid max-h-[65vh] gap-3 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
              {memberPhotos.map((photo, index) => (
                <div key={photo.id} className="overflow-hidden rounded-2xl border border-border">
                  <div className="relative aspect-[3/4] bg-muted">
                    <ProfilePhoto
                      path={photo.storage_path || photo.url}
                      alt="Member photo"
                      rounded="rounded-none"
                    />
                    <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                      {photo.is_primary && <Badge>Main</Badge>}
                      <Badge
                        variant={photo.moderation_status === "approved" ? "default" : "outline"}
                      >
                        {photo.moderation_status}
                      </Badge>
                      {photo.is_private && <Badge variant="outline">Private</Badge>}
                    </div>
                  </div>
                  <div className="space-y-2 p-3 text-xs text-muted-foreground">
                    <p>Uploaded {new Date(photo.created_at).toLocaleString()}</p>
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => movePhoto(photo, -1)}
                        disabled={index === 0}
                      >
                        Up
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => movePhoto(photo, 1)}
                        disabled={index === memberPhotos.length - 1}
                      >
                        Down
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updatePhoto(photo, "primary")}
                      >
                        Main
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updatePhoto(photo, "approve")}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updatePhoto(photo, "reject")}
                      >
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updatePhoto(photo, photo.is_private ? "public" : "private")}
                      >
                        {photo.is_private ? "Public" : "Private"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updatePhoto(photo, "replace-url")}
                      >
                        Replace URL
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive"
                        onClick={() => deletePhoto(photo)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(referralMember)}
        onOpenChange={(open) => !open && setReferralMember(null)}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Referrals and payments</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <section>
              <h4 className="font-medium">Referral attribution</h4>
              {memberDetails.referrals.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No referral attribution.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {memberDetails.referrals.map((row) => (
                    <div key={row.id} className="rounded-xl border border-border p-3 text-sm">
                      <p className="font-medium">{row.marketer?.full_name ?? "Marketer"}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.referral_code} · {row.status} ·{" "}
                        {new Date(row.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section>
              <h4 className="font-medium">Payments</h4>
              {memberDetails.payments.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No payments.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {memberDetails.payments.map((row) => (
                    <div key={row.id} className="rounded-xl border border-border p-3 text-sm">
                      <p className="font-medium">{row.description ?? "Payment"}</p>
                      <p className="text-xs text-muted-foreground">
                        {(row.amount_cents / 100).toFixed(2)} {row.currency} · {row.status}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function adminErrorMessage(error: unknown, fallback: string, userId?: string) {
  const anyError = error as
    | (Partial<AdminActionResult> & {
        message?: string;
        dbError?: { message?: string; code?: string; details?: string; hint?: string };
        failingQuery?: string;
        query?: string;
      })
    | null
    | undefined;
  const dbError = anyError?.dbError;
  const parts = [
    anyError?.error ?? anyError?.message ?? dbError?.message ?? fallback,
    anyError?.stage ? `Stage: ${anyError.stage}` : null,
    anyError?.userId || userId ? `User: ${anyError?.userId ?? userId}` : null,
    anyError?.failingQuery || anyError?.query
      ? `Query: ${anyError.failingQuery ?? anyError.query}`
      : null,
    dbError?.code ? `Code: ${dbError.code}` : null,
    dbError?.details ? `Details: ${dbError.details}` : null,
    dbError?.hint ? `Hint: ${dbError.hint}` : null,
  ].filter(Boolean);
  return import.meta.env.DEV ? parts.join(" | ") : fallback;
}

function commaList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatAuditValue(value: unknown) {
  if (Array.isArray(value)) return value.join(", ") || "empty";
  if (value == null || value === "") return "empty";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function OptionCheckbox({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-xl border border-border p-3 text-sm">
      <Checkbox checked={checked} onCheckedChange={(value) => onCheckedChange(value === true)} />
      <span>{label}</span>
    </label>
  );
}

function AdminOptionSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <Select value={value ?? ""} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Label className="flex items-center justify-between rounded-xl border border-border p-3">
      <span className="text-sm font-medium">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </Label>
  );
}

function MetricBadge({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-full border border-border bg-card px-3 py-1 text-muted-foreground">
      <span className="font-semibold text-foreground">{value.toLocaleString()}</span> {label}
    </span>
  );
}

function MetricMini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function profileStatusLabel(status: RealProfileStatus): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
} {
  if (status === "complete") return { label: "complete", variant: "default" };
  if (status === "not_discoverable") return { label: "not discoverable", variant: "outline" };
  if (status === "missing_required_fields") {
    return { label: "missing required fields", variant: "destructive" };
  }
  return { label: "incomplete", variant: "secondary" };
}
