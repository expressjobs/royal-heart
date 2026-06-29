import { useCallback, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  GeoError,
  getCurrentPosition,
  reverseGeocode,
  type DetectedLocation,
  type GeoErrorKind,
} from "@/lib/geo";

type Status = "idle" | "detecting" | "success" | "error";

/**
 * Detects the signed-in user's GPS location (after permission), reverse-geocodes
 * it to city/state/country, and stores everything on their profile. Surfaces a
 * precise failure reason so the UI can guide the member to manual entry.
 */
export function useGeolocation() {
  const { user, profile, refreshProfile } = useAuth();
  const [status, setStatus] = useState<Status>("idle");
  const [errorKind, setErrorKind] = useState<GeoErrorKind | null>(null);

  const detect = useCallback(
    async (opts?: { silent?: boolean }): Promise<DetectedLocation | null> => {
      if (!user) return null;
      if (profile?.location_access_suspended) {
        if (!opts?.silent) toast.error("Location access has been disabled for your account.");
        return null;
      }
      setStatus("detecting");
      setErrorKind(null);
      try {
        const pos = await getCurrentPosition();
        const loc = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);

        const { error } = await supabase
          .from("profiles")
          .update({
            latitude: loc.latitude,
            longitude: loc.longitude,
            location_city: loc.city ?? profile?.location_city ?? null,
            location_state: loc.state ?? null,
            location_country: loc.country ?? profile?.location_country ?? null,
            location_updated_at: new Date().toISOString(),
          })
          .eq("id", user.id);
        if (error) throw error;

        await refreshProfile();
        setStatus("success");
        if (!opts?.silent) {
          toast.success(
            loc.city
              ? `Location set to ${[loc.city, loc.country].filter(Boolean).join(", ")}`
              : "Location updated",
          );
        }
        return loc;
      } catch (err) {
        setStatus("error");
        const kind: GeoErrorKind = err instanceof GeoError ? err.kind : "unknown";
        setErrorKind(kind);
        if (!opts?.silent) {
          toast.error(
            err instanceof GeoError
              ? err.message
              : "Couldn't detect your location. Please try again.",
          );
        }
        return null;
      }
    },
    [user, profile, refreshProfile],
  );

  return { detect, status, errorKind, detecting: status === "detecting" };
}
