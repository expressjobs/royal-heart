import { useState } from "react";
import type { ReactNode } from "react";
import {
  ChevronLeft,
  ChevronRight,
  DoorOpen,
  MapPin,
  GraduationCap,
  Church,
  Heart,
  Languages,
  MessageCircleHeart,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { photoPath, type ProfileWithPhotos } from "@/lib/profiles";
import type { CompatBreakdown } from "@/lib/compatibility";
import { CompatibilityBreakdown } from "@/components/CompatibilityBreakdown";
import { ageFromBirthDate } from "@/contexts/AuthContext";
import { usePresence, presenceLabel } from "@/contexts/PresenceContext";
import { PresenceDot } from "@/components/PresenceIndicator";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import { VerifiedBadge, TierBadge } from "@/components/TierBadge";
import { CompatibilityBadge } from "@/components/CompatibilityBadge";
import { formatDistance } from "@/lib/geo";
import {
  RELIGION_OPTIONS,
  EDUCATION_OPTIONS,
  DRINKING_OPTIONS,
  FAMILY_PLANS_OPTIONS,
  PETS_OPTIONS,
  PROFESSION_OPTIONS,
  RELATIONSHIP_GOAL_OPTIONS,
  SMOKING_OPTIONS,
  WORKOUT_OPTIONS,
  labelFor,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

export function ProfileView({
  profile,
  viewerCountry,
  breakdown,
  className,
}: {
  profile: ProfileWithPhotos;
  /** Viewer's country — used to show distance in miles vs km. */
  viewerCountry?: string | null;
  /** Optional AI compatibility breakdown — renders the "Why you matched" panel. */
  breakdown?: CompatBreakdown | null;
  className?: string;
}) {
  const paths = profile.photos.map((p) => photoPath(p)).filter((p): p is string => !!p);
  const [idx, setIdx] = useState(0);
  const ordered = paths;
  const current = ordered[idx];
  const age = ageFromBirthDate(profile.birth_date);

  const { isOnline } = usePresence();
  const online = isOnline(profile.id);
  const distanceLabel = profile.hide_distance
    ? null
    : formatDistance(profile.distance_m, viewerCountry);
  const presence = presenceLabel(online, profile.last_active);

  const locationLine = profile.location_hidden
    ? ""
    : [profile.location_city, profile.location_country].filter(Boolean).join(", ");
  const religion = labelFor(RELIGION_OPTIONS, profile.religion);
  const education = labelFor(EDUCATION_OPTIONS, profile.education);
  const relationshipGoal = labelFor(RELATIONSHIP_GOAL_OPTIONS, profile.relationship_goal);
  const lifestyle = [
    labelFor(PROFESSION_OPTIONS, profile.profession),
    labelFor(WORKOUT_OPTIONS, profile.workout),
    labelFor(DRINKING_OPTIONS, profile.drinking),
    labelFor(SMOKING_OPTIONS, profile.smoking),
    labelFor(FAMILY_PLANS_OPTIONS, profile.family_plans),
    labelFor(PETS_OPTIONS, profile.pets),
  ].filter((item): item is string => Boolean(item));
  const sharedInterests = new Set(breakdown?.shared_interests ?? []);
  const compatScore = breakdown?.score ?? profile.score ?? null;
  const firstName = profile.display_name?.split(" ")[0] || "them";

  const next = () => setIdx((i) => (i + 1) % Math.max(ordered.length, 1));
  const prev = () => setIdx((i) => (i - 1 + ordered.length) % Math.max(ordered.length, 1));

  return (
    <div className={cn("overflow-hidden rounded-3xl bg-card", className)}>
      <div className="relative aspect-[4/5] w-full bg-muted">
        <ProfilePhoto
          path={current ?? null}
          alt={profile.display_name ?? "Profile"}
          rounded="rounded-none"
          loading="eager"
          className="h-full w-full"
        />

        {/* photo indicators */}
        {ordered.length > 1 && (
          <div className="absolute inset-x-3 top-3 flex gap-1.5">
            {ordered.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  i === idx ? "bg-white" : "bg-white/40",
                )}
              />
            ))}
          </div>
        )}

        {/* online badge */}
        {online && (
          <div className="absolute right-3 top-6 flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
            <PresenceDot online={online} lastActive={profile.last_active} className="h-2 w-2" />
            {presence}
          </div>
        )}

        {ordered.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/30 p-1.5 text-white backdrop-blur transition hover:bg-black/50"
              aria-label="Previous photo"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/30 p-1.5 text-white backdrop-blur transition hover:bg-black/50"
              aria-label="Next photo"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        {/* name overlay */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-5 pt-16 text-white">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-2xl font-semibold">
              {profile.display_name}
              {age != null && <span className="ml-1 font-sans font-normal">{age}</span>}
            </h2>
            {profile.is_verified && <VerifiedBadge className="text-white" />}
            <TierBadge tier={profile.membership_tier} />
            {compatScore != null && <CompatibilityBadge score={compatScore} className="ml-auto" />}
          </div>

          {locationLine && (
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/90">
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {locationLine}
              </span>
              {distanceLabel && <span className="text-white/70">· {distanceLabel}</span>}
            </p>
          )}

          <p className="mt-1 flex items-center gap-1.5 text-sm text-white/80">
            <PresenceDot online={online} lastActive={profile.last_active} className="h-2.5 w-2.5" />
            {presence}
          </p>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <ProfileSection icon={Sparkles} title="First Look">
          {profile.bio ? (
            <p className="text-sm leading-relaxed text-foreground">{profile.bio}</p>
          ) : (
            <p className="text-sm text-muted-foreground">{firstName} has not added a bio yet.</p>
          )}
        </ProfileSection>

        {(relationshipGoal || education || religion || lifestyle.length > 0) && (
          <ProfileSection icon={Heart} title="What Matters">
            <div className="grid gap-2 text-sm text-muted-foreground">
              {relationshipGoal && <Signal icon={Heart} label={relationshipGoal} />}
              {education && <Signal icon={GraduationCap} label={education} />}
              {religion && <Signal icon={Church} label={religion} />}
              {lifestyle.slice(0, 4).map((item) => (
                <Signal key={item} icon={ShieldCheck} label={item} />
              ))}
            </div>
          </ProfileSection>
        )}

        {((profile.interests && profile.interests.length > 0) ||
          (profile.languages && profile.languages.length > 0) ||
          breakdown) && (
          <ProfileSection icon={Languages} title="Shared Signals">
            {profile.languages && profile.languages.length > 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {profile.languages.map((l) => (
                  <span
                    key={l}
                    className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
                  >
                    {l}
                  </span>
                ))}
              </div>
            )}
            {profile.interests && profile.interests.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {profile.interests.map((i) => {
                  const isShared = sharedInterests.has(i);
                  return (
                    <span
                      key={i}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium",
                        isShared
                          ? "bg-primary text-primary-foreground ring-1 ring-primary"
                          : "bg-accent text-accent-foreground",
                      )}
                    >
                      {i}
                    </span>
                  );
                })}
              </div>
            )}
            {breakdown && (
              <CompatibilityBreakdown breakdown={breakdown} name={profile.display_name} />
            )}
          </ProfileSection>
        )}

        <ProfileSection icon={DoorOpen} title="Conversation Door">
          <p className="text-sm text-muted-foreground">
            Notice one specific detail and open with curiosity. A thoughtful first note fits
            HeartConnect better than a quick reaction.
          </p>
          {breakdown?.shared_interests?.[0] && (
            <p className="mt-2 flex items-center gap-2 rounded-2xl bg-muted/50 p-3 text-sm">
              <MessageCircleHeart className="h-4 w-4 text-primary" />
              Ask about {breakdown.shared_interests[0]}.
            </p>
          )}
        </ProfileSection>
      </div>
    </div>
  );
}

function ProfileSection({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Heart;
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase text-muted-foreground">
        <Icon className="h-4 w-4 text-primary" /> {title}
      </h3>
      {children}
    </section>
  );
}

function Signal({ icon: Icon, label }: { icon: typeof Heart; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-primary" /> {label}
    </span>
  );
}
