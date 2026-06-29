import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { lovable } from "@/integrations/lovable/index";
import { ensureUserSetup } from "@/lib/auth-setup";
import { GENDER_OPTIONS, type Gender } from "@/lib/gender";
import {
  COUNTRY_CODES,
  isAtLeast18,
  isDisposableEmail,
  maxAdultBirthDate,
  passwordStrength,
} from "@/lib/registration";
import {
  checkAuthAvailability,
  completePasswordLogin,
  completeRegistrationAudit,
  inspectRegistrationAttempt,
  preparePasswordLogin,
  recordPasswordLoginFailure,
} from "@/lib/registration.functions";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const searchSchema = z.object({
  mode: z.enum(["login", "signup", "forgot", "magic"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Log in or Join - HeartConnect" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AuthPage,
});

const identifierSchema = z
  .string()
  .trim()
  .min(3, "Enter your email or username")
  .max(255, "That sign-in name is too long");

const emailSchema = z.string().trim().email("Enter a valid email").max(255);
const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(24, "Username must be 24 characters or fewer")
  .regex(/^[a-zA-Z0-9_]+$/, "Use letters, numbers, and underscores only")
  .transform((value) => value.toLowerCase());
const nameSchema = z.string().trim().min(1, "Required").max(80, "Keep this under 80 characters");
const passwordSchema = z.string().min(8, "Password must be at least 8 characters").max(72);

type AuthMode = "login" | "signup" | "forgot" | "magic";
type SignupStep = 0 | 1 | 2;

interface SignupForm {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  dateOfBirth: string;
  gender: "" | Gender;
  password: string;
  confirmPassword: string;
  phoneCountryCode: string;
  phoneNumber: string;
  acceptedTerms: boolean;
  acceptedPrivacy: boolean;
}

const initialSignup: SignupForm = {
  firstName: "",
  lastName: "",
  username: "",
  email: "",
  dateOfBirth: "",
  gender: "",
  password: "",
  confirmPassword: "",
  phoneCountryCode: "+1",
  phoneNumber: "",
  acceptedTerms: false,
  acceptedPrivacy: false,
};

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { user, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<AuthMode>(search.mode ?? "login");
  const [signupStep, setSignupStep] = useState<SignupStep>(0);
  const [signup, setSignup] = useState<SignupForm>(initialSignup);
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      navigate({ to: "/discover", replace: true });
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    const saved = window.localStorage.getItem("heartconnect-login-identifier");
    if (saved) setLoginIdentifier(saved);
  }, []);

  const signupErrors = useMemo(() => validateSignup(signup), [signup]);
  const strength = passwordStrength(signup.password);

  useEffect(() => {
    if (mode !== "signup") return;
    const parsedEmail = emailSchema.safeParse(signup.email);
    const parsedUsername = usernameSchema.safeParse(signup.username);
    if (!parsedEmail.success && !parsedUsername.success) {
      setEmailAvailable(null);
      setUsernameAvailable(null);
      return;
    }
    setAvailabilityLoading(true);
    const handle = window.setTimeout(() => {
      checkAuthAvailability({
        data: {
          email: parsedEmail.success ? parsedEmail.data : undefined,
          username: parsedUsername.success ? parsedUsername.data : undefined,
        },
      })
        .then((result) => {
          if (typeof result.emailAvailable === "boolean") setEmailAvailable(result.emailAvailable);
          if (typeof result.usernameAvailable === "boolean") {
            setUsernameAvailable(result.usernameAvailable);
          }
        })
        .catch(() => undefined)
        .finally(() => setAvailabilityLoading(false));
    }, 350);
    return () => window.clearTimeout(handle);
  }, [mode, signup.email, signup.username]);

  const setSignupField = <K extends keyof SignupForm>(key: K, value: SignupForm[K]) => {
    setSignup((current) => ({ ...current, [key]: value }));
    if (key === "email") setEmailAvailable(null);
    if (key === "username") setUsernameAvailable(null);
  };

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setNeedsVerification(false);
    setSignupStep(0);
  };

  const canContinueSignup = (step: SignupStep) => {
    if (step === 0) {
      return (
        !signupErrors.firstName &&
        !signupErrors.lastName &&
        !signupErrors.username &&
        usernameAvailable !== false &&
        !signupErrors.email &&
        emailAvailable !== false
      );
    }
    if (step === 1) {
      return !signupErrors.dateOfBirth && !signupErrors.gender;
    }
    return (
      !signupErrors.password &&
      !signupErrors.confirmPassword &&
      !signupErrors.acceptedTerms &&
      !signupErrors.acceptedPrivacy
    );
  };

  const resendVerification = async () => {
    const targetEmail = mode === "signup" ? signup.email : email || loginIdentifier;
    const parsed = emailSchema.safeParse(targetEmail);
    if (!parsed.success) {
      toast.error("Enter your email first");
      return;
    }
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: parsed.data,
        options: { emailRedirectTo: window.location.origin + "/discover" },
      });
      if (error) throw error;
      toast.success("Verification email sent. Check your inbox.");
    } catch {
      toast.error("Could not resend the verification email. Please try again.");
    } finally {
      setResending(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      toast.error("Enter a valid email");
      return;
    }
    setLoading(true);
    try {
      const decision = await inspectRegistrationAttempt({
        data: { email: parsed.data, eventType: "password_reset_request" },
      });
      if (!decision.ok)
        throw new Error(decision.reason ?? "Please wait before requesting another link.");
      const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
        redirectTo: window.location.origin + "/reset-password",
      });
      if (error) throw error;
      setResetSent(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      toast.error("Enter a valid email");
      return;
    }
    setLoading(true);
    try {
      const decision = await inspectRegistrationAttempt({
        data: { email: parsed.data, eventType: "login_attempt" },
      });
      if (!decision.ok)
        throw new Error(decision.reason ?? "Please wait before requesting another link.");
      const { error } = await supabase.auth.signInWithOtp({
        email: parsed.data,
        options: {
          emailRedirectTo: window.location.origin + "/discover",
          shouldCreateUser: false,
        },
      });
      if (error) throw error;
      setMagicSent(true);
    } catch {
      toast.error("Could not send a sign-in link. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const identifier = identifierSchema.safeParse(loginIdentifier);
    const parsedPassword = passwordSchema.safeParse(loginPassword);
    if (!identifier.success) {
      toast.error(identifier.error.issues[0].message);
      return;
    }
    if (!parsedPassword.success) {
      toast.error(parsedPassword.error.issues[0].message);
      return;
    }
    setNeedsVerification(false);
    setLoading(true);
    try {
      const prepared = await preparePasswordLogin({ data: { identifier: identifier.data } });
      if (!prepared.ok) throw new Error(prepared.reason ?? "Please try again later.");
      if (!prepared.email) throw new Error("Invalid login");

      const decision = await inspectRegistrationAttempt({
        data: { email: prepared.email, eventType: "login_attempt" },
      });
      if (!decision.ok) throw new Error(decision.reason ?? "Too many recent login attempts.");

      const { data, error } = await supabase.auth.signInWithPassword({
        email: prepared.email,
        password: parsedPassword.data,
      });
      if (error) throw error;

      if (data.user) {
        const { data: mod } = await supabase
          .from("user_moderation")
          .select("is_banned, banned_until")
          .eq("user_id", data.user.id)
          .maybeSingle();
        const bannedNow =
          mod?.is_banned &&
          (mod.banned_until === null || new Date(mod.banned_until).getTime() > Date.now());
        if (bannedNow) {
          await supabase.auth.signOut();
          toast.error("This account is temporarily unavailable. Please contact support.");
          return;
        }
        await ensureUserSetup(data.user.id);
        await completePasswordLogin({
          data: {
            userId: data.user.id,
            identifier: identifier.data,
            emailVerified: Boolean(data.user.email_confirmed_at),
          },
        });
      }

      if (rememberMe) {
        window.localStorage.setItem("heartconnect-login-identifier", identifier.data);
      } else {
        window.localStorage.removeItem("heartconnect-login-identifier");
      }
      toast.success("Welcome back!");
      navigate({ to: "/discover" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      if (message.includes("Email not confirmed")) {
        setNeedsVerification(true);
        toast.error("Please verify your email before logging in.");
      } else if (message.toLowerCase().includes("invalid login")) {
        const result = await recordPasswordLoginFailure({
          data: { identifier: identifier.success ? identifier.data : loginIdentifier },
        }).catch(() => null);
        toast.error(result?.reason ?? "The email, username, or password is not correct.");
      } else if (message.toLowerCase().includes("too many attempts")) {
        toast.error(message);
      } else {
        toast.error("We could not sign you in. Please check your details and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signupStep < 2) {
      if (!canContinueSignup(signupStep)) {
        toast.error("Please complete the highlighted fields first.");
        return;
      }
      setSignupStep((signupStep + 1) as SignupStep);
      return;
    }

    const parsedUsername = usernameSchema.safeParse(signup.username);
    const parsedEmail = emailSchema.safeParse(signup.email);
    if (!parsedUsername.success || !parsedEmail.success || !canContinueSignup(2)) {
      toast.error("Please complete all required details.");
      return;
    }
    if (emailAvailable === false || usernameAvailable === false) {
      toast.error("Please choose a different email or username.");
      return;
    }
    setLoading(true);
    try {
      const cleanPhone = signup.phoneNumber.replace(/\D/g, "");
      const decision = await inspectRegistrationAttempt({
        data: {
          email: parsedEmail.data,
          phoneCountryCode: signup.phoneCountryCode,
          phoneNumber: cleanPhone || undefined,
          eventType: "signup_attempt",
        },
      });
      if (!decision.ok) throw new Error(decision.reason ?? "Signup is temporarily unavailable.");

      const { data, error } = await supabase.auth.signUp({
        email: parsedEmail.data,
        password: signup.password,
        options: {
          emailRedirectTo: window.location.origin + "/discover",
          data: {
            first_name: signup.firstName.trim(),
            last_name: signup.lastName.trim(),
            display_name: `${signup.firstName.trim()} ${signup.lastName.trim()}`.trim(),
            username: parsedUsername.data,
            birth_date: signup.dateOfBirth,
            gender: signup.gender,
            phone_country_code: signup.phoneCountryCode,
            phone_number: cleanPhone || null,
            terms_accepted: true,
            privacy_accepted: true,
          },
        },
      });
      if (error) throw error;

      if (data.user) {
        await completeRegistrationAudit({
          data: {
            auditId: decision.auditId,
            userId: data.user.id,
            email: parsedEmail.data,
            firstName: signup.firstName,
            lastName: signup.lastName,
            username: parsedUsername.data,
            dateOfBirth: signup.dateOfBirth,
            gender: signup.gender || undefined,
            phoneCountryCode: signup.phoneCountryCode,
            phoneNumber: cleanPhone || undefined,
            referralCode: localStorage.getItem("heartconnect_referral_code") ?? undefined,
            referralSourceUrl: localStorage.getItem("heartconnect_referral_source") ?? undefined,
          },
        });
        localStorage.removeItem("heartconnect_referral_code");
        localStorage.removeItem("heartconnect_referral_source");
      }
      if (data.session) await supabase.auth.signOut();
      setEmail(parsedEmail.data);
      setEmailSent(true);
      toast.success("Account created. Verify your email to activate it.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not create your account.";
      toast.error(
        message.toLowerCase().includes("already")
          ? "That email or username is already in use."
          : message,
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error("Google sign-in failed. Please try again.");
        setLoading(false);
        return;
      }
      if (result.redirected) return;
      const { data } = await supabase.auth.getUser();
      if (data.user) await ensureUserSetup(data.user.id);
      navigate({ to: "/discover" });
    } catch {
      toast.error("Google sign-in failed.");
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <AuthLayout>
        <MessageState
          icon={Mail}
          title="Check your inbox"
          body={
            <>
              We sent a verification link to{" "}
              <span className="font-medium text-foreground">{signup.email || email}</span>. Click it
              to activate your account, then log in.
            </>
          }
        />
        <Button
          variant="hero"
          className="mt-6 w-full rounded-xl"
          onClick={resendVerification}
          disabled={resending}
        >
          {resending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          Resend verification email
        </Button>
        <Button
          variant="outline"
          className="mt-3 w-full rounded-xl"
          onClick={() => {
            setEmailSent(false);
            switchMode("login");
          }}
        >
          Back to login
        </Button>
      </AuthLayout>
    );
  }

  if (resetSent || magicSent) {
    return (
      <AuthLayout>
        <MessageState
          icon={Mail}
          title="Check your inbox"
          body={
            resetSent ? (
              <>
                If an account exists for{" "}
                <span className="font-medium text-foreground">{email}</span>, we sent a link to
                reset your password.
              </>
            ) : (
              <>
                If your verified account exists, we sent a secure sign-in link to{" "}
                <span className="font-medium text-foreground">{email}</span>.
              </>
            )
          }
        />
        <Button
          variant="outline"
          className="mt-6 w-full rounded-xl"
          onClick={() => {
            setResetSent(false);
            setMagicSent(false);
            switchMode("login");
          }}
        >
          Back to login
        </Button>
      </AuthLayout>
    );
  }

  if (mode === "forgot" || mode === "magic") {
    const isForgot = mode === "forgot";
    return (
      <AuthLayout>
        <div className="text-center">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {isForgot ? "Reset your password" : "Email me a sign-in link"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {isForgot
              ? "Enter your email and we'll send you a reset link."
              : "Use a one-time link for your verified HeartConnect account."}
          </p>
        </div>
        <form onSubmit={isForgot ? handleForgot : handleMagicLink} className="mt-8 space-y-4">
          <FieldMessage
            id="auth-email"
            label="Email"
            error={!email ? null : fieldEmailError(email)}
          >
            <Input
              id="auth-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-xl"
              required
            />
          </FieldMessage>
          <Button
            type="submit"
            variant="hero"
            size="lg"
            className="w-full rounded-xl"
            disabled={loading}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isForgot ? "Send reset link" : "Send magic link"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Back to{" "}
          <button
            type="button"
            className="font-semibold text-primary hover:underline"
            onClick={() => switchMode("login")}
          >
            login
          </button>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout wide={mode === "signup"}>
      <div className="text-center">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          {mode === "signup" ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {mode === "signup"
            ? "Build a verified profile for intentional dating."
            : "Log in with your email or username."}
        </p>
      </div>

      <Button
        type="button"
        variant="outline"
        size="lg"
        className="mt-8 w-full rounded-xl"
        onClick={handleGoogle}
        disabled={loading}
      >
        <GoogleIcon /> Continue with Google
      </Button>

      <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> or use password{" "}
        <span className="h-px flex-1 bg-border" />
      </div>

      {mode === "signup" ? (
        <SignupFormView
          signup={signup}
          step={signupStep}
          errors={signupErrors}
          strength={strength}
          emailAvailable={emailAvailable}
          usernameAvailable={usernameAvailable}
          availabilityLoading={availabilityLoading}
          loading={loading}
          showPassword={showPassword}
          showConfirmPassword={showConfirmPassword}
          onSubmit={handleSignup}
          onBack={() => setSignupStep(Math.max(0, signupStep - 1) as SignupStep)}
          onField={setSignupField}
          onShowPassword={() => setShowPassword((value) => !value)}
          onShowConfirmPassword={() => setShowConfirmPassword((value) => !value)}
        />
      ) : (
        <form onSubmit={handleLogin} className="space-y-4">
          <FieldMessage
            id="login-identifier"
            label="Email or username"
            error={!loginIdentifier ? null : fieldIdentifierError(loginIdentifier)}
          >
            <Input
              id="login-identifier"
              type="text"
              autoComplete="username"
              placeholder="you@example.com or username"
              value={loginIdentifier}
              onChange={(e) => setLoginIdentifier(e.target.value)}
              className="rounded-xl"
              required
            />
          </FieldMessage>
          <FieldMessage id="login-password" label="Password" error={null}>
            <PasswordInput
              id="login-password"
              value={loginPassword}
              onChange={setLoginPassword}
              show={showPassword}
              onToggle={() => setShowPassword((value) => !value)}
              autoComplete="current-password"
            />
          </FieldMessage>
          <div className="flex items-center justify-between gap-3">
            <AgreementCheck
              id="remember-me"
              checked={rememberMe}
              onCheckedChange={setRememberMe}
              label="Remember me"
            />
            <button
              type="button"
              className="text-sm font-medium text-primary hover:underline"
              onClick={() => switchMode("forgot")}
            >
              Forgot password?
            </button>
          </div>
          <Button
            type="submit"
            variant="hero"
            size="lg"
            className="w-full rounded-xl"
            disabled={loading}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Log in
          </Button>
        </form>
      )}

      {mode === "login" && (
        <Button
          type="button"
          variant="ghost"
          className="mt-3 w-full rounded-xl"
          onClick={() => switchMode("magic")}
        >
          Email me a magic link instead
        </Button>
      )}

      {needsVerification && (
        <div className="mt-4 rounded-2xl border border-amber-400/40 bg-amber-50/60 p-3 text-sm dark:bg-amber-950/20">
          <p className="text-muted-foreground">
            Your email is not verified yet. Send a fresh verification link.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2 w-full rounded-xl"
            onClick={resendVerification}
            disabled={resending}
          >
            {resending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Mail className="h-4 w-4" />
            )}
            Resend verification email
          </Button>
        </div>
      )}

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {mode === "signup" ? "Already have an account?" : "New to HeartConnect?"}{" "}
        <button
          type="button"
          className="font-semibold text-primary hover:underline"
          onClick={() => switchMode(mode === "signup" ? "login" : "signup")}
        >
          {mode === "signup" ? "Log in" : "Join free"}
        </button>
      </p>
    </AuthLayout>
  );
}

function SignupFormView({
  signup,
  step,
  errors,
  strength,
  emailAvailable,
  usernameAvailable,
  availabilityLoading,
  loading,
  showPassword,
  showConfirmPassword,
  onSubmit,
  onBack,
  onField,
  onShowPassword,
  onShowConfirmPassword,
}: {
  signup: SignupForm;
  step: SignupStep;
  errors: Record<string, string | null>;
  strength: ReturnType<typeof passwordStrength>;
  emailAvailable: boolean | null;
  usernameAvailable: boolean | null;
  availabilityLoading: boolean;
  loading: boolean;
  showPassword: boolean;
  showConfirmPassword: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
  onField: <K extends keyof SignupForm>(key: K, value: SignupForm[K]) => void;
  onShowPassword: () => void;
  onShowConfirmPassword: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid grid-cols-3 gap-2" aria-label="Registration progress">
        {["Account", "Profile", "Security"].map((label, index) => (
          <div
            key={label}
            className={
              index <= step
                ? "rounded-full bg-primary px-3 py-2 text-center text-xs font-semibold text-primary-foreground"
                : "rounded-full bg-muted px-3 py-2 text-center text-xs font-semibold text-muted-foreground"
            }
          >
            {label}
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldMessage
            id="first-name"
            label="First name"
            error={fieldTouched(signup.firstName, errors.firstName)}
          >
            <Input
              id="first-name"
              autoComplete="given-name"
              value={signup.firstName}
              onChange={(e) => onField("firstName", e.target.value)}
              className="rounded-xl"
              required
            />
          </FieldMessage>
          <FieldMessage
            id="last-name"
            label="Last name"
            error={fieldTouched(signup.lastName, errors.lastName)}
          >
            <Input
              id="last-name"
              autoComplete="family-name"
              value={signup.lastName}
              onChange={(e) => onField("lastName", e.target.value)}
              className="rounded-xl"
              required
            />
          </FieldMessage>
          <FieldMessage
            id="username"
            label="Username"
            error={
              fieldTouched(signup.username, errors.username) ??
              (usernameAvailable === false ? "Username is already taken" : null)
            }
            hint={usernameAvailable === true ? "Username is available" : null}
            loading={availabilityLoading}
          >
            <Input
              id="username"
              autoComplete="username"
              value={signup.username}
              onChange={(e) => onField("username", e.target.value.toLowerCase())}
              className="rounded-xl"
              required
            />
          </FieldMessage>
          <FieldMessage
            id="signup-email"
            label="Email"
            error={
              fieldTouched(signup.email, errors.email) ??
              (emailAvailable === false ? "Email is already registered" : null)
            }
            hint={emailAvailable === true ? "Email is available" : null}
            loading={availabilityLoading}
          >
            <Input
              id="signup-email"
              type="email"
              autoComplete="email"
              value={signup.email}
              onChange={(e) => onField("email", e.target.value)}
              className="rounded-xl"
              required
            />
          </FieldMessage>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldMessage
              id="date-of-birth"
              label="Date of birth"
              error={fieldTouched(signup.dateOfBirth, errors.dateOfBirth)}
            >
              <Input
                id="date-of-birth"
                type="date"
                max={maxAdultBirthDate()}
                value={signup.dateOfBirth}
                onChange={(e) => onField("dateOfBirth", e.target.value)}
                className="rounded-xl"
                required
              />
            </FieldMessage>
            <FieldMessage
              id="gender"
              label="Gender"
              error={fieldTouched(signup.gender, errors.gender)}
            >
              <Select
                value={signup.gender}
                onValueChange={(value) => onField("gender", value as SignupForm["gender"])}
              >
                <SelectTrigger id="gender" className="rounded-xl">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  {GENDER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldMessage>
          </div>
          <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
            <div className="space-y-2">
              <Label htmlFor="phone-code">Code</Label>
              <Select
                value={signup.phoneCountryCode}
                onValueChange={(value) => onField("phoneCountryCode", value)}
              >
                <SelectTrigger id="phone-code" className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRY_CODES.map((item) => (
                    <SelectItem key={`${item.code}-${item.country}`} value={item.code}>
                      {item.code} {item.country}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone number</Label>
              <Input
                id="phone"
                type="tel"
                autoComplete="tel-national"
                inputMode="tel"
                placeholder="Optional"
                value={signup.phoneNumber}
                onChange={(e) => onField("phoneNumber", e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <FieldMessage
            id="signup-password"
            label="Password"
            error={fieldTouched(signup.password, errors.password)}
          >
            <PasswordInput
              id="signup-password"
              value={signup.password}
              onChange={(value) => onField("password", value)}
              show={showPassword}
              onToggle={onShowPassword}
              autoComplete="new-password"
            />
          </FieldMessage>
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
          <FieldMessage
            id="confirm-password"
            label="Confirm password"
            error={fieldTouched(signup.confirmPassword, errors.confirmPassword)}
          >
            <PasswordInput
              id="confirm-password"
              value={signup.confirmPassword}
              onChange={(value) => onField("confirmPassword", value)}
              show={showConfirmPassword}
              onToggle={onShowConfirmPassword}
              autoComplete="new-password"
            />
          </FieldMessage>
          <div className="space-y-3 rounded-2xl border border-border p-3">
            <AgreementCheck
              id="terms-accepted"
              checked={signup.acceptedTerms}
              onCheckedChange={(value) => onField("acceptedTerms", value)}
              label={
                <>
                  I accept the{" "}
                  <Link to="/terms" className="font-medium text-primary hover:underline">
                    Terms
                  </Link>
                  .
                </>
              }
            />
            <AgreementCheck
              id="privacy-accepted"
              checked={signup.acceptedPrivacy}
              onCheckedChange={(value) => onField("acceptedPrivacy", value)}
              label={
                <>
                  I accept the{" "}
                  <Link to="/privacy" className="font-medium text-primary hover:underline">
                    Privacy Policy
                  </Link>
                  .
                </>
              }
            />
          </div>
        </div>
      )}

      <div className="flex gap-3">
        {step > 0 && (
          <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={onBack}>
            Back
          </Button>
        )}
        <Button
          type="submit"
          variant="hero"
          size="lg"
          className="flex-1 rounded-xl"
          disabled={loading}
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {step === 2 ? "Create account" : "Continue"}
        </Button>
      </div>
    </form>
  );
}

function validateSignup(signup: SignupForm) {
  const parsedUsername = usernameSchema.safeParse(signup.username);
  const parsedEmail = emailSchema.safeParse(signup.email);
  return {
    firstName: nameSchema.safeParse(signup.firstName).success ? null : "First name is required",
    lastName: nameSchema.safeParse(signup.lastName).success ? null : "Last name is required",
    username: parsedUsername.success ? null : parsedUsername.error.issues[0].message,
    email: parsedEmail.success
      ? isDisposableEmail(parsedEmail.data)
        ? "Use a permanent email address"
        : null
      : parsedEmail.error.issues[0].message,
    dateOfBirth: isAtLeast18(signup.dateOfBirth) ? null : "You must be at least 18",
    gender: signup.gender ? null : "Select your gender",
    password: passwordStrength(signup.password).valid ? null : "Use a stronger password",
    confirmPassword:
      signup.password && signup.confirmPassword === signup.password ? null : "Passwords must match",
    acceptedTerms: signup.acceptedTerms ? null : "Terms are required",
    acceptedPrivacy: signup.acceptedPrivacy ? null : "Privacy acceptance is required",
  };
}

function fieldEmailError(value: string) {
  const parsed = emailSchema.safeParse(value);
  return parsed.success ? null : parsed.error.issues[0].message;
}

function fieldIdentifierError(value: string) {
  const parsed = identifierSchema.safeParse(value);
  return parsed.success ? null : parsed.error.issues[0].message;
}

function fieldTouched(value: string, error: string | null | undefined) {
  return value ? (error ?? null) : null;
}

function AuthLayout({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="relative grid min-h-dvh place-items-center bg-gradient-warm px-4 py-12">
      <div className="absolute inset-x-0 top-0 flex h-16 items-center justify-between px-4">
        <Link to="/" aria-label="HeartConnect home">
          <Logo />
        </Link>
        <ThemeToggle />
      </div>
      <div
        className={
          wide
            ? "w-full max-w-2xl rounded-3xl border border-border/60 bg-card p-6 shadow-card md:p-8"
            : "w-full max-w-md rounded-3xl border border-border/60 bg-card p-6 shadow-card md:p-8"
        }
      >
        {children}
      </div>
    </div>
  );
}

function MessageState({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Mail;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <div className="text-center">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-accent text-primary">
        <Icon className="h-8 w-8" />
      </span>
      <h1 className="mt-6 font-display text-2xl font-semibold">{title}</h1>
      <p className="mt-3 text-muted-foreground">{body}</p>
    </div>
  );
}

function FieldMessage({
  id,
  label,
  error,
  hint,
  loading,
  children,
}: {
  id: string;
  label: string;
  error: string | null;
  hint?: string | null;
  loading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      <div className="min-h-5 text-xs">
        {loading ? (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking
          </span>
        ) : error ? (
          <span className="inline-flex items-center gap-1.5 text-destructive">
            <AlertCircle className="h-3.5 w-3.5" /> {error}
          </span>
        ) : hint ? (
          <span className="inline-flex items-center gap-1.5 text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" /> {hint}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function PasswordInput({
  id,
  value,
  onChange,
  show,
  onToggle,
  autoComplete,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  onToggle: () => void;
  autoComplete: string;
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        placeholder="At least 8 characters"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl pr-11"
        required
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
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

function AgreementCheck({
  id,
  checked,
  onCheckedChange,
  label,
}: {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        className="mt-0.5"
      />
      <Label htmlFor={id} className="text-sm leading-5 text-muted-foreground">
        {label}
      </Label>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}
