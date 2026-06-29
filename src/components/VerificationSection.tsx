import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  BadgeCheck,
  Camera,
  Clock,
  FileCheck2,
  Loader2,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { submitVerification } from "@/lib/verification.functions";
import type { Database } from "@/integrations/supabase/types";

type VerificationRequest = Database["public"]["Tables"]["verification_requests"]["Row"];

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ACCEPTED_LABEL = "JPG, PNG or WebP";
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB
const MIN_DIMENSION = 400; // px, shortest side

const DOCUMENT_TYPES = [
  { value: "", label: "Selfie only (no ID)" },
  { value: "passport", label: "Passport" },
  { value: "national_id", label: "National ID card" },
  { value: "drivers_license", label: "Driver's license" },
] as const;

/** Loads an image file and resolves its natural pixel dimensions. */
function readImageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode-failed"));
    };
    img.src = url;
  });
}

export function VerificationSection() {
  const { user, profile, refreshProfile } = useAuth();
  const submit = useServerFn(submitVerification);
  const [request, setRequest] = useState<VerificationRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [documentType, setDocumentType] = useState<string>("");
  const [idFile, setIdFile] = useState<File | null>(null);
  const selfieInput = useRef<HTMLInputElement>(null);
  const idInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("verification_requests")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setRequest(data ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // Live-update the verification status when an admin approves/rejects, or when
  // a new request lands — no page refresh needed.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`verification-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "verification_requests",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const next = payload.new as VerificationRequest | null;
          if (payload.eventType === "DELETE") {
            setRequest(null);
            return;
          }
          if (next) {
            setRequest((prev) =>
              !prev || prev.id === next.id || next.created_at >= prev.created_at ? next : prev,
            );
            if (next.status === "approved") {
              void refreshProfile();
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refreshProfile]);

  const isVerified = profile?.is_verified ?? false;
  const hasPending = request?.status === "pending";

  const uiStatus = loading
    ? "loading"
    : isVerified
      ? "approved"
      : hasPending
        ? "pending"
        : request?.status === "rejected"
          ? "rejected"
          : "none";

  const fail = (message: string) => {
    setError(message);
    toast.error(message);
  };

  /** Validates an image client-side (fast feedback; the server re-validates). */
  const checkImage = async (file: File, label: string): Promise<boolean> => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      fail(`Unsupported ${label} type. Please upload a ${ACCEPTED_LABEL} image.`);
      return false;
    }
    if (file.size > MAX_FILE_BYTES) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      fail(`${label} is too large (${mb}MB). Maximum size is 8MB.`);
      return false;
    }
    return true;
  };

  const handleIdFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    if (!(await checkImage(file, "ID image"))) return;
    setIdFile(file);
  };

  const handleSelfie = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    setError(null);

    if (!(await checkImage(file, "Selfie"))) return;

    let size: { width: number; height: number };
    try {
      size = await readImageSize(file);
    } catch {
      fail("We couldn't read that image. Please try a different photo.");
      return;
    }
    if (size.width < MIN_DIMENSION || size.height < MIN_DIMENSION) {
      fail(
        `Selfie resolution is too low (${size.width}×${size.height}px). ` +
          `Please use an image at least ${MIN_DIMENSION}×${MIN_DIMENSION}px.`,
      );
      return;
    }

    if (documentType && !idFile) {
      fail("Please attach a photo of your government ID, or switch to selfie-only.");
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (documentType && idFile) {
        fd.append("idFile", idFile);
        fd.append("documentType", documentType);
      }
      const res = await submit({ data: fd });
      if (!res.ok) {
        fail(res.error);
        return;
      }
      setRequest(res.request);
      setIdFile(null);
      setDocumentType("");
      toast.success("Verification submitted for review.");
    } catch {
      fail("Could not submit your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      className="rounded-3xl border border-border bg-card p-5"
      data-testid="verification-section"
      data-verification-status={uiStatus}
    >
      <h2 className="mb-1 flex items-center gap-2 font-semibold">
        <BadgeCheck className="h-5 w-5 text-primary" /> Profile verification
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Submit a clear selfie so our team can confirm you're a real person. Add a government ID for
        a higher-trust verified badge. Verified members get a trust badge on their profile.
      </p>

      {loading ? (
        <div className="grid h-24 place-items-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : isVerified ? (
        <div className="flex items-center gap-3 rounded-2xl bg-primary/10 p-4 text-sm">
          <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
          <span className="font-medium text-primary">Your profile is verified.</span>
        </div>
      ) : hasPending ? (
        <div className="flex items-center gap-3 rounded-2xl bg-muted/60 p-4 text-sm">
          <Clock className="h-5 w-5 shrink-0 text-muted-foreground" />
          <span className="text-muted-foreground">
            Your verification is under review. We'll add your badge once it's approved.
          </span>
        </div>
      ) : (
        <>
          {request?.status === "rejected" && (
            <div className="mb-3 flex items-start gap-3 rounded-2xl bg-destructive/10 p-4 text-sm">
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div>
                <p className="font-medium text-destructive">Your last request wasn't approved.</p>
                {request.note && <p className="mt-1 text-muted-foreground">{request.note}</p>}
                <p className="mt-1 text-muted-foreground">You can submit a new request below.</p>
              </div>
            </div>
          )}
          {error && (
            <div
              role="alert"
              className="mb-3 flex items-start gap-3 rounded-2xl bg-destructive/10 p-4 text-sm"
            >
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <p className="text-destructive">{error}</p>
            </div>
          )}

          <div className="mb-4 space-y-2">
            <label htmlFor="verification-doc-type" className="text-sm font-medium">
              Verification level
            </label>
            <select
              id="verification-doc-type"
              value={documentType}
              onChange={(e) => {
                setDocumentType(e.target.value);
                if (!e.target.value) setIdFile(null);
              }}
              disabled={submitting}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            >
              {DOCUMENT_TYPES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          {documentType && (
            <div className="mb-4">
              <input
                ref={idInput}
                type="file"
                accept={ACCEPTED_TYPES.join(",")}
                className="hidden"
                onChange={handleIdFile}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-xl"
                disabled={submitting}
                onClick={() => idInput.current?.click()}
              >
                <FileCheck2 className="h-4 w-4" />
                {idFile ? `ID attached: ${idFile.name}` : "Attach government ID photo"}
              </Button>
            </div>
          )}

          <input
            ref={selfieInput}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            capture="user"
            className="hidden"
            onChange={handleSelfie}
          />
          <Button
            className="w-full rounded-xl"
            disabled={submitting}
            onClick={() => selfieInput.current?.click()}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
            {submitting ? "Submitting…" : "Take selfie & submit"}
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">
            {ACCEPTED_LABEL} · up to 8MB · selfie at least {MIN_DIMENSION}×{MIN_DIMENSION}px. Use a
            clear, well-lit selfie with your face fully visible.
          </p>
        </>
      )}
    </section>
  );
}
