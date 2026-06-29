import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, Save, Sparkles, MapPin, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { useGeolocation } from "@/hooks/useGeolocation";
import { AppShell } from "@/components/AppShell";
import { ConnectionStrength } from "@/components/ConnectionStrength";
import { PhotoManager } from "@/components/PhotoManager";
import { ChipSelect, InterestChips } from "@/components/ChipSelect";
import { TierBadge, VerifiedBadge } from "@/components/TierBadge";
import {
  GENDER_OPTIONS,
  INTERESTED_IN_OPTIONS,
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
import { INTEREST_OPTIONS, TIER_LABELS } from "@/lib/membership";
import { normalizeGender } from "@/lib/gender";
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
  SERIOUS_PRIVACY_OPTIONS,
  type SeriousRelationshipField,
  type SeriousVisibilitySettings,
  WANTS_CHILDREN_OPTIONS,
  WORK_LIFE_BALANCE_OPTIONS,
} from "@/lib/serious-relationship";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/profile/")({
  head: () => ({ meta: [{ title: "My Profile — HeartConnect" }] }),
  component: () => (
    <AppShell>
      <MyProfile />
    </AppShell>
  ),
});

function MyProfile() {
  const { user, profile, loading, profileError, refreshProfile } = useAuth();
  const { detect, detecting } = useGeolocation();

  const [displayName, setDisplayName] = useState("");
  const [gender, setGender] = useState<string[]>([]);
  const [interestedIn, setInterestedIn] = useState<string[]>([]);
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [bio, setBio] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [religion, setReligion] = useState<string>("");
  const [education, setEducation] = useState<string>("");
  const [relationshipGoal, setRelationshipGoal] = useState<string>("");
  const [profession, setProfession] = useState<string>("");
  const [smoking, setSmoking] = useState<string>("");
  const [drinking, setDrinking] = useState<string>("");
  const [workout, setWorkout] = useState<string>("");
  const [familyPlans, setFamilyPlans] = useState<string>("");
  const [pets, setPets] = useState<string>("");
  const [marriageIntention, setMarriageIntention] = useState("");
  const [marriageTimeline, setMarriageTimeline] = useState("");
  const [wantsChildren, setWantsChildren] = useState("");
  const [hasChildren, setHasChildren] = useState("");
  const [faithValuesImportance, setFaithValuesImportance] = useState("");
  const [familyValues, setFamilyValues] = useState("");
  const [relocationOpenness, setRelocationOpenness] = useState("");
  const [communicationStyle, setCommunicationStyle] = useState("");
  const [dealbreakers, setDealbreakers] = useState<string[]>([]);
  const [longDistanceOpenness, setLongDistanceOpenness] = useState("");
  const [parentingPreferences, setParentingPreferences] = useState("");
  const [conflictResolutionStyle, setConflictResolutionStyle] = useState("");
  const [loveLanguage, setLoveLanguage] = useState("");
  const [workLifeBalance, setWorkLifeBalance] = useState("");
  const [educationImportance, setEducationImportance] = useState("");
  const [faithImportance, setFaithImportance] = useState("");
  const [cultureBackground, setCultureBackground] = useState("");
  const [personalityType, setPersonalityType] = useState("");
  const [hobbies, setHobbies] = useState<string[]>([]);
  const [partnerExpectations, setPartnerExpectations] = useState("");
  const [futurePlans, setFuturePlans] = useState("");
  const [seriousVisibility, setSeriousVisibility] = useState<SeriousVisibilitySettings>({});
  const [locationHidden, setLocationHidden] = useState(false);
  const [photoCount, setPhotoCount] = useState<number | undefined>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? "");
      const normalizedGender = normalizeGender(profile.gender);
      setGender(normalizedGender ? [normalizedGender] : []);
      setInterestedIn(profile.interested_in ?? []);
      setCity(profile.location_city ?? "");
      setCountry(profile.location_country ?? "");
      setBio(profile.bio ?? "");
      setInterests(profile.interests ?? []);
      setLanguages(profile.languages ?? []);
      setReligion(profile.religion ?? "");
      setEducation(profile.education ?? "");
      setRelationshipGoal(profile.relationship_goal ?? "");
      setProfession(profile.profession ?? "");
      setSmoking(profile.smoking ?? "");
      setDrinking(profile.drinking ?? "");
      setWorkout(profile.workout ?? "");
      setFamilyPlans(profile.family_plans ?? "");
      setPets(profile.pets ?? "");
      setMarriageIntention(profile.marriage_intention ?? "");
      setMarriageTimeline(profile.marriage_timeline ?? "");
      setWantsChildren(profile.wants_children ?? "");
      setHasChildren(profile.has_children ?? "");
      setFaithValuesImportance(profile.faith_or_values_importance ?? "");
      setFamilyValues(profile.family_values ?? "");
      setRelocationOpenness(profile.relocation_openness ?? "");
      setCommunicationStyle(profile.communication_style ?? "");
      setDealbreakers(profile.dealbreakers ?? []);
      setLongDistanceOpenness(profile.long_distance_openness ?? "");
      setParentingPreferences(profile.parenting_preferences ?? "");
      setConflictResolutionStyle(profile.conflict_resolution_style ?? "");
      setLoveLanguage(profile.love_language ?? "");
      setWorkLifeBalance(profile.work_life_balance ?? "");
      setEducationImportance(profile.education_importance ?? "");
      setFaithImportance(profile.faith_importance ?? "");
      setCultureBackground(profile.culture_background ?? "");
      setPersonalityType(profile.personality_type ?? "");
      setHobbies(profile.hobbies ?? []);
      setPartnerExpectations(profile.partner_expectations ?? "");
      setFuturePlans(profile.future_plans ?? "");
      setSeriousVisibility(
        typeof profile.serious_profile_visibility === "object" && profile.serious_profile_visibility
          ? (profile.serious_profile_visibility as SeriousVisibilitySettings)
          : {},
      );
      setLocationHidden(profile.location_hidden ?? false);
    }
  }, [profile]);

  const toggle = (arr: string[], set: (v: string[]) => void, value: string, single = false) => {
    if (single) set(arr.includes(value) ? [] : [value]);
    else set(arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]);
  };

  const tierLabel = useMemo(
    () => (profile ? TIER_LABELS[profile.membership_tier] : "Free"),
    [profile],
  );

  const locationSuspended = profile?.location_access_suspended ?? false;
  const hasCoords = profile?.latitude != null;
  const setVisibility = (
    field: SeriousRelationshipField,
    visibility: "public" | "matches" | "private",
  ) => {
    setSeriousVisibility((current) => ({ ...current, [field]: visibility }));
  };

  const save = async () => {
    if (!user) return;
    if (displayName.trim().length < 2) {
      toast.error("Add your display name");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim(),
          gender: gender[0] ?? null,
          interested_in: interestedIn,
          location_city: city.trim() || null,
          location_country: country.trim() || null,
          bio: bio.trim() || null,
          interests,
          languages,
          religion: religion || null,
          education: education || null,
          relationship_goal: relationshipGoal || null,
          profession: profession || null,
          smoking: smoking || null,
          drinking: drinking || null,
          workout: workout || null,
          family_plans: familyPlans || null,
          pets: pets || null,
          marriage_intention: marriageIntention || null,
          marriage_timeline: marriageTimeline || null,
          wants_children: wantsChildren || null,
          has_children: hasChildren || null,
          faith_or_values_importance: faithValuesImportance || null,
          family_values: familyValues || null,
          relocation_openness: relocationOpenness || null,
          communication_style: communicationStyle || null,
          dealbreakers,
          long_distance_openness: longDistanceOpenness || null,
          parenting_preferences: parentingPreferences.trim() || null,
          conflict_resolution_style: conflictResolutionStyle || null,
          love_language: loveLanguage || null,
          work_life_balance: workLifeBalance || null,
          education_importance: educationImportance || null,
          faith_importance: faithImportance || null,
          culture_background: cultureBackground || null,
          personality_type: personalityType || null,
          hobbies,
          partner_expectations: partnerExpectations || null,
          future_plans: futurePlans || null,
          serious_profile_visibility: seriousVisibility as Json,
          location_hidden: locationHidden,
        })
        .eq("id", user.id);
      if (error) throw error;
      await refreshProfile();
      toast.success("Profile updated");
    } catch {
      toast.error("Could not save changes.");
    } finally {
      setSaving(false);
    }
  };

  // Still resolving the session/profile on first load.
  if (loading) {
    return (
      <div className="grid h-[50vh] place-items-center" role="status" aria-live="polite">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="sr-only">Loading your profile…</span>
      </div>
    );
  }

  // Session resolved but the profile could not be loaded or created.
  if (!user || profileError || !profile) {
    return (
      <div className="mx-auto grid h-[50vh] max-w-md place-items-center px-4 text-center">
        <div>
          <h1 className="font-display text-xl font-semibold">We couldn't load your profile</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {profileError
              ? "Something went wrong while loading your profile. Please try again."
              : "Your profile isn't set up yet. Let's finish creating it."}
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <Button variant="outline" className="rounded-full" onClick={() => refreshProfile()}>
              Try again
            </Button>
            <Button asChild variant="hero" className="rounded-full">
              <Link to="/onboarding">Complete setup</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-2xl font-semibold">My Profile</h1>
          {profile.is_verified && <VerifiedBadge />}
        </div>
        <Link
          to="/premium"
          search={{ plan: undefined, period: undefined }}
          className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:border-primary"
        >
          <span className="text-muted-foreground">Plan:</span>
          {profile.membership_tier === "free" ? (
            <span className="font-semibold">{tierLabel}</span>
          ) : (
            <TierBadge tier={profile.membership_tier} />
          )}
        </Link>
      </div>

      {profile.membership_tier === "free" && (
        <Link
          to="/premium"
          search={{ plan: undefined, period: undefined }}
          className="mb-6 flex items-center gap-3 rounded-2xl bg-gradient-warm p-4 transition-shadow hover:shadow-soft"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-gold text-gold-foreground">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold">Upgrade your experience</p>
            <p className="text-sm text-muted-foreground">
              Unlimited likes, see who likes you, and more.
            </p>
          </div>
        </Link>
      )}

      <ConnectionStrength
        profile={profile}
        userId={user.id}
        photoCount={photoCount}
        className="mb-6"
      />

      <Tabs defaultValue="photos">
        <TabsList className="rounded-full">
          <TabsTrigger value="photos" className="rounded-full">
            Photos
          </TabsTrigger>
          <TabsTrigger value="details" className="rounded-full">
            Details
          </TabsTrigger>
        </TabsList>

        <TabsContent value="photos" className="mt-5">
          <div className="rounded-3xl border border-border bg-card p-5">
            <h2 className="mb-1 font-semibold">Your photos</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Add up to 6 photos. Tap the star to set your main photo.
            </p>
            <PhotoManager userId={user.id} onChange={setPhotoCount} />
          </div>
        </TabsContent>

        <TabsContent value="details" className="mt-5">
          <div className="space-y-6 rounded-3xl border border-border bg-card p-5">
            <div className="space-y-2">
              <Label htmlFor="name">Display name</Label>
              <Input
                id="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="rounded-xl"
                maxLength={40}
              />
            </div>

            <div>
              <Label className="mb-2 block">I am a</Label>
              <ChipSelect
                options={GENDER_OPTIONS}
                selected={gender}
                onToggle={(v) => toggle(gender, setGender, v, true)}
              />
            </div>

            <div>
              <Label className="mb-2 block">I'd like to meet</Label>
              <ChipSelect
                options={INTERESTED_IN_OPTIONS}
                selected={interestedIn}
                onToggle={(v) => toggle(interestedIn, setInterestedIn, v)}
              />
            </div>

            <div className="space-y-3 rounded-2xl border border-border bg-muted/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 font-medium">
                    <MapPin className="h-4 w-4 text-primary" /> Location
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {locationSuspended
                      ? "Location access is disabled for your account."
                      : hasCoords
                        ? "Used to show distance to nearby members."
                        : "Detect your location to appear in nearby searches."}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => detect()}
                  disabled={detecting || locationSuspended}
                >
                  {detecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MapPin className="h-4 w-4" />
                  )}
                  {hasCoords ? "Update" : "Detect"}
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-background px-3 py-2.5">
                <Label
                  htmlFor="hide-loc"
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                  Hide exact location (still show city &amp; distance)
                </Label>
                <Switch
                  id="hide-loc"
                  checked={locationHidden}
                  onCheckedChange={setLocationHidden}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="min-h-28 rounded-xl"
                maxLength={500}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <DetailSelect
                label="Looking for"
                value={relationshipGoal}
                onChange={setRelationshipGoal}
                options={RELATIONSHIP_GOAL_OPTIONS}
              />
              <DetailSelect
                label="Profession"
                value={profession}
                onChange={setProfession}
                options={PROFESSION_OPTIONS}
              />
              <DetailSelect
                label="Religion"
                value={religion}
                onChange={setReligion}
                options={RELIGION_OPTIONS}
              />
              <DetailSelect
                label="Education"
                value={education}
                onChange={setEducation}
                options={EDUCATION_OPTIONS}
              />
              <DetailSelect
                label="Smoking"
                value={smoking}
                onChange={setSmoking}
                options={SMOKING_OPTIONS}
              />
              <DetailSelect
                label="Drinking"
                value={drinking}
                onChange={setDrinking}
                options={DRINKING_OPTIONS}
              />
              <DetailSelect
                label="Workout"
                value={workout}
                onChange={setWorkout}
                options={WORKOUT_OPTIONS}
              />
              <DetailSelect
                label="Family plans"
                value={familyPlans}
                onChange={setFamilyPlans}
                options={FAMILY_PLANS_OPTIONS}
              />
              <DetailSelect label="Pets" value={pets} onChange={setPets} options={PETS_OPTIONS} />
            </div>

            <div>
              <Label className="mb-2 block">Languages</Label>
              <ChipSelect
                options={LANGUAGE_OPTIONS.map((l) => ({ value: l, label: l }))}
                selected={languages}
                onToggle={(v) => toggle(languages, setLanguages, v)}
              />
            </div>

            <div className="rounded-2xl border border-border bg-muted/20 p-4">
              <h2 className="mb-4 font-semibold">Serious relationship intentions</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailSelect
                  label="Marriage intention"
                  value={marriageIntention}
                  onChange={setMarriageIntention}
                  options={MARRIAGE_INTENTION_OPTIONS}
                />
                <DetailSelect
                  label="Marriage timeline"
                  value={marriageTimeline}
                  onChange={setMarriageTimeline}
                  options={MARRIAGE_TIMELINE_OPTIONS}
                />
                <DetailSelect
                  label="Want children"
                  value={wantsChildren}
                  onChange={setWantsChildren}
                  options={WANTS_CHILDREN_OPTIONS}
                />
                <DetailSelect
                  label="Have children"
                  value={hasChildren}
                  onChange={setHasChildren}
                  options={HAS_CHILDREN_OPTIONS}
                />
                <DetailSelect
                  label="Faith or values importance"
                  value={faithValuesImportance}
                  onChange={setFaithValuesImportance}
                  options={FAITH_VALUES_IMPORTANCE_OPTIONS}
                />
                <DetailSelect
                  label="Family values"
                  value={familyValues}
                  onChange={setFamilyValues}
                  options={FAMILY_VALUES_OPTIONS}
                />
                <DetailSelect
                  label="Relocation openness"
                  value={relocationOpenness}
                  onChange={setRelocationOpenness}
                  options={RELOCATION_OPENNESS_OPTIONS}
                />
                <DetailSelect
                  label="Communication style"
                  value={communicationStyle}
                  onChange={setCommunicationStyle}
                  options={COMMUNICATION_STYLE_OPTIONS}
                />
                <DetailSelect
                  label="Long-distance openness"
                  value={longDistanceOpenness}
                  onChange={setLongDistanceOpenness}
                  options={LONG_DISTANCE_OPENNESS_OPTIONS}
                />
                <DetailSelect
                  label="Conflict resolution"
                  value={conflictResolutionStyle}
                  onChange={setConflictResolutionStyle}
                  options={CONFLICT_RESOLUTION_STYLE_OPTIONS}
                />
                <DetailSelect
                  label="Love language"
                  value={loveLanguage}
                  onChange={setLoveLanguage}
                  options={LOVE_LANGUAGE_OPTIONS}
                />
                <DetailSelect
                  label="Work-life balance"
                  value={workLifeBalance}
                  onChange={setWorkLifeBalance}
                  options={WORK_LIFE_BALANCE_OPTIONS}
                />
                <DetailSelect
                  label="Education importance"
                  value={educationImportance}
                  onChange={setEducationImportance}
                  options={EDUCATION_IMPORTANCE_OPTIONS}
                />
                <DetailSelect
                  label="Faith importance"
                  value={faithImportance}
                  onChange={setFaithImportance}
                  options={FAITH_VALUES_IMPORTANCE_OPTIONS}
                />
                <DetailSelect
                  label="Culture background"
                  value={cultureBackground}
                  onChange={setCultureBackground}
                  options={CULTURE_BACKGROUND_OPTIONS}
                />
                <DetailSelect
                  label="Personality"
                  value={personalityType}
                  onChange={setPersonalityType}
                  options={PERSONALITY_TYPE_OPTIONS}
                />
                <DetailSelect
                  label="Partner expectations"
                  value={partnerExpectations}
                  onChange={setPartnerExpectations}
                  options={PARTNER_EXPECTATIONS_OPTIONS}
                />
                <DetailSelect
                  label="Future plans"
                  value={futurePlans}
                  onChange={setFuturePlans}
                  options={FUTURE_PLANS_OPTIONS}
                />
              </div>
              <div className="mt-4 space-y-2">
                <Label htmlFor="parenting-preferences">Parenting preferences</Label>
                <Textarea
                  id="parenting-preferences"
                  value={parentingPreferences}
                  onChange={(e) => setParentingPreferences(e.target.value)}
                  className="min-h-20 rounded-xl"
                  maxLength={300}
                />
              </div>
              <div className="mt-4">
                <Label className="mb-2 block">Dealbreakers</Label>
                <ChipSelect
                  options={DEALBREAKER_OPTIONS}
                  selected={dealbreakers}
                  onToggle={(value) => toggle(dealbreakers, setDealbreakers, value)}
                />
              </div>
              <div className="mt-4">
                <Label className="mb-2 block">Hobbies</Label>
                <ChipSelect
                  options={HOBBY_OPTIONS}
                  selected={hobbies}
                  onToggle={(value) => toggle(hobbies, setHobbies, value)}
                />
              </div>
              <div className="mt-5 rounded-2xl border border-border bg-background p-4">
                <h3 className="font-medium">Privacy for serious relationship fields</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose whether these answers are public, visible to matches only, or private.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <PrivacySelect
                    field="marriage_intention"
                    label="Marriage intention"
                    value={seriousVisibility.marriage_intention ?? "public"}
                    onChange={setVisibility}
                  />
                  <PrivacySelect
                    field="marriage_timeline"
                    label="Marriage timeline"
                    value={seriousVisibility.marriage_timeline ?? "public"}
                    onChange={setVisibility}
                  />
                  <PrivacySelect
                    field="wants_children"
                    label="Children preference"
                    value={seriousVisibility.wants_children ?? "public"}
                    onChange={setVisibility}
                  />
                  <PrivacySelect
                    field="faith_importance"
                    label="Faith importance"
                    value={seriousVisibility.faith_importance ?? "public"}
                    onChange={setVisibility}
                  />
                  <PrivacySelect
                    field="dealbreakers"
                    label="Dealbreakers"
                    value={seriousVisibility.dealbreakers ?? "matches"}
                    onChange={setVisibility}
                  />
                  <PrivacySelect
                    field="partner_expectations"
                    label="Partner expectations"
                    value={seriousVisibility.partner_expectations ?? "matches"}
                    onChange={setVisibility}
                  />
                </div>
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Interests</Label>
              <InterestChips
                options={INTEREST_OPTIONS}
                selected={interests}
                onToggle={(v) => toggle(interests, setInterests, v)}
                max={10}
              />
            </div>

            <Button variant="hero" className="w-full rounded-xl" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save changes
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

const NONE = "__none__";

function DetailSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly { value: string; label: string }[];
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
        <SelectTrigger className="rounded-xl">
          <SelectValue placeholder="Not specified" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Not specified</SelectItem>
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

function PrivacySelect({
  field,
  label,
  value,
  onChange,
}: {
  field: SeriousRelationshipField;
  label: string;
  value: "public" | "matches" | "private";
  onChange: (field: SeriousRelationshipField, value: "public" | "matches" | "private") => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select
        value={value}
        onValueChange={(v) => onChange(field, v as "public" | "matches" | "private")}
      >
        <SelectTrigger className="rounded-xl">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SERIOUS_PRIVACY_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
