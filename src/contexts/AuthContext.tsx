import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { recordLoginEvent } from "@/lib/account-security.functions";
import { ensureUserSetup } from "@/lib/auth-setup";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type AppRole = Database["public"]["Enums"]["app_role"];

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  /** True for admin or super_admin. */
  isAdmin: boolean;
  /** Highest role only. */
  isSuperAdmin: boolean;
  /** True for moderator, admin, or super_admin. */
  isModerator: boolean;
  loading: boolean;
  /** True when the profile fetch/creation failed (network/RLS). */
  profileError: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState(false);

  const loadProfileAndRole = useCallback(async (uid: string) => {
    try {
      setProfileError(false);
      const { data: initialProfile, error: profErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", uid)
        .maybeSingle();
      if (profErr) throw profErr;
      let prof = initialProfile;

      // No profile row yet (e.g. user arrived via email-confirmation link and
      // never hit the login/onboarding setup path). Create defaults and retry.
      if (!prof) {
        await ensureUserSetup(uid);
        const retry = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
        if (retry.error) throw retry.error;
        prof = retry.data;
      }

      const { data: roleRows, error: roleErr } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid);
      if (roleErr) throw roleErr;

      setProfile(prof ?? null);
      setRoles((roleRows ?? []).map((r) => r.role as AppRole));
    } catch (err) {
      console.error("Failed to load profile/roles", err);
      setProfileError(true);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    await loadProfileAndRole(user.id);
  }, [user, loadProfileAndRole]);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        if (event === "SIGNED_IN" && typeof sessionStorage !== "undefined") {
          const key = `hc-login-recorded-${newSession.user.id}-${newSession.expires_at ?? "session"}`;
          if (!sessionStorage.getItem(key)) {
            sessionStorage.setItem(key, "1");
            setTimeout(() => {
              void recordLoginEvent().catch(() => {
                /* login history should never block app access */
              });
            }, 0);
          }
        }
        // defer supabase calls out of the callback
        setTimeout(() => {
          loadProfileAndRole(newSession.user.id);
        }, 0);
      } else {
        setProfile(null);
        setRoles([]);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        loadProfileAndRole(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, [loadProfileAndRole]);

  // Keep last_active fresh once per session load.
  useEffect(() => {
    if (user) {
      supabase.from("profiles").update({ last_active: new Date().toISOString() }).eq("id", user.id);
    }
  }, [user]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setRoles([]);
  }, []);

  const isSuperAdmin = roles.includes("super_admin");
  const isAdmin = isSuperAdmin || roles.includes("admin");
  const isModerator = isAdmin || roles.includes("moderator");

  const value = useMemo(
    () => ({
      user,
      session,
      profile,
      roles,
      isAdmin,
      isSuperAdmin,
      isModerator,
      loading,
      profileError,
      refreshProfile,
      signOut,
    }),
    [
      user,
      session,
      profile,
      roles,
      isAdmin,
      isSuperAdmin,
      isModerator,
      loading,
      profileError,
      refreshProfile,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function ageFromBirthDate(birth: string | null): number | null {
  if (!birth) return null;
  const d = new Date(birth);
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}
