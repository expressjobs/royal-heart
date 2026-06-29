import { useCallback, useEffect, useMemo, useState } from "react";
import { Crown, Loader2, Search, Shield, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/contexts/AuthContext";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PanelLoader } from "@/components/admin/shared";
import { photoPath } from "@/lib/profiles";

interface StaffRow {
  user_id: string;
  display_name: string | null;
  primary_photo: string | null;
  roles: AppRole[];
}

const ROLE_LABEL: Record<AppRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  moderator: "Moderator",
  user: "Member",
};

/**
 * Role & access management. Admins can review staff roles. Role changes are
 * enforced by owner-only SECURITY DEFINER functions and RLS; the owner account
 * must be configured in Supabase app_security_settings.
 */
export function RoleManagement() {
  const { isSuperAdmin, user } = useAuth();
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  // grant flow
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    { id: string; display_name: string | null; primary_photo: string | null }[]
  >([]);
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    const { data: roleRows } = await supabase.from("user_roles").select("user_id, role");
    const rows = roleRows ?? [];

    const staffRows = rows.filter((r) => r.role !== "user");
    const ids = Array.from(new Set(staffRows.map((r) => r.user_id)));
    let names = new Map<string, string | null>();
    const photos = new Map<string, string | null>();
    if (ids.length > 0) {
      const [{ data: profs }, { data: pics }] = await Promise.all([
        supabase.from("profiles").select("id, display_name").in("id", ids),
        supabase
          .from("profile_photos")
          .select("user_id, url, storage_path, is_primary, position")
          .in("user_id", ids)
          .order("is_primary", { ascending: false })
          .order("position", { ascending: true }),
      ]);
      names = new Map((profs ?? []).map((p) => [p.id, p.display_name]));
      (pics ?? []).forEach((p) => {
        const path = photoPath(p);
        if (path && !photos.get(p.user_id)) photos.set(p.user_id, path);
      });
    }
    const grouped = new Map<string, StaffRow>();
    staffRows.forEach((r) => {
      const existing = grouped.get(r.user_id);
      if (existing) existing.roles.push(r.role as AppRole);
      else
        grouped.set(r.user_id, {
          user_id: r.user_id,
          display_name: names.get(r.user_id) ?? null,
          primary_photo: photos.get(r.user_id) ?? null,
          roles: [r.role as AppRole],
        });
    });
    setStaff(Array.from(grouped.values()));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runSearch = async () => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name")
      .ilike("display_name", `%${q}%`)
      .eq("is_demo_profile", false)
      .limit(8);
    const ids = (data ?? []).map((d) => d.id);
    const photos = new Map<string, string>();
    if (ids.length) {
      const { data: pics } = await supabase
        .from("profile_photos")
        .select("user_id, url, storage_path, is_primary, position")
        .in("user_id", ids)
        .order("is_primary", { ascending: false })
        .order("position", { ascending: true });
      (pics ?? []).forEach((p) => {
        const path = photoPath(p);
        if (path && !photos.get(p.user_id)) photos.set(p.user_id, path);
      });
    }
    setResults((data ?? []).map((d) => ({ ...d, primary_photo: photos.get(d.id) ?? null })));
    setSearching(false);
  };

  const assignRole = async (userId: string, role: AppRole, name: string) => {
    setBusyId(userId);
    const { error } = await supabase.rpc("admin_assign_role", { _user_id: userId, _role: role });
    setBusyId(null);
    if (error) {
      toast.error(error.message || "Could not assign role.");
      return;
    }
    toast.success(`${name} is now ${ROLE_LABEL[role]}`);
    setResults([]);
    setQuery("");
    await load();
  };

  const revokeRole = async (userId: string, role: AppRole, name: string) => {
    setBusyId(userId);
    const { error } = await supabase.rpc("admin_revoke_role", { _user_id: userId, _role: role });
    setBusyId(null);
    if (error) {
      toast.error(error.message || "Could not revoke role.");
      return;
    }
    toast.success(`Removed ${ROLE_LABEL[role]} from ${name}`);
    await load();
  };

  const staffSorted = useMemo(
    () =>
      [...staff].sort((a, b) => {
        const rank = (r: StaffRow) =>
          r.roles.includes("super_admin") ? 3 : r.roles.includes("admin") ? 2 : 1;
        return rank(b) - rank(a);
      }),
    [staff],
  );

  if (loading) return <PanelLoader />;

  return (
    <div className="space-y-5">
      {/* Grant roles (owner enforced server-side) */}
      {isSuperAdmin && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <h3 className="mb-1 flex items-center gap-2 font-semibold">
            <UserPlus className="h-4 w-4 text-primary" /> Grant a role
          </h3>
          <p className="mb-3 text-sm text-muted-foreground">
            Search for a member, then assign Admin or Super Admin. The server accepts role changes
            only from the configured owner account.
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
                placeholder="Search member by name…"
                className="rounded-full pl-9"
              />
            </div>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={runSearch}
              disabled={searching}
            >
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
            </Button>
          </div>
          {results.length > 0 && (
            <ul className="mt-3 space-y-2">
              {results.map((r) => {
                const name = r.display_name ?? "Member";
                return (
                  <li
                    key={r.id}
                    className="flex items-center gap-3 rounded-xl border border-border p-2"
                  >
                    <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg">
                      <ProfilePhoto path={r.primary_photo} alt={name} />
                    </div>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full"
                      disabled={busyId === r.id}
                      onClick={() => assignRole(r.id, "admin", name)}
                    >
                      <Shield className="h-4 w-4" /> Admin
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full"
                      disabled={busyId === r.id}
                      onClick={() => assignRole(r.id, "super_admin", name)}
                    >
                      <Crown className="h-4 w-4" /> Super Admin
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Current staff */}
      <div>
        <h3 className="mb-2 font-semibold">Staff &amp; roles</h3>
        {staffSorted.length === 0 ? (
          <EmptyState>No staff roles assigned yet.</EmptyState>
        ) : (
          <ul className="space-y-2">
            {staffSorted.map((s) => {
              const name = s.display_name ?? "Member";
              const isSelf = s.user_id === user?.id;
              return (
                <li
                  key={s.user_id}
                  className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3"
                >
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl">
                    <ProfilePhoto path={s.primary_photo} alt={name} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="truncate font-medium">{name}</span>
                    {isSelf && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}
                    <div className="mt-1 flex flex-wrap gap-1">
                      {s.roles
                        .filter((r) => r !== "user")
                        .map((r) => (
                          <Badge
                            key={r}
                            variant="outline"
                            className={
                              r === "super_admin"
                                ? "border-amber-400/50 text-amber-600 dark:text-amber-400"
                                : r === "admin"
                                  ? "border-primary/40 text-primary"
                                  : ""
                            }
                          >
                            {r === "super_admin" && <Crown className="mr-1 h-3 w-3" />}
                            {ROLE_LABEL[r]}
                          </Badge>
                        ))}
                    </div>
                  </div>
                  {isSuperAdmin && (
                    <div className="flex flex-wrap gap-2">
                      {s.roles.includes("admin") && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full"
                          disabled={busyId === s.user_id}
                          onClick={() => revokeRole(s.user_id, "admin", name)}
                        >
                          <UserMinus className="h-4 w-4" /> Admin
                        </Button>
                      )}
                      {s.roles.includes("super_admin") && !isSelf && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full"
                          disabled={busyId === s.user_id}
                          onClick={() => revokeRole(s.user_id, "super_admin", name)}
                        >
                          <UserMinus className="h-4 w-4" /> Super Admin
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
