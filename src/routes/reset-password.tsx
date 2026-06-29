import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { AlertCircle, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { passwordStrength } from "@/lib/registration";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — HeartConnect" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ResetPasswordPage,
});

const passwordSchema = z.string().min(8, "Password must be at least 8 characters").max(72);

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [validSession, setValidSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Supabase establishes a temporary recovery session from the URL hash.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setValidSession(true);
        setReady(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setValidSession(true);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    if (!passwordStrength(password).valid) {
      toast.error("Choose a stronger password.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: parsed.data });
      if (error) throw error;
      toast.success("Password updated. You're all set!");
      navigate({ to: "/discover" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setLoading(false);
    }
  };

  const strength = passwordStrength(password);

  return (
    <div className="relative grid min-h-dvh place-items-center bg-gradient-warm px-4 py-12">
      <div className="absolute inset-x-0 top-0 flex h-16 items-center justify-between px-4">
        <Link to="/" aria-label="HeartConnect home">
          <Logo />
        </Link>
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md rounded-3xl border border-border/60 bg-card p-6 shadow-card md:p-8">
        {!ready ? (
          <div className="grid h-40 place-items-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !validSession ? (
          <div className="text-center">
            <h1 className="font-display text-2xl font-semibold">Link expired</h1>
            <p className="mt-3 text-muted-foreground">
              This password reset link is invalid or has expired. Request a new one from the login
              page.
            </p>
            <Button asChild variant="outline" className="mt-6 w-full rounded-xl">
              <Link to="/auth" search={{ mode: "forgot" }}>
                Request a new link
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="text-center">
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-accent text-primary">
                <ShieldCheck className="h-8 w-8" />
              </span>
              <h1 className="mt-6 font-display text-2xl font-semibold">Set a new password</h1>
              <p className="mt-2 text-muted-foreground">
                Choose a strong password you'll remember.
              </p>
            </div>
            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rounded-xl"
                  required
                />
              </div>
              <div className="space-y-3 rounded-2xl border border-border bg-muted/30 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">Password strength</span>
                  <span className="text-xs text-muted-foreground">{strength.label}</span>
                </div>
                <Progress value={strength.percent} className="h-2" />
                <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                  <PasswordRule met={strength.checks.length} label="8+ characters" />
                  <PasswordRule met={strength.checks.upper} label="Uppercase letter" />
                  <PasswordRule met={strength.checks.lower} label="Lowercase letter" />
                  <PasswordRule met={strength.checks.number} label="Number" />
                  <PasswordRule met={strength.checks.symbol} label="Symbol" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="rounded-xl"
                  required
                />
              </div>
              <Button
                type="submit"
                variant="hero"
                size="lg"
                className="w-full rounded-xl"
                disabled={loading}
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Update password
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function PasswordRule({ met, label }: { met: boolean; label: string }) {
  return (
    <span
      className={met ? "flex items-center gap-1.5 text-emerald-600" : "flex items-center gap-1.5"}
    >
      {met ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
      {label}
    </span>
  );
}
