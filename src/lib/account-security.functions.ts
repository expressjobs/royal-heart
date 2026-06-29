import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface LoginHistoryRow {
  id: string;
  created_at: string;
  event_type: string;
  ip_address: string | null;
  user_agent: string | null;
  success?: boolean;
  failure_reason?: string | null;
}

const loginHistoryTable = "login_history" as never;

function requestIp(): string | null {
  const request = getRequest();
  const forwarded = request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    forwarded ||
    request?.headers.get("cf-connecting-ip") ||
    request?.headers.get("x-real-ip") ||
    null
  );
}

export const recordLoginEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: boolean }> => {
    const request = getRequest();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from(loginHistoryTable).insert({
      user_id: context.userId,
      event_type: "login",
      ip_address: requestIp(),
      user_agent: request?.headers.get("user-agent")?.slice(0, 500) ?? null,
    } as never);
    return { ok: true };
  });

export const listMyLoginHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LoginHistoryRow[]> => {
    const { data, error } = await context.supabase
      .from(loginHistoryTable)
      .select("id, created_at, event_type, ip_address, user_agent")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw error;
    return (data ?? []) as unknown as LoginHistoryRow[];
  });

export const listAdminLoginHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    if (
      !data ||
      typeof data !== "object" ||
      typeof (data as { userId?: unknown }).userId !== "string"
    ) {
      throw new Error("A user is required.");
    }
    return { userId: (data as { userId: string }).userId };
  })
  .handler(async ({ data, context }): Promise<LoginHistoryRow[]> => {
    const { requireServerAdmin } = await import("@/lib/server-auth");
    await requireServerAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from(loginHistoryTable)
      .select("id, created_at, event_type, ip_address, user_agent, success, failure_reason")
      .eq("user_id", data.userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    return (rows ?? []) as unknown as LoginHistoryRow[];
  });

export const createAdminPasswordResetLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    if (
      !data ||
      typeof data !== "object" ||
      typeof (data as { userId?: unknown }).userId !== "string"
    ) {
      throw new Error("A user is required.");
    }
    return { userId: (data as { userId: string }).userId };
  })
  .handler(async ({ data, context }): Promise<{ actionLink: string | null }> => {
    const { requireServerAdmin } = await import("@/lib/server-auth");
    await requireServerAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: authUser, error: userError } = await supabaseAdmin.auth.admin.getUserById(
      data.userId,
    );
    if (userError || !authUser.user?.email) throw new Error("Could not find this member.");
    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: authUser.user.email,
    });
    if (error) throw error;
    return { actionLink: link.properties?.action_link ?? null };
  });
