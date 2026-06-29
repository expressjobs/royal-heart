import { MapPin } from "lucide-react";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import { VerifiedBadge } from "@/components/TierBadge";
import { ageFromBirthDate } from "@/contexts/AuthContext";
import type { CompatBreakdown } from "@/lib/compatibility";
import { formatDistance } from "@/lib/geo";
import { primaryPhotoPath, type ProfileWithPhotos } from "@/lib/profiles";
import { cn } from "@/lib/utils";
import {
  MARRIAGE_INTENTION_OPTIONS,
  MARRIAGE_TIMELINE_OPTIONS,
  optionLabel,
  trustLevelLabel,
} from "@/lib/serious-relationship";

export function SwipeCard({
  profile,
  viewerCountry,
  breakdown,
  offset = { x: 0, y: 0 },
  active = false,
  stackIndex = 0,
  dragging = false,
  bind,
}: {
  profile: ProfileWithPhotos;
  viewerCountry?: string | null;
  breakdown?: CompatBreakdown | null;
  offset?: { x: number; y: number };
  active?: boolean;
  stackIndex?: number;
  dragging?: boolean;
  bind?: React.HTMLAttributes<HTMLDivElement>;
}) {
  const rotate = active ? offset.x / 18 : 0;
  const transform = active
    ? `translate3d(${offset.x}px, ${offset.y}px, 0) rotate(${rotate}deg)`
    : `translateY(${stackIndex * 12}px) scale(${1 - stackIndex * 0.035})`;
  const photo = primaryPhotoPath(profile);
  const age = ageFromBirthDate(profile.birth_date);
  const locationLine = profile.location_hidden
    ? ""
    : [profile.location_city, profile.location_country].filter(Boolean).join(", ");
  const distanceLabel = profile.hide_distance
    ? null
    : formatDistance(profile.distance_m, viewerCountry);
  const previewText =
    profile.bio?.trim() ||
    (profile.interests?.length
      ? profile.interests.slice(0, 4).join(" • ")
      : "Ready for a thoughtful connection.");
  const compatScore = breakdown?.score ?? profile.score ?? null;
  const online = profile.last_active
    ? Date.now() - new Date(profile.last_active).getTime() < 5 * 60 * 1000
    : false;
  const reasons = breakdown?.explanation ?? [];

  return (
    <div
      className={cn(
        "absolute inset-x-0 top-0 select-none touch-none",
        active ? "z-20" : "pointer-events-none",
        !dragging && "transition-transform duration-200 ease-out",
      )}
      style={{
        transform,
        opacity: active ? 1 : 1 - stackIndex * 0.14,
        zIndex: active ? 20 : 10 - stackIndex,
      }}
      {...bind}
    >
      <article className="relative h-[min(72vh,650px)] min-h-[500px] overflow-hidden rounded-[24px] bg-card shadow-card">
        <ProfilePhoto
          path={photo}
          alt={profile.display_name ?? "Profile"}
          rounded="rounded-none"
          loading={active ? "eager" : "lazy"}
          className="absolute inset-0 h-full w-full"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/20 to-black/5" />
        <div className="absolute inset-x-0 bottom-0 space-y-3 p-5 text-white">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="min-w-0 flex-1 truncate font-display text-3xl font-semibold">
              {profile.display_name ?? "Member"}
              {age != null && <span className="ml-2 font-sans font-normal">{age}</span>}
            </h2>
            {profile.is_verified && <VerifiedBadge className="text-white" />}
            {compatScore != null && (
              <span className="rounded-full bg-white/18 px-2.5 py-1 text-xs font-semibold backdrop-blur">
                {compatScore}% match
              </span>
            )}
            {typeof profile.profile_completion_score === "number" && (
              <span className="rounded-full bg-white/18 px-2.5 py-1 text-xs font-semibold backdrop-blur">
                {profile.profile_completion_score}% complete
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            {profile.marriage_intention && (
              <span className="rounded-full bg-rose-500/80 px-2.5 py-1 backdrop-blur">
                {optionLabel(MARRIAGE_INTENTION_OPTIONS, profile.marriage_intention)}
              </span>
            )}
            <span className="rounded-full bg-white/18 px-2.5 py-1 backdrop-blur">
              {trustLevelLabel(profile.trust_level)}
            </span>
            {online && (
              <span className="rounded-full bg-emerald-500/80 px-2.5 py-1 backdrop-blur">
                Online now
              </span>
            )}
            {profile.marriage_timeline && (
              <span className="rounded-full bg-white/18 px-2.5 py-1 backdrop-blur">
                {optionLabel(MARRIAGE_TIMELINE_OPTIONS, profile.marriage_timeline)}
              </span>
            )}
            {profile.relationship_goal && (
              <span className="rounded-full bg-white/18 px-2.5 py-1 backdrop-blur">
                {profile.relationship_goal.replaceAll("_", " ")}
              </span>
            )}
          </div>
          {(locationLine || distanceLabel) && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/88">
              {locationLine && (
                <span className="flex min-w-0 items-center gap-1">
                  <MapPin className="h-4 w-4 shrink-0" />
                  <span className="truncate">{locationLine}</span>
                </span>
              )}
              {distanceLabel && <span className="text-white/70">{distanceLabel}</span>}
            </p>
          )}
          <p className="line-clamp-3 text-sm leading-6 text-white/86">{previewText}</p>
          {reasons.length > 0 && (
            <p className="line-clamp-2 text-xs leading-5 text-white/78">
              Why you match: {reasons.slice(0, 2).join(" • ")}
            </p>
          )}
          {profile.interests?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {profile.interests.slice(0, 3).map((interest) => (
                <span
                  key={interest}
                  className="rounded-full bg-white/16 px-3 py-1 text-xs font-medium text-white backdrop-blur"
                >
                  {interest}
                </span>
              ))}
            </div>
          )}
        </div>
      </article>
      {active && Math.abs(offset.x) > 24 && (
        <span
          className={cn(
            "pointer-events-none absolute top-8 rounded-2xl border-4 px-4 py-2 text-xl font-black uppercase tracking-wide",
            offset.x > 0
              ? "right-7 rotate-12 border-emerald-300 text-emerald-100"
              : "left-7 -rotate-12 border-rose-300 text-rose-100",
          )}
        >
          {offset.x > 0 ? "Like" : "Pass"}
        </span>
      )}
    </div>
  );
}
