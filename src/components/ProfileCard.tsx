import { Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import { VerifiedBadge } from "@/components/TierBadge";
import { CompatibilityBadge } from "@/components/CompatibilityBadge";
import { ageFromBirthDate } from "@/contexts/AuthContext";
import { formatDistance } from "@/lib/geo";
import { primaryPhotoPath, type ProfileWithPhotos } from "@/lib/profiles";
import {
  MARRIAGE_INTENTION_OPTIONS,
  optionLabel,
  trustLevelLabel,
} from "@/lib/serious-relationship";

/** Compact profile card used in discovery grids and section rails. */
export function ProfileCard({
  profile,
  viewerCountry,
  className,
  onSelect,
}: {
  profile: ProfileWithPhotos;
  viewerCountry?: string | null;
  className?: string;
  /** Called when the card is opened — used to log recommendation clicks. */
  onSelect?: () => void;
}) {
  const age = profile.hide_age ? null : ageFromBirthDate(profile.birth_date);
  const distance = formatDistance(profile.distance_m, viewerCountry);
  const place = profile.location_hidden
    ? null
    : [profile.location_city, profile.location_country].filter(Boolean).join(", ");

  return (
    <Link
      to="/profile/$id"
      params={{ id: profile.id }}
      onClick={onSelect}
      className={`group block overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:shadow-card ${className ?? ""}`}
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden">
        <ProfilePhoto
          path={primaryPhotoPath(profile)}
          alt={profile.display_name ?? "Member"}
          rounded="rounded-none"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {profile.is_verified && (
          <span className="absolute right-2 top-2">
            <VerifiedBadge />
          </span>
        )}
        {profile.score != null && (
          <span className="absolute left-2 top-2">
            <CompatibilityBadge score={profile.score} />
          </span>
        )}
        <div className="absolute inset-x-2 top-10 flex flex-wrap gap-1">
          {profile.marriage_intention && (
            <span className="rounded-full bg-rose-600/90 px-2 py-0.5 text-[10px] font-semibold text-white">
              {optionLabel(MARRIAGE_INTENTION_OPTIONS, profile.marriage_intention)}
            </span>
          )}
          <span className="rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white">
            {trustLevelLabel(profile.trust_level)}
          </span>
          {typeof profile.profile_completion_score === "number" && (
            <span className="rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white">
              {profile.profile_completion_score}% complete
            </span>
          )}
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 text-white">
          <p className="truncate text-sm font-semibold">
            {profile.display_name ?? "Member"}
            {age != null && <span className="font-normal">, {age}</span>}
          </p>
          {(distance || place) && (
            <p className="flex items-center gap-1 truncate text-xs text-white/80">
              <MapPin className="h-3 w-3 shrink-0" />
              {distance ?? place}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
