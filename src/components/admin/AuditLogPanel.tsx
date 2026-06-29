import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { EmptyState, PanelLoader } from "@/components/admin/shared";

type AuditRow = Database["public"]["Tables"]["profile_audit_log"]["Row"];
type AdminAuditRow = Database["public"]["Tables"]["admin_audit_log"]["Row"];

interface AuditWithNames extends AuditRow {
  memberName: string;
  changedByName: string;
}

interface AdminAuditWithName extends AdminAuditRow {
  actorName: string;
}

const FIELD_LABELS: Record<string, string> = {
  membership_tier: "Membership tier",
  is_featured: "Featured status",
  is_verified: "Verification",
  is_banned: "Account ban",
};

const ACTION_LABELS: Record<string, string> = {
  "banner.create": "Created a banner",
  "banner.update": "Updated a banner",
  "banner.delete": "Deleted a banner",
  "blog.create": "Created a blog post",
  "blog.update": "Updated a blog post",
  "blog.delete": "Deleted a blog post",
  "settings.update": "Updated site settings",
  "role.update": "Changed a user role",
};

export function AuditLogPanel() {
  const [auditLog, setAuditLog] = useState<AuditWithNames[]>([]);
  const [adminLog, setAdminLog] = useState<AdminAuditWithName[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: rows }, { data: adminRows }] = await Promise.all([
        supabase
          .from("profile_audit_log")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(150),
        supabase
          .from("admin_audit_log")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(150),
      ]);
      const list = rows ?? [];
      const adminList = adminRows ?? [];
      const ids = [
        ...new Set(
          [
            ...list.flatMap((a) => [a.profile_id, a.changed_by]),
            ...adminList.map((a) => {
              const details = a.details as Record<string, unknown> | null;
              return typeof details?.admin_id === "string" ? details.admin_id : null;
            }),
          ].filter(Boolean) as string[],
        ),
      ];
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("id, display_name").in("id", ids)
        : { data: [] as { id: string; display_name: string | null }[] };
      const nameById = new Map((profs ?? []).map((p) => [p.id, p.display_name ?? "Member"]));
      setAuditLog(
        list.map((a) => ({
          ...a,
          memberName: nameById.get(a.profile_id) ?? "Member",
          changedByName: a.changed_by ? (nameById.get(a.changed_by) ?? "Admin") : "System",
        })),
      );
      setAdminLog(
        adminList.map((a) => ({
          ...a,
          actorName: (() => {
            const details = a.details as Record<string, unknown> | null;
            const actorId = typeof details?.admin_id === "string" ? details.admin_id : null;
            return actorId ? (nameById.get(actorId) ?? "Admin") : "System";
          })(),
        })),
      );
      setLoading(false);
    })();
  }, []);

  if (loading) return <PanelLoader />;

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h3 className="font-semibold">Admin actions</h3>
        <p className="text-sm text-muted-foreground">
          Banner, blog, settings, and role changes — most recent first.
        </p>
        {adminLog.length === 0 ? (
          <EmptyState>No admin actions recorded yet.</EmptyState>
        ) : (
          <ul className="space-y-2">
            {adminLog.map((a) => (
              <li key={a.id} className="rounded-2xl border border-border bg-card p-4">
                <p className="font-medium">{ACTION_LABELS[a.action] ?? a.action}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  by {a.actorName} · {new Date(a.created_at).toLocaleString()}
                  {a.entity_id && ` · ${a.entity_type ?? "item"} ${a.entity_id.slice(0, 8)}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold">Member changes</h3>
        <p className="text-sm text-muted-foreground">
          Membership tier, featured, verification, and ban changes.
        </p>
        {auditLog.length === 0 ? (
          <EmptyState>No changes recorded yet.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {auditLog.map((a) => (
              <li key={a.id} className="rounded-2xl border border-border bg-card p-4">
                <p className="font-medium">
                  {FIELD_LABELS[a.field_name] ?? a.field_name}{" "}
                  <span className="text-muted-foreground">for</span> {a.memberName}
                </p>
                <p className="mt-1 text-sm">
                  <span className="text-muted-foreground line-through">{a.old_value ?? "—"}</span>{" "}
                  <span className="text-muted-foreground">→</span>{" "}
                  <span className="font-medium text-primary">{a.new_value ?? "—"}</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  by {a.changedByName} · {new Date(a.created_at).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
