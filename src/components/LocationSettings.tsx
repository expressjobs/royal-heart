import { useEffect, useState } from "react";
import { Loader2, MapPin, Navigation, Save, ShieldAlert, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useGeolocation } from "@/hooks/useGeolocation";
import { usesMiles, forwardGeocode, GEO_MESSAGES } from "@/lib/geo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Mobile-first location controls: explains why location is used, lets the
 * member detect GPS (with permission) or enter a city manually, and shows
 * which distance unit they'll see. Raw coordinates are never displayed to
 * other members — only an approximate distance and city. Manual entries are
 * geocoded so the member still appears in distance-based discovery.
 */
export function LocationSettings() {
  const { user, profile, refreshProfile } = useAuth();
  const { detect, detecting, errorKind } = useGeolocation();
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("");
  const [saving, setSaving] = useState(false);

  const suspended = profile?.location_access_suspended ?? false;

  useEffect(() => {
    if (profile) {
      setCity(profile.location_city ?? "");
      setState(profile.location_state ?? "");
      setCountry(profile.location_country ?? "");
    }
  }, [profile]);

  const hasGps = profile?.latitude != null && profile?.longitude != null;
  const unit = usesMiles(country || profile?.location_country) ? "miles" : "kilometres";

  const saveManual = async () => {
    if (!user) return;
    if (!city.trim() && !country.trim()) {
      toast.error("Enter at least a city or country.");
      return;
    }
    setSaving(true);
    // Geocode the manual place so the member still shows up in distance-based
    // discovery (key-free OpenStreetMap lookup; falls back gracefully).
    const coords = await forwardGeocode(city, state, country);
    const { error } = await supabase
      .from("profiles")
      .update({
        location_city: city.trim() || null,
        location_state: state.trim() || null,
        location_country: country.trim() || null,
        ...(coords ? { latitude: coords.latitude, longitude: coords.longitude } : {}),
        location_updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Could not save your location.");
      return;
    }
    await refreshProfile();
    toast.success(coords ? "Location saved — you'll appear in nearby searches" : "Location saved");
  };

  return (
    <section className="rounded-3xl border border-border bg-card p-5">
      <h2 className="mb-1 flex items-center gap-2 font-semibold">
        <MapPin className="h-5 w-5 text-primary" /> Location
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        We use your location only to show how far away potential matches are and to power nearby
        discovery. Other members never see your exact coordinates — just your city and an
        approximate distance. Distances are shown in {unit} for your region.
      </p>

      {suspended ? (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <p>
            Location access has been disabled for your account by our team. You won't appear in
            distance-based discovery until it's restored.
          </p>
        </div>
      ) : (
        <>
          <Button
            type="button"
            variant="hero"
            className="rounded-xl"
            onClick={() => detect()}
            disabled={detecting}
          >
            {detecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Navigation className="h-4 w-4" />
            )}
            {hasGps ? "Update my GPS location" : "Use my current location"}
          </Button>
          {hasGps && (
            <p className="mt-2 text-xs text-muted-foreground">
              GPS location is set. You appear in nearby searches.
            </p>
          )}

          {errorKind && (
            <div className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-400/40 bg-amber-50/60 p-3 text-sm dark:bg-amber-950/20">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <p>{GEO_MESSAGES[errorKind]}</p>
            </div>
          )}

          <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or enter it manually{" "}
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="loc-city">City</Label>
              <Input
                id="loc-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="loc-state">State / region</Label>
              <Input
                id="loc-state"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="Region"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="loc-country">Country</Label>
              <Input
                id="loc-country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="Country"
                className="rounded-xl"
              />
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="mt-4 rounded-xl"
            onClick={saveManual}
            disabled={saving}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save location
          </Button>
        </>
      )}
    </section>
  );
}
