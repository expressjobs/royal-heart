import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  BadgeCheck,
  Camera,
  CheckCircle2,
  Heart,
  Loader2,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useGeolocation } from "@/hooks/useGeolocation";
import { ensureUserSetup } from "@/lib/auth-setup";
import {
  isAtLeast18,
  maxAdultBirthDate,
  missingDiscoveryRequirements,
  profileCompletion,
} from "@/lib/registration";
import { Logo } from "@/components/Logo";
import { ConnectionStrength } from "@/components/ConnectionStrength";
import { PhotoManager } from "@/components/PhotoManager";
import { ChipSelect, InterestChips } from "@/components/ChipSelect";
import {
  DRINKING_OPTIONS,
  FAMILY_PLANS_OPTIONS,
  GENDER_OPTIONS,
  INTERESTED_IN_OPTIONS,
  LANGUAGE_OPTIONS,
  PETS_OPTIONS,
  PROFESSION_OPTIONS,
  RELATIONSHIP_GOAL_OPTIONS,
  SMOKING_OPTIONS,
  WORKOUT_OPTIONS,
} from "@/lib/constants";
import { INTEREST_OPTIONS } from "@/lib/membership";
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
  WANTS_CHILDREN_OPTIONS,
  WORK_LIFE_BALANCE_OPTIONS,
} from "@/lib/serious-relationship";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type OnboardingProfile = NonNullable<ReturnType<typeof useAuth>["profile"]> & {
  age_attested_at?: string | null;
  discovery_blocked_reason?: string | null;
  phone_country_code?: string | null;
  phone_number?: string | null;
  privacy_accepted_at?: string | null;
  safety_agreement_accepted_at?: string | null;
  terms_accepted_at?: string | null;
};

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Set up your profile - HeartConnect" }] }),
  component: Onboarding,
});

const requiredSchema = z.object({
  display_name: z.string().trim().min(2, "Add your name").max(40),
  birth_date: z
    .string()
    .min(1, "Add your birth date")
    .refine(isAtLeast18, "You must be at least 18 years old to use HeartConnect"),
  gender: z.string().min(1, "Select your gender"),
});

const STEPS = [
  "Basics",
  "Match",
  "Location",
  "Photos",
  "About",
  "Lifestyle",
  "Commitment",
  "Safety",
  "Finish",
] as const;

function Onboarding() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const geo = useGeolocation();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState<string[]>([]);
  const [interestedIn, setInterestedIn] = useState<string[]>([]);
  const [relationshipGoal, setRelationshipGoal] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [locationHidden, setLocationHidden] = useState(false);
  const [photoCount, setPhotoCount] = useState(0);
  const [bio, setBio] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [profession, setProfession] = useState("");
  const [smoking, setSmoking] = useState("");
  const [drinking, setDrinking] = useState("");
  const [workout, setWorkout] = useState("");
  const [familyPlans, setFamilyPlans] = useState("");
  const [pets, setPets] = useState("");
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
  const [safetyAccepted, setSafetyAccepted] = useState(false);
  const [saving, setSaving] = useState(false);

  const maxDate = useMemo(maxAdultBirthDate, []);
  const onboardingProfile = profile as OnboardingProfile | null;
  const strengthProfile = profile
    ? {
        ...profile,
        bio,
        interests,
        languages,
        profession,
        smoking,
        drinking,
        workout,
        family_plans: familyPlans,
        pets,
        relationship_goal: relationshipGoal,
        location_city: city,
        location_country: country,
        safety_agreement_accepted_at: safetyAccepted
          ? (onboardingProfile?.safety_agreement_accepted_at ?? new Date().toISOString())
          : null,
      }
    : null;
  const completion = profileCompletion({
    display_name: displayName,
    birth_date: birthDate,
    gender: gender[0],
    interested_in: interestedIn,
    relationship_goal: relationshipGoal,
    location_city: city,
    location_country: country,
    safety_agreement_accepted_at: safetyAccepted ? new Date().toISOString() : null,
    terms_accepted_at: onboardingProfile?.terms_accepted_at ?? new Date().toISOString(),
    privacy_accepted_at: onboardingProfile?.privacy_accepted_at ?? new Date().toISOString(),
    photoCount,
    bio,
    interests,
    marriage_intention: marriageIntention,
    marriage_timeline: marriageTimeline,
    wants_children: wantsChildren,
    has_children: hasChildren,
    faith_or_values_importance: faithValuesImportance,
    family_values: familyValues,
    relocation_openness: relocationOpenness,
    communication_style: communicationStyle,
    dealbreakers,
    long_distance_openness: longDistanceOpenness,
    parenting_preferences: parentingPreferences,
    conflict_resolution_style: conflictResolutionStyle,
    love_language: loveLanguage,
    work_life_balance: workLifeBalance,
    education_importance: educationImportance,
    faith_importance: faithImportance,
    culture_background: cultureBackground,
    personality_type: personalityType,
    hobbies,
    partner_expectations: partnerExpectations,
    future_plans: futurePlans,
  });
  const missing = missingDiscoveryRequirements({
    display_name: displayName,
    birth_date: birthDate,
    gender: gender[0],
    interested_in: interestedIn,
    relationship_goal: relationshipGoal,
    location_city: city,
    location_country: country,
    safety_agreement_accepted_at: safetyAccepted ? new Date().toISOString() : null,
    terms_accepted_at: onboardingProfile?.terms_accepted_at ?? new Date().toISOString(),
    privacy_accepted_at: onboardingProfile?.privacy_accepted_at ?? new Date().toISOString(),
    photoCount,
  });
  useEffect(() => {
    if (user) ensureUserSetup(user.id).then(refreshProfile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name ?? "");
    setBirthDate(profile.birth_date ?? "");
    const normalizedGender = normalizeGender(profile.gender);
    setGender(normalizedGender ? [normalizedGender] : []);
    setInterestedIn(profile.interested_in ?? []);
    setRelationshipGoal(profile.relationship_goal ?? "");
    setCity(profile.location_city ?? "");
    setCountry(profile.location_country ?? "");
    setLocationHidden(profile.location_hidden ?? false);
    setBio(profile.bio ?? "");
    setInterests(profile.interests ?? []);
    setLanguages(profile.languages ?? []);
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
    const onboardingProfile = profile as OnboardingProfile;
    setSafetyAccepted(Boolean(onboardingProfile.safety_agreement_accepted_at));
    if (profile.onboarding_complete && !onboardingProfile.discovery_blocked_reason)
      navigate({ to: "/discover" });
  }, [profile, navigate]);

  useEffect(() => {
    if (profile?.location_city) setCity(profile.location_city);
    if (profile?.location_country) setCountry(profile.location_country);
  }, [profile?.location_city, profile?.location_country]);

  const toggle = (arr: string[], set: (v: string[]) => void, value: string, single = false) => {
    set(
      single
        ? arr.includes(value)
          ? []
          : [value]
        : arr.includes(value)
          ? arr.filter((v) => v !== value)
          : [...arr, value],
    );
  };

  const saveDraft = async (complete = false) => {
    if (!user) return false;
    const now = new Date().toISOString();
    const onboardingProfile = profile as OnboardingProfile | null;
    const cleanPhoneCountry = onboardingProfile?.phone_country_code ?? null;
    const cleanPhone = onboardingProfile?.phone_number ?? null;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim() || null,
          birth_date: birthDate || null,
          gender: gender[0] ?? null,
          interested_in: interestedIn,
          relationship_goal: relationshipGoal || null,
          location_city: city.trim() || null,
          location_country: country.trim() || null,
          location_hidden: locationHidden,
          bio: bio.trim() || null,
          interests,
          languages,
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
          parenting_preferences: parentingPreferences || null,
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
          phone_country_code: cleanPhoneCountry,
          phone_number: cleanPhone,
          age_attested_at:
            birthDate && isAtLeast18(birthDate)
              ? (onboardingProfile?.age_attested_at ?? now)
              : null,
          terms_accepted_at: onboardingProfile?.terms_accepted_at ?? now,
          privacy_accepted_at: onboardingProfile?.privacy_accepted_at ?? now,
          safety_agreement_accepted_at: safetyAccepted
            ? (onboardingProfile?.safety_agreement_accepted_at ?? now)
            : null,
          onboarding_complete: complete,
        } as never)
        .eq("id", user.id);
      if (error) throw error;
      await refreshProfile();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save your progress.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const next = async () => {
    if (step === 0) {
      const parsed = requiredSchema.safeParse({
        display_name: displayName,
        birth_date: birthDate,
        gender: gender[0],
      });
      if (!parsed.success) {
        toast.error(parsed.error.issues[0].message);
        return;
      }
    }
    if (step === 1 && (!interestedIn.length || !relationshipGoal)) {
      toast.error("Add who you want to meet and your relationship goal.");
      return;
    }
    await saveDraft(false);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const finish = async () => {
    if (missing.length > 0) {
      toast.error(`Finish these first: ${missing.join(", ")}`);
      return;
    }
    const ok = await saveDraft(true);
    if (!ok) return;
    toast.success("Your profile is ready for discovery.");
    navigate({ to: "/discover" });
  };

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-gradient-warm">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-warm py-6 md:py-10">
      <div className="mx-auto max-w-3xl px-4">
        <div className="mb-6 text-center">
          <Logo className="justify-center" />
          <h1 className="mt-5 font-display text-2xl font-semibold tracking-tight md:text-3xl">
            Build a trustworthy profile
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Step {step + 1} of {STEPS.length}: {STEPS[step]}
          </p>
        </div>

        <div className="rounded-3xl border border-border/60 bg-card p-4 shadow-card md:p-7">
          <div className="mb-6 space-y-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">Profile completion</span>
              <span className="text-muted-foreground">{completion}%</span>
            </div>
            <Progress value={completion} className="h-2" />
            <div className="flex gap-1 overflow-x-auto pb-1">
              {STEPS.map((label, index) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setStep(index)}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                    index === step
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {step === 0 && (
            <Step title="Your basics" icon={Heart}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name" id="name">
                  <Input
                    id="name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={40}
                    className="rounded-xl"
                  />
                </Field>
                <Field label="Date of birth" id="birth">
                  <Input
                    id="birth"
                    type="date"
                    value={birthDate}
                    max={maxDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="rounded-xl"
                  />
                </Field>
              </div>
              <div className="mt-5">
                <p className="mb-3 text-sm font-medium">Gender</p>
                <ChipSelect
                  options={GENDER_OPTIONS}
                  selected={gender}
                  onToggle={(v) => toggle(gender, setGender, v, true)}
                />
              </div>
            </Step>
          )}

          {step === 1 && (
            <Step title="What you are looking for" icon={BadgeCheck}>
              <p className="mb-3 text-sm font-medium">Interested in</p>
              <ChipSelect
                options={INTERESTED_IN_OPTIONS}
                selected={interestedIn}
                onToggle={(v) => toggle(interestedIn, setInterestedIn, v)}
              />
              <div className="mt-5">
                <OnboardSelect
                  label="Relationship goal"
                  value={relationshipGoal}
                  onChange={setRelationshipGoal}
                  options={RELATIONSHIP_GOAL_OPTIONS}
                />
              </div>
            </Step>
          )}

          {step === 2 && (
            <Step title="Location" icon={MapPin}>
              <div className="rounded-2xl border border-border bg-muted/30 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">Use device location</p>
                    <p className="text-sm text-muted-foreground">
                      You can type your city manually if the prompt is denied.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => geo.detect()}
                    disabled={geo.detecting}
                  >
                    {geo.detecting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <MapPin className="h-4 w-4" />
                    )}
                    Detect
                  </Button>
                </div>
                {geo.status === "success" && <StatusLine good label="Location saved" />}
                {geo.status === "error" && (
                  <StatusLine label="Permission denied or unavailable. Add your city below." />
                )}
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="City" id="city">
                  <Input
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="rounded-xl"
                  />
                </Field>
                <Field label="Country" id="country">
                  <Input
                    id="country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="rounded-xl"
                  />
                </Field>
              </div>
              <div className="mt-5 flex items-center justify-between rounded-xl border border-border px-3 py-2.5">
                <Label htmlFor="hide-loc" className="cursor-pointer text-sm">
                  Hide exact distance
                </Label>
                <Switch
                  id="hide-loc"
                  checked={locationHidden}
                  onCheckedChange={setLocationHidden}
                />
              </div>
            </Step>
          )}

          {step === 3 && (
            <Step title="Profile photo" icon={Camera}>
              <p className="mb-4 text-sm text-muted-foreground">
                Add at least one clear photo before appearing in discovery.
              </p>
              {user && <PhotoManager userId={user.id} onChange={setPhotoCount} />}
            </Step>
          )}

          {step === 4 && (
            <Step title="About you" icon={Heart}>
              <Field label="Bio" id="bio">
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={500}
                  className="min-h-28 rounded-xl"
                />
              </Field>
              <div className="mt-5">
                <p className="mb-3 text-sm font-medium">Interests</p>
                <InterestChips
                  options={INTEREST_OPTIONS}
                  selected={interests}
                  onToggle={(v) => toggle(interests, setInterests, v)}
                  max={10}
                />
              </div>
              <div className="mt-5">
                <p className="mb-3 text-sm font-medium">Languages</p>
                <ChipSelect
                  options={LANGUAGE_OPTIONS.map((l) => ({ value: l, label: l }))}
                  selected={languages}
                  onToggle={(v) => toggle(languages, setLanguages, v)}
                />
              </div>
            </Step>
          )}

          {step === 5 && (
            <Step title="Lifestyle" icon={BadgeCheck}>
              <div className="grid gap-4 sm:grid-cols-2">
                <OnboardSelect
                  label="Profession"
                  value={profession}
                  onChange={setProfession}
                  options={PROFESSION_OPTIONS}
                />
                <OnboardSelect
                  label="Smoking"
                  value={smoking}
                  onChange={setSmoking}
                  options={SMOKING_OPTIONS}
                />
                <OnboardSelect
                  label="Drinking"
                  value={drinking}
                  onChange={setDrinking}
                  options={DRINKING_OPTIONS}
                />
                <OnboardSelect
                  label="Workout"
                  value={workout}
                  onChange={setWorkout}
                  options={WORKOUT_OPTIONS}
                />
                <OnboardSelect
                  label="Family plans"
                  value={familyPlans}
                  onChange={setFamilyPlans}
                  options={FAMILY_PLANS_OPTIONS}
                />
                <OnboardSelect
                  label="Pets"
                  value={pets}
                  onChange={setPets}
                  options={PETS_OPTIONS}
                />
              </div>
            </Step>
          )}

          {step === 6 && (
            <Step title="Serious relationship intentions" icon={Heart}>
              <div className="grid gap-4 sm:grid-cols-2">
                <OnboardSelect
                  label="Marriage intention"
                  value={marriageIntention}
                  onChange={setMarriageIntention}
                  options={MARRIAGE_INTENTION_OPTIONS}
                />
                <OnboardSelect
                  label="Marriage timeline"
                  value={marriageTimeline}
                  onChange={setMarriageTimeline}
                  options={MARRIAGE_TIMELINE_OPTIONS}
                />
                <OnboardSelect
                  label="Want children"
                  value={wantsChildren}
                  onChange={setWantsChildren}
                  options={WANTS_CHILDREN_OPTIONS}
                />
                <OnboardSelect
                  label="Have children"
                  value={hasChildren}
                  onChange={setHasChildren}
                  options={HAS_CHILDREN_OPTIONS}
                />
                <OnboardSelect
                  label="Faith or values importance"
                  value={faithValuesImportance}
                  onChange={setFaithValuesImportance}
                  options={FAITH_VALUES_IMPORTANCE_OPTIONS}
                />
                <OnboardSelect
                  label="Family values"
                  value={familyValues}
                  onChange={setFamilyValues}
                  options={FAMILY_VALUES_OPTIONS}
                />
                <OnboardSelect
                  label="Relocation openness"
                  value={relocationOpenness}
                  onChange={setRelocationOpenness}
                  options={RELOCATION_OPENNESS_OPTIONS}
                />
                <OnboardSelect
                  label="Communication style"
                  value={communicationStyle}
                  onChange={setCommunicationStyle}
                  options={COMMUNICATION_STYLE_OPTIONS}
                />
                <OnboardSelect
                  label="Long-distance openness"
                  value={longDistanceOpenness}
                  onChange={setLongDistanceOpenness}
                  options={LONG_DISTANCE_OPENNESS_OPTIONS}
                />
                <OnboardSelect
                  label="Conflict resolution"
                  value={conflictResolutionStyle}
                  onChange={setConflictResolutionStyle}
                  options={CONFLICT_RESOLUTION_STYLE_OPTIONS}
                />
                <OnboardSelect
                  label="Love language"
                  value={loveLanguage}
                  onChange={setLoveLanguage}
                  options={LOVE_LANGUAGE_OPTIONS}
                />
                <OnboardSelect
                  label="Work-life balance"
                  value={workLifeBalance}
                  onChange={setWorkLifeBalance}
                  options={WORK_LIFE_BALANCE_OPTIONS}
                />
                <OnboardSelect
                  label="Education importance"
                  value={educationImportance}
                  onChange={setEducationImportance}
                  options={EDUCATION_IMPORTANCE_OPTIONS}
                />
                <OnboardSelect
                  label="Faith importance"
                  value={faithImportance}
                  onChange={setFaithImportance}
                  options={FAITH_VALUES_IMPORTANCE_OPTIONS}
                />
                <OnboardSelect
                  label="Culture background"
                  value={cultureBackground}
                  onChange={setCultureBackground}
                  options={CULTURE_BACKGROUND_OPTIONS}
                />
                <OnboardSelect
                  label="Personality"
                  value={personalityType}
                  onChange={setPersonalityType}
                  options={PERSONALITY_TYPE_OPTIONS}
                />
                <OnboardSelect
                  label="Partner expectations"
                  value={partnerExpectations}
                  onChange={setPartnerExpectations}
                  options={PARTNER_EXPECTATIONS_OPTIONS}
                />
                <OnboardSelect
                  label="Future plans"
                  value={futurePlans}
                  onChange={setFuturePlans}
                  options={FUTURE_PLANS_OPTIONS}
                />
              </div>
              <div className="mt-5">
                <Field label="Parenting preferences" id="parenting">
                  <Textarea
                    id="parenting"
                    value={parentingPreferences}
                    onChange={(e) => setParentingPreferences(e.target.value)}
                    maxLength={300}
                    className="min-h-20 rounded-xl"
                    placeholder="Optional: what kind of parenting partnership would you hope for?"
                  />
                </Field>
              </div>
              <div className="mt-5">
                <p className="mb-3 text-sm font-medium">Dealbreakers</p>
                <ChipSelect
                  options={DEALBREAKER_OPTIONS}
                  selected={dealbreakers}
                  onToggle={(value) => toggle(dealbreakers, setDealbreakers, value)}
                />
              </div>
              <div className="mt-5">
                <p className="mb-3 text-sm font-medium">Hobbies</p>
                <ChipSelect
                  options={HOBBY_OPTIONS}
                  selected={hobbies}
                  onToggle={(value) => toggle(hobbies, setHobbies, value)}
                />
              </div>
            </Step>
          )}

          {step === 7 && (
            <Step title="Safety agreement" icon={ShieldCheck}>
              <div className="space-y-3 rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                <SafetyRule label="Use your real age and current photos." />
                <SafetyRule label="Do not harass, scam, threaten, or pressure other members." />
                <SafetyRule label="Report and block anyone who makes you feel unsafe." />
                <SafetyRule label="Meet in public first and keep financial information private." />
              </div>
              <div className="mt-5 flex items-start gap-3 rounded-2xl border border-border p-4">
                <Checkbox
                  id="safety"
                  checked={safetyAccepted}
                  onCheckedChange={(value) => setSafetyAccepted(value === true)}
                  className="mt-1"
                />
                <Label htmlFor="safety" className="text-sm leading-6 text-muted-foreground">
                  I agree to follow the community guidelines and understand that suspicious,
                  abusive, fake, or underage accounts may be restricted.
                </Label>
              </div>
            </Step>
          )}

          {step === 8 && (
            <Step title="Ready for review" icon={ShieldCheck}>
              {strengthProfile && (
                <ConnectionStrength
                  profile={strengthProfile}
                  userId={user?.id}
                  photoCount={photoCount}
                  className="mb-5"
                />
              )}
              {missing.length === 0 ? (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50 p-4 text-sm text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300">
                  <CheckCircle2 className="mb-2 h-5 w-5" />
                  Your required profile fields are complete. Photo verification is recommended next.
                </div>
              ) : (
                <div className="rounded-2xl border border-amber-400/40 bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
                  <AlertCircle className="mb-2 h-5 w-5" />
                  Finish these before appearing in discovery: {missing.join(", ")}.
                </div>
              )}
              <div className="mt-5 rounded-2xl border border-border p-4">
                <p className="font-medium">After onboarding</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  You can request photo verification from Settings and use Report or Block from
                  every profile and chat.
                </p>
              </div>
            </Step>
          )}

          <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={saving || step === 0}
            >
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button
                type="button"
                variant="hero"
                className="rounded-xl"
                onClick={next}
                disabled={saving}
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save and continue
              </Button>
            ) : (
              <Button
                type="button"
                variant="hero"
                className="rounded-xl"
                onClick={finish}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Heart className="h-4 w-4" fill="currentColor" />
                )}
                Complete onboarding
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Step({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Heart;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-5 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-accent text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

const NONE = "__none__";

function OnboardSelect({
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

function StatusLine({ good, label }: { good?: boolean; label: string }) {
  return (
    <p
      className={`mt-3 flex items-center gap-2 text-sm ${good ? "text-emerald-600" : "text-amber-700 dark:text-amber-300"}`}
    >
      {good ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
      {label}
    </p>
  );
}

function SafetyRule({ label }: { label: string }) {
  return (
    <p className="flex gap-2">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <span>{label}</span>
    </p>
  );
}
