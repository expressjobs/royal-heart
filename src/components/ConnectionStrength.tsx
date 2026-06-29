import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Camera,
  CheckCircle2,
  Circle,
  HeartHandshake,
  Lightbulb,
  MapPin,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/lib/profiles";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type StrengthProfile = Profile & {
  safety_agreement_accepted_at?: string | null;
};

type VerificationStatus = "approved" | "pending" | "rejected" | "none";

const LIFESTYLE_FIELDS = [
  "profession",
  "smoking",
  "drinking",
  "workout",
  "family_plans",
  "pets",
  "education",
  "religion",
] as const;

export function ConnectionStrength({
  profile,
  userId,
  photoCount: photoCountOverride,
  className,
}: {
  profile: StrengthProfile;
  userId?: string | null;
  photoCount?: number;
  className?: string;
}) {
  const [photoCount, setPhotoCount] = useState(photoCountOverride ?? 0);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>(
    profile.is_verified ? "approved" : "none",
  );

  useEffect(() => {
    if (photoCountOverride != null) setPhotoCount(photoCountOverride);
  }, [photoCountOverride]);

  useEffect(() => {
    if (!userId || photoCountOverride != null) return;
    let active = true;
    supabase
      .from("profile_photos")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .then(({ count }) => {
        if (active) setPhotoCount(count ?? 0);
      });
    return () => {
      active = false;
    };
  }, [userId, photoCountOverride]);

  useEffect(() => {
    if (!userId || profile.is_verified) {
      setVerificationStatus(profile.is_verified ? "approved" : "none");
      return;
    }
    let active = true;
    supabase
      .from("verification_requests")
      .select("status")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        const status = data?.status;
        setVerificationStatus(status === "pending" || status === "rejected" ? status : "none");
      });
    return () => {
      active = false;
    };
  }, [userId, profile.is_verified]);

  const items = useMemo(() => {
    const lifestyleCount =
      LIFESTYLE_FIELDS.filter((field) => Boolean(profile[field])).length +
      (profile.languages?.length ? 1 : 0);
    const hasSignals = (profile.interests?.length ?? 0) >= 3 || lifestyleCount >= 2;
    const verificationReady = profile.is_verified || verificationStatus === "pending";

    return [
      {
        key: "photo",
        label: "Profile photo",
        done: photoCount > 0,
        tip: "Add a clear main photo so people can recognize you.",
        icon: Camera,
      },
      {
        key: "bio",
        label: "Bio",
        done: Boolean(profile.bio?.trim()),
        tip: "Write a few honest lines about your pace, values, or everyday life.",
        icon: Sparkles,
      },
      {
        key: "goal",
        label: "Relationship goal",
        done: Boolean(profile.relationship_goal),
        tip: "Choose the kind of connection you are open to now.",
        icon: HeartHandshake,
      },
      {
        key: "location",
        label: "City and country",
        done:
          Boolean(profile.location_city && profile.location_country) ||
          (profile.latitude != null && profile.longitude != null),
        tip: "Set your city and country so discovery can stay relevant.",
        icon: MapPin,
      },
      {
        key: "signals",
        label: "Interests and lifestyle",
        done: hasSignals,
        tip: "Add at least three interests, or a few lifestyle details.",
        icon: Lightbulb,
      },
      {
        key: "safety",
        label: "Safety agreement",
        done: Boolean(profile.safety_agreement_accepted_at),
        tip: "Accept the safety agreement to show you understand the community standard.",
        icon: ShieldCheck,
      },
      {
        key: "verification",
        label: "Photo review",
        done: verificationReady,
        tip:
          verificationStatus === "rejected"
            ? "Submit a fresh verification photo when you are ready."
            : "Request profile verification when your photos are ready.",
        icon: BadgeCheck,
      },
    ];
  }, [profile, photoCount, verificationStatus]);

  const complete = items.filter((item) => item.done).length;
  const percent = Math.round((complete / items.length) * 100);
  const missing = items.filter((item) => !item.done);

  return (
    <section className={cn("rounded-3xl border border-border bg-card p-5", className)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <HeartHandshake className="h-5 w-5 text-primary" /> Connection Strength
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A private readiness check for meaningful matches.
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold tabular-nums">{percent}%</p>
          <p className="text-xs text-muted-foreground">
            {complete} of {items.length}
          </p>
        </div>
      </div>

      <Progress value={percent} className="mt-4 h-2" />

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.key}
            className={cn(
              "flex items-center gap-2 rounded-2xl px-3 py-2 text-sm",
              item.done ? "bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground",
            )}
          >
            {item.done ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <Circle className="h-4 w-4 shrink-0" />
            )}
            <item.icon className="h-4 w-4 shrink-0" />
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-2xl bg-muted/40 p-4">
        <p className="text-sm font-medium">
          {missing.length === 0 ? "Your profile is in a strong place." : "Next helpful steps"}
        </p>
        <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
          {(missing.length ? missing.slice(0, 3) : items.slice(0, 2)).map((item) => (
            <li key={item.key} className="flex gap-2">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                {item.done ? "Keep your details current as your life changes." : item.tip}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
