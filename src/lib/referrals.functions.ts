import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireServerAdmin } from "@/lib/server-auth";
import { writeAdminAuditWarning } from "@/lib/admin-audit";
import { structuredAdminError, type StructuredAdminError } from "@/lib/admin-errors";
import { getImageInfo, type ImageFormat } from "./image-validation";

const BUCKET = "profile-photos";
const MARKETER_BUCKET = "marketer-assets";
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ACCEPTED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const EXT_BY_FORMAT: Record<ImageFormat, string> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
};

const marketerSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  fullName: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(255).nullable().optional().or(z.literal("")),
  phone: z.string().trim().max(40).nullable().optional(),
  country: z.string().trim().max(120).nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  brandName: z.string().trim().max(160).nullable().optional(),
  bio: z.string().trim().max(1000).nullable().optional(),
  socialLinks: z.record(z.string().trim().max(1000)).optional().default({}),
  marketingChannel: z.string().trim().max(160).nullable().optional(),
  applicationReason: z.string().trim().max(1000).nullable().optional(),
  referralCode: z.string().trim().max(40).optional(),
  referralSlug: z.string().trim().max(80).optional(),
  commissionRate: z.number().min(0).max(1).default(0.15),
  status: z.enum(["pending", "active", "suspended", "inactive"]).default("pending"),
  payoutMethod: z.string().trim().max(80).nullable().optional(),
  payoutAccountName: z.string().trim().max(160).nullable().optional(),
  payoutAccountDetails: z.string().trim().max(1000).nullable().optional(),
});

const marketerApplicationSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  phone: z.string().trim().min(3).max(40),
  country: z.string().trim().min(2).max(120),
  city: z.string().trim().max(120).optional(),
  brandName: z.string().trim().max(160).optional(),
  marketingChannel: z.string().trim().min(2).max(160),
  applicationReason: z.string().trim().min(10).max(1000),
  socialLinks: z.record(z.string().trim().max(1000)).optional().default({}),
});

const promoMaterialSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).optional().nullable(),
  imageUrl: z.string().trim().max(1000).optional().nullable(),
  whatsappCaption: z.string().trim().max(2000).optional().nullable(),
  facebookCaption: z.string().trim().max(2000).optional().nullable(),
  tiktokCaption: z.string().trim().max(2000).optional().nullable(),
  referralCta: z.string().trim().max(200).optional().default("Join HeartConnect today"),
  isActive: z.boolean().default(true),
});

function normalizeCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 24);
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function fallbackCode(name: string) {
  const base = normalizeCode(name).slice(0, 10) || "PARTNER";
  return `${base}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

async function auditAdminAction(
  actorId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  details: Record<string, unknown> = {},
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await writeAdminAuditWarning(supabaseAdmin, {
    actorId,
    action,
    entityType,
    entityId,
    details,
  });
}

export const captureReferralVisit = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        code: z.string().trim().min(2).max(80),
        sourceUrl: z.string().trim().max(1000).optional(),
        landingPath: z.string().trim().max(500).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; code?: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const code = normalizeCode(data.code);
    if (!code) return { ok: false };
    const { data: marketer } = await supabaseAdmin
      .from("marketers" as never)
      .select("id, referral_code, status")
      .eq("referral_code", code)
      .maybeSingle();
    const row = marketer as unknown as { id: string; referral_code: string; status: string } | null;
    if (!row || row.status !== "active") return { ok: false };
    const { data: click } = await supabaseAdmin
      .from("marketer_clicks" as never)
      .insert({
        marketer_id: row.id,
        referral_code: row.referral_code,
        source_url: data.sourceUrl ?? null,
        landing_path: data.landingPath ?? null,
      } as never)
      .select("id")
      .maybeSingle();
    await supabaseAdmin.from("referrals" as never).insert({
      marketer_id: row.id,
      referral_code: row.referral_code,
      source_url: data.sourceUrl ?? null,
      click_id: (click as unknown as { id?: string } | null)?.id ?? null,
      landing_path: data.landingPath ?? null,
      status: "visited",
    } as never);
    return { ok: true, code: row.referral_code };
  });

export async function attachReferralSignup(args: {
  userId: string;
  referralCode?: string | null;
  sourceUrl?: string | null;
}) {
  const code = normalizeCode(args.referralCode ?? "");
  if (!code) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: existing } = await supabaseAdmin
    .from("referrals" as never)
    .select("id")
    .eq("referred_user_id", args.userId)
    .maybeSingle();
  if (existing) return;

  const { data: marketer } = await supabaseAdmin
    .from("marketers" as never)
    .select("id, referral_code, status")
    .eq("referral_code", code)
    .maybeSingle();
  const row = marketer as unknown as { id: string; referral_code: string; status: string } | null;
  if (!row || row.status !== "active") return;

  const { data: visit } = await supabaseAdmin
    .from("referrals" as never)
    .select("id")
    .eq("marketer_id", row.id)
    .eq("referral_code", row.referral_code)
    .is("referred_user_id", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const visitId = (visit as unknown as { id?: string } | null)?.id;
  if (visitId) {
    await supabaseAdmin
      .from("referrals" as never)
      .update({
        referred_user_id: args.userId,
        source_url: args.sourceUrl ?? null,
        status: "signup",
        converted_at: new Date().toISOString(),
      } as never)
      .eq("id", visitId);
  } else {
    await supabaseAdmin.from("referrals" as never).insert({
      marketer_id: row.id,
      referred_user_id: args.userId,
      referral_code: row.referral_code,
      source_url: args.sourceUrl ?? null,
      status: "signup",
      converted_at: new Date().toISOString(),
    } as never);
  }
}

export async function createCommissionForPayment(args: {
  paymentId: string;
  userId: string;
  grossAmount: number;
  currency: string;
  tier: string;
}) {
  if (args.tier !== "gold" && args.tier !== "platinum") return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: existing } = await supabaseAdmin
    .from("marketer_commissions" as never)
    .select("id")
    .eq("payment_id", args.paymentId)
    .maybeSingle();
  if (existing) return;
  const { data: referral } = await supabaseAdmin
    .from("referrals" as never)
    .select("id, marketer_id, referred_user_id, marketer:marketers(id, commission_rate, status)")
    .eq("referred_user_id", args.userId)
    .maybeSingle();
  const row = referral as unknown as {
    id: string;
    marketer_id: string;
    marketer?: { commission_rate?: number; status?: string } | null;
  } | null;
  if (!row || row.marketer?.status !== "active") return;
  const rate = Number(row.marketer?.commission_rate ?? 0.15);
  const commissionAmount = Math.round(args.grossAmount * rate * 100) / 100;
  await supabaseAdmin.from("marketer_commissions" as never).insert({
    marketer_id: row.marketer_id,
    referred_user_id: args.userId,
    payment_id: args.paymentId,
    gross_amount: args.grossAmount,
    commission_rate: rate,
    commission_amount: commissionAmount,
    currency: args.currency || "KES",
    status: "pending",
  } as never);
  await supabaseAdmin
    .from("referrals" as never)
    .update({ status: "paid", converted_at: new Date().toISOString() } as never)
    .eq("id", row.id);
}

export async function reverseCommissionForPayment(paymentId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("marketer_commissions" as never)
    .update({ status: "reversed" } as never)
    .eq("payment_id", paymentId)
    .neq("status", "paid");
}

export interface MarketerDashboardRow {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  profile_photo_url: string | null;
  profile_photo_path: string | null;
  brand_name: string | null;
  bio: string | null;
  social_links: Record<string, string>;
  marketing_channel: string | null;
  application_reason: string | null;
  referral_code: string;
  referral_slug: string;
  commission_rate: number;
  status: string;
  payout_method: string | null;
  payout_account_name: string | null;
  payout_account_details: string | null;
  created_at: string;
  visits: number;
  total_clicks: number;
  signups: number;
  paid_clients: number;
  conversion_rate: number;
  pending_commission: number;
  paid_commission: number;
}

export interface PromoMaterialRow {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  image_path: string | null;
  whatsapp_caption: string | null;
  facebook_caption: string | null;
  tiktok_caption: string | null;
  referral_cta: string;
  is_active: boolean;
  created_at: string;
}

export interface MarketerPayoutRow {
  id: string;
  amount: number;
  currency: string;
  status: string;
  payout_method: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface MarketerReferralRow {
  id: string;
  marketer_id: string;
  referral_code: string | null;
  referred_user_id: string | null;
  status: string | null;
  created_at: string;
}

export interface MarketerCommissionRow {
  id: string;
  marketer_id: string;
  referred_user_id: string | null;
  payment_id: string | null;
  commission_amount: number;
  currency: string | null;
  status: string;
  created_at: string;
  paid_at: string | null;
}

export interface MyMarketerDashboard {
  marketer: MarketerDashboardRow | null;
  referrals: MarketerReferralRow[];
  commissions: MarketerCommissionRow[];
  payouts: MarketerPayoutRow[];
  promoMaterials: PromoMaterialRow[];
}

type AdminMutationResult =
  | { ok: true; id?: string; url?: string; path?: string }
  | ({ ok: false; error: string } & StructuredAdminError);

export const listAdminMarketers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MarketerDashboardRow[]> => {
    await requireServerAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [
      { data: marketers, error: marketersError },
      { data: referrals, error: referralsError },
      { data: clicks, error: clicksError },
      { data: commissions, error: commissionsError },
    ] = await Promise.all([
      supabaseAdmin
        .from("marketers" as never)
        .select("*")
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("referrals" as never).select("marketer_id, referred_user_id, status"),
      supabaseAdmin.from("marketer_clicks" as never).select("marketer_id"),
      supabaseAdmin
        .from("marketer_commissions" as never)
        .select("marketer_id, commission_amount, status, referred_user_id"),
    ]);
    if (marketersError) throw structuredAdminError(marketersError, "marketers.list");
    if (referralsError) throw structuredAdminError(referralsError, "referrals.list");
    if (clicksError) throw structuredAdminError(clicksError, "marketer_clicks.list");
    if (commissionsError) throw structuredAdminError(commissionsError, "marketer_commissions.list");
    const refRows = (referrals ?? []) as unknown as Array<{
      marketer_id: string;
      referred_user_id: string | null;
      status: string;
    }>;
    const commissionRows = (commissions ?? []) as unknown as Array<{
      marketer_id: string;
      commission_amount: number;
      status: string;
      referred_user_id: string | null;
    }>;
    const clickRows = (clicks ?? []) as unknown as Array<{ marketer_id: string }>;
    return ((marketers ?? []) as unknown as MarketerDashboardRow[]).map((m) => {
      const refs = refRows.filter((r) => r.marketer_id === m.id);
      const totalClicks = clickRows.filter((r) => r.marketer_id === m.id).length || refs.length;
      const comms = commissionRows.filter((c) => c.marketer_id === m.id);
      const signups = refs.filter((r) => Boolean(r.referred_user_id)).length;
      return {
        ...m,
        commission_rate: Number(m.commission_rate ?? 0.15),
        social_links: (m.social_links ?? {}) as Record<string, string>,
        visits: refs.length,
        total_clicks: totalClicks,
        signups,
        paid_clients: new Set(
          comms.filter((c) => c.status !== "reversed").map((c) => c.referred_user_id),
        ).size,
        conversion_rate: totalClicks > 0 ? Math.round((signups / totalClicks) * 1000) / 10 : 0,
        pending_commission: comms
          .filter((c) => c.status === "pending")
          .reduce((sum, c) => sum + Number(c.commission_amount), 0),
        paid_commission: comms
          .filter((c) => c.status === "paid")
          .reduce((sum, c) => sum + Number(c.commission_amount), 0),
      };
    });
  });

export const saveAdminMarketer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => marketerSchema.parse(data))
  .handler(async ({ data, context }): Promise<AdminMutationResult> => {
    try {
      await requireServerAdmin(context.supabase, context.userId);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const code = normalizeCode(data.referralCode || fallbackCode(data.fullName));
      const slug = slugify(data.referralSlug || data.fullName || code) || code.toLowerCase();
      const payload = {
        user_id: data.id ? undefined : null,
        full_name: data.fullName,
        email: data.email || null,
        phone: data.phone || null,
        country: data.country || null,
        city: data.city || null,
        brand_name: data.brandName || null,
        bio: data.bio || null,
        social_links: data.socialLinks,
        marketing_channel: data.marketingChannel || null,
        application_reason: data.applicationReason || null,
        referral_code: code,
        referral_slug: slug,
        commission_rate: data.commissionRate,
        status: data.status,
        payout_method: data.payoutMethod || null,
        payout_account_name: data.payoutAccountName || null,
        payout_account_details: data.payoutAccountDetails || null,
        approved_at: data.status === "active" ? new Date().toISOString() : null,
        approved_by: data.status === "active" ? context.userId : null,
        suspended_at: data.status === "suspended" ? new Date().toISOString() : null,
        suspended_by: data.status === "suspended" ? context.userId : null,
        updated_at: new Date().toISOString(),
      };
      if (data.id) {
        const { error } = await supabaseAdmin
          .from("marketers" as never)
          .update(payload as never)
          .eq("id", data.id);
        if (error) throw error;
        await auditAdminAction(context.userId, "marketer.update", "marketer", data.id, payload);
        return { ok: true, id: data.id };
      }
      const { data: created, error } = await supabaseAdmin
        .from("marketers" as never)
        .insert({ ...payload, created_by: context.userId } as never)
        .select("id")
        .single();
      if (error) throw error;
      const id = (created as unknown as { id: string }).id;
      await auditAdminAction(context.userId, "marketer.create", "marketer", id, payload);
      return { ok: true, id };
    } catch (error) {
      const structured = structuredAdminError(error, "marketer.save", "Could not save marketer.");
      return {
        ok: false,
        ...structured,
        error: structured.message,
      };
    }
  });

export const markCommissionPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<AdminMutationResult> => {
    try {
      await requireServerAdmin(context.supabase, context.userId);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: commission, error: loadError } = await supabaseAdmin
        .from("marketer_commissions" as never)
        .select("id, marketer_id, commission_amount, currency, status")
        .eq("id", data.id)
        .maybeSingle();
      if (loadError) throw loadError;
      if (!commission) {
        const structured = structuredAdminError(
          new Error("Commission not found."),
          "commission.load",
        );
        return { ok: false, ...structured, error: structured.message };
      }
      const row = commission as unknown as {
        marketer_id: string;
        commission_amount: number;
        currency: string | null;
        status: string;
      };
      if (row.status !== "pending") return { ok: true };

      const paidAt = new Date().toISOString();
      const { data: payout, error: payoutError } = await supabaseAdmin
        .from("marketer_payouts" as never)
        .insert({
          marketer_id: row.marketer_id,
          amount: row.commission_amount,
          currency: row.currency ?? "KES",
          status: "paid",
          paid_at: paidAt,
          created_by: context.userId,
          metadata: { source: "manual_commission_mark_paid", commission_id: data.id },
        } as never)
        .select("id")
        .single();
      if (payoutError) throw payoutError;
      const payoutId = (payout as unknown as { id: string }).id;
      const { error } = await supabaseAdmin
        .from("marketer_commissions" as never)
        .update({
          status: "paid",
          paid_at: paidAt,
          paid_by: context.userId,
          payout_id: payoutId,
        } as never)
        .eq("id", data.id)
        .eq("status", "pending");
      if (error) throw error;
      await auditAdminAction(context.userId, "commission.paid", "marketer_commission", data.id);
      return { ok: true };
    } catch (error) {
      const structured = structuredAdminError(
        error,
        "commission.mark_paid",
        "Could not mark commission paid.",
      );
      return {
        ok: false,
        ...structured,
        error: structured.message,
      };
    }
  });

export const listAdminReferralDetails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ userId: z.string().uuid().optional(), marketerId: z.string().uuid().optional() })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireServerAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const referralQuery = supabaseAdmin
      .from("referrals" as never)
      .select("*, marketer:marketers(full_name, referral_code)")
      .order("created_at", { ascending: false })
      .limit(200);
    const commissionQuery = supabaseAdmin
      .from("marketer_commissions" as never)
      .select(
        "*, marketer:marketers(full_name, referral_code), payment:payments(description, reference, status)",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.userId) {
      referralQuery.eq("referred_user_id", data.userId);
      commissionQuery.eq("referred_user_id", data.userId);
    }
    if (data.marketerId) {
      referralQuery.eq("marketer_id", data.marketerId);
      commissionQuery.eq("marketer_id", data.marketerId);
    }
    const [
      { data: referrals, error: referralError },
      { data: commissions, error: commissionError },
      { data: payments, error: paymentError },
    ] = await Promise.all([
      referralQuery,
      commissionQuery,
      data.userId
        ? supabaseAdmin
            .from("payments")
            .select("id, created_at, description, amount_cents, currency, status, reference")
            .eq("user_id", data.userId)
            .order("created_at", { ascending: false })
            .limit(50)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (referralError) throw referralError;
    if (commissionError) throw commissionError;
    if (paymentError) throw paymentError;
    return { referrals: referrals ?? [], commissions: commissions ?? [], payments: payments ?? [] };
  });

export const applyForMarketer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => marketerApplicationSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(context.userId);
      const email = authUser.user?.email ?? null;
      const code = fallbackCode(data.fullName);
      const slug = slugify(data.brandName || data.fullName || code) || code.toLowerCase();
      const { error } = await supabaseAdmin.from("marketers" as never).upsert(
        {
          user_id: context.userId,
          full_name: data.fullName,
          email,
          phone: data.phone,
          country: data.country,
          city: data.city || null,
          brand_name: data.brandName || null,
          marketing_channel: data.marketingChannel,
          application_reason: data.applicationReason,
          social_links: data.socialLinks,
          referral_code: code,
          referral_slug: slug,
          commission_rate: 0.15,
          status: "pending",
          updated_at: new Date().toISOString(),
        } as never,
        { onConflict: "user_id" },
      );
      if (error) throw error;
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Could not submit application.",
      };
    }
  });

export const updateMyMarketerProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        fullName: z.string().trim().min(2).max(160),
        phone: z.string().trim().max(40).optional(),
        country: z.string().trim().max(120).optional(),
        city: z.string().trim().max(120).optional(),
        brandName: z.string().trim().max(160).optional(),
        bio: z.string().trim().max(1000).optional(),
        socialLinks: z.record(z.string().trim().max(1000)).optional().default({}),
        payoutMethod: z.string().trim().max(80).optional(),
        payoutAccountName: z.string().trim().max(160).optional(),
        payoutAccountDetails: z.string().trim().max(1000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin
        .from("marketers" as never)
        .update({
          full_name: data.fullName,
          phone: data.phone || null,
          country: data.country || null,
          city: data.city || null,
          brand_name: data.brandName || null,
          bio: data.bio || null,
          social_links: data.socialLinks,
          payout_method: data.payoutMethod || null,
          payout_account_name: data.payoutAccountName || null,
          payout_account_details: data.payoutAccountDetails || null,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("user_id", context.userId);
      if (error) throw error;
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Could not update marketer profile.",
      };
    }
  });

export const getMyMarketerDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyMarketerDashboard> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: marketer } = await supabaseAdmin
      .from("marketers" as never)
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    const marketerRow = marketer as unknown as MarketerDashboardRow | null;
    const { data: promos } = await supabaseAdmin
      .from("promo_materials" as never)
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (!marketerRow) {
      return {
        marketer: null,
        referrals: [],
        commissions: [],
        payouts: [],
        promoMaterials: (promos ?? []) as unknown as PromoMaterialRow[],
      };
    }
    const [{ data: referrals }, { data: clicks }, { data: commissions }, { data: payouts }] =
      await Promise.all([
        supabaseAdmin
          .from("referrals" as never)
          .select("*")
          .eq("marketer_id", marketerRow.id)
          .order("created_at", { ascending: false })
          .limit(200),
        supabaseAdmin
          .from("marketer_clicks" as never)
          .select("id")
          .eq("marketer_id", marketerRow.id),
        supabaseAdmin
          .from("marketer_commissions" as never)
          .select("*")
          .eq("marketer_id", marketerRow.id)
          .order("created_at", { ascending: false })
          .limit(200),
        supabaseAdmin
          .from("marketer_payouts" as never)
          .select("*")
          .eq("marketer_id", marketerRow.id)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);
    const refRows = (referrals ?? []) as Array<{ referred_user_id?: string | null }>;
    const commissionRows = (commissions ?? []) as Array<{
      commission_amount?: number;
      status?: string;
      referred_user_id?: string | null;
    }>;
    const totalClicks = (clicks ?? []).length || refRows.length;
    const signups = refRows.filter((r) => Boolean(r.referred_user_id)).length;
    const enriched: MarketerDashboardRow = {
      ...marketerRow,
      social_links: (marketerRow.social_links ?? {}) as Record<string, string>,
      commission_rate: Number(marketerRow.commission_rate ?? 0.15),
      visits: refRows.length,
      total_clicks: totalClicks,
      signups,
      paid_clients: new Set(
        commissionRows.filter((c) => c.status !== "reversed").map((c) => c.referred_user_id),
      ).size,
      conversion_rate: totalClicks > 0 ? Math.round((signups / totalClicks) * 1000) / 10 : 0,
      pending_commission: commissionRows
        .filter((c) => c.status === "pending")
        .reduce((sum, c) => sum + Number(c.commission_amount ?? 0), 0),
      paid_commission: commissionRows
        .filter((c) => c.status === "paid")
        .reduce((sum, c) => sum + Number(c.commission_amount ?? 0), 0),
    };
    return {
      marketer: enriched,
      referrals: (referrals ?? []) as unknown as MarketerReferralRow[],
      commissions: (commissions ?? []) as unknown as MarketerCommissionRow[],
      payouts: (payouts ?? []) as unknown as MarketerPayoutRow[],
      promoMaterials: (promos ?? []) as unknown as PromoMaterialRow[],
    };
  });

async function uploadMarketerAsset(args: {
  file: File;
  ownerId: string;
  prefix: "profile" | "promo";
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (!ACCEPTED_MIME.has(args.file.type)) throw new Error("Upload JPG, PNG, or WebP.");
  if (args.file.size > MAX_FILE_BYTES) throw new Error("Image must be under 8MB.");
  const bytes = new Uint8Array(await args.file.arrayBuffer());
  const info = getImageInfo(bytes);
  if (!info || !ACCEPTED_MIME.has(`image/${info.format}`)) {
    throw new Error("File contents do not match a supported image type.");
  }
  const path = `${args.ownerId}/${args.prefix}/${crypto.randomUUID()}.${EXT_BY_FORMAT[info.format]}`;
  const { error } = await supabaseAdmin.storage.from(MARKETER_BUCKET).upload(path, bytes, {
    cacheControl: "3600",
    upsert: false,
    contentType: `image/${info.format}`,
  });
  if (error) throw error;
  const { data } = supabaseAdmin.storage.from(MARKETER_BUCKET).getPublicUrl(path);
  return { path, url: data.publicUrl };
}

export const uploadMyMarketerPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error("Expected form data");
    const file = data.get("file");
    if (!(file instanceof File)) throw new Error("No file provided.");
    return { file };
  })
  .handler(async ({ data, context }): Promise<{ ok: boolean; url?: string; error?: string }> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const uploaded = await uploadMarketerAsset({
        file: data.file,
        ownerId: context.userId,
        prefix: "profile",
      });
      const { error } = await supabaseAdmin
        .from("marketers" as never)
        .update({
          profile_photo_url: uploaded.url,
          profile_photo_path: uploaded.path,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("user_id", context.userId);
      if (error) throw error;
      return { ok: true, url: uploaded.url };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Could not upload photo.",
      };
    }
  });

export const saveAdminPromoMaterial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => promoMaterialSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ ok: boolean; id?: string; error?: string }> => {
    try {
      await requireServerAdmin(context.supabase, context.userId);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const payload = {
        title: data.title,
        description: data.description || null,
        image_url: data.imageUrl || null,
        whatsapp_caption: data.whatsappCaption || null,
        facebook_caption: data.facebookCaption || null,
        tiktok_caption: data.tiktokCaption || null,
        referral_cta: data.referralCta,
        is_active: data.isActive,
        updated_at: new Date().toISOString(),
      };
      if (data.id) {
        const { error } = await supabaseAdmin
          .from("promo_materials" as never)
          .update(payload as never)
          .eq("id", data.id);
        if (error) throw error;
        return { ok: true, id: data.id };
      }
      const { data: created, error } = await supabaseAdmin
        .from("promo_materials" as never)
        .insert({ ...payload, created_by: context.userId } as never)
        .select("id")
        .single();
      if (error) throw error;
      return { ok: true, id: (created as unknown as { id: string }).id };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Could not save promo material.",
      };
    }
  });

export const listAdminPromoMaterials = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PromoMaterialRow[]> => {
    await requireServerAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("promo_materials" as never)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as PromoMaterialRow[];
  });

export const uploadAdminPromoImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error("Expected form data");
    const file = data.get("file");
    if (!(file instanceof File)) throw new Error("No file provided.");
    return { file };
  })
  .handler(
    async ({
      data,
      context,
    }): Promise<{ ok: boolean; url?: string; path?: string; error?: string }> => {
      try {
        await requireServerAdmin(context.supabase, context.userId);
        const uploaded = await uploadMarketerAsset({
          file: data.file,
          ownerId: context.userId,
          prefix: "promo",
        });
        return { ok: true, ...uploaded };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : "Could not upload image.",
        };
      }
    },
  );

export interface AdminMemberPhotoRow {
  id: string;
  user_id: string;
  url: string;
  storage_path: string | null;
  is_primary: boolean;
  is_private: boolean;
  position: number;
  moderation_status: string;
  created_at: string;
}

export const listAdminMemberPhotos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<AdminMemberPhotoRow[]> => {
    await requireServerAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("profile_photos" as never)
      .select(
        "id, user_id, url, storage_path, is_primary, is_private, position, moderation_status, created_at",
      )
      .eq("user_id", data.userId)
      .order("position", { ascending: true });
    if (error) throw error;
    return (rows ?? []) as unknown as AdminMemberPhotoRow[];
  });

export const uploadAdminMemberPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error("Expected form data");
    const userId = data.get("user_id");
    const file = data.get("file");
    if (typeof userId !== "string" || !z.string().uuid().safeParse(userId).success) {
      throw new Error("Invalid member.");
    }
    if (!(file instanceof File)) throw new Error("No file provided.");
    return { userId, file };
  })
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    try {
      await requireServerAdmin(context.supabase, context.userId);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      if (!ACCEPTED_MIME.has(data.file.type))
        return { ok: false, error: "Upload JPG, PNG, or WebP." };
      if (data.file.size > MAX_FILE_BYTES)
        return { ok: false, error: "Each photo must be under 8MB." };
      const { count } = await supabaseAdmin
        .from("profile_photos")
        .select("id", { count: "exact", head: true })
        .eq("user_id", data.userId);
      if ((count ?? 0) >= 6) return { ok: false, error: "This member already has 6 photos." };
      const bytes = new Uint8Array(await data.file.arrayBuffer());
      const info = getImageInfo(bytes);
      if (!info || !ACCEPTED_MIME.has(`image/${info.format}`)) {
        return { ok: false, error: "File contents do not match a supported image type." };
      }
      const path = `${data.userId}/${crypto.randomUUID()}.${EXT_BY_FORMAT[info.format]}`;
      const { error: uploadError } = await supabaseAdmin.storage.from(BUCKET).upload(path, bytes, {
        cacheControl: "3600",
        upsert: false,
        contentType: `image/${info.format}`,
      });
      if (uploadError) throw uploadError;
      const position = count ?? 0;
      const { error } = await supabaseAdmin.from("profile_photos").insert({
        user_id: data.userId,
        url: path,
        storage_path: path,
        is_primary: position === 0,
        is_private: false,
        position,
        moderation_status: "approved",
      } as never);
      if (error) {
        await supabaseAdmin.storage.from(BUCKET).remove([path]);
        throw error;
      }
      await auditAdminAction(context.userId, "member_photo.upload", "profile", data.userId);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Could not upload photo.",
      };
    }
  });

export const replaceAdminMemberPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error("Expected form data");
    const userId = data.get("user_id");
    const photoId = data.get("photo_id");
    const file = data.get("file");
    if (typeof userId !== "string" || !z.string().uuid().safeParse(userId).success) {
      throw new Error("Invalid member.");
    }
    if (typeof photoId !== "string" || !z.string().uuid().safeParse(photoId).success) {
      throw new Error("Invalid photo.");
    }
    if (!(file instanceof File)) throw new Error("No file provided.");
    return { userId, photoId, file };
  })
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    try {
      await requireServerAdmin(context.supabase, context.userId);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      if (!ACCEPTED_MIME.has(data.file.type))
        return { ok: false, error: "Upload JPG, PNG, or WebP." };
      if (data.file.size > MAX_FILE_BYTES)
        return { ok: false, error: "Each photo must be under 8MB." };
      const { data: existing } = await supabaseAdmin
        .from("profile_photos")
        .select("id, url, storage_path")
        .eq("id", data.photoId)
        .eq("user_id", data.userId)
        .maybeSingle();
      if (!existing) return { ok: false, error: "Photo not found." };
      const bytes = new Uint8Array(await data.file.arrayBuffer());
      const info = getImageInfo(bytes);
      if (!info || !ACCEPTED_MIME.has(`image/${info.format}`)) {
        return { ok: false, error: "File contents do not match a supported image type." };
      }
      const path = `${data.userId}/${crypto.randomUUID()}.${EXT_BY_FORMAT[info.format]}`;
      const { error: uploadError } = await supabaseAdmin.storage.from(BUCKET).upload(path, bytes, {
        cacheControl: "3600",
        upsert: false,
        contentType: `image/${info.format}`,
      });
      if (uploadError) throw uploadError;
      const { error } = await supabaseAdmin
        .from("profile_photos")
        .update({
          url: path,
          storage_path: path,
          is_private: false,
          moderation_status: "approved",
        } as never)
        .eq("id", data.photoId)
        .eq("user_id", data.userId);
      if (error) {
        await supabaseAdmin.storage.from(BUCKET).remove([path]);
        throw error;
      }
      const oldPath = existing.storage_path || existing.url;
      if (oldPath && shouldRemoveStoragePath(oldPath)) {
        await supabaseAdmin.storage.from(BUCKET).remove([oldPath]);
      }
      await auditAdminAction(context.userId, "member_photo.replace", "profile", data.userId, {
        photoId: data.photoId,
      });
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Could not replace photo.",
      };
    }
  });

function shouldRemoveStoragePath(path: string) {
  return (
    Boolean(path) &&
    !path.startsWith("/") &&
    !path.startsWith("http://") &&
    !path.startsWith("https://") &&
    !path.startsWith("demo-library/") &&
    !path.startsWith("seed-profiles/")
  );
}

export const updateAdminMemberPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        photoId: z.string().uuid(),
        action: z.enum(["primary", "approve", "reject", "public", "private", "replace-url"]),
        url: z.string().trim().max(500).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    try {
      await requireServerAdmin(context.supabase, context.userId);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      if (data.action === "primary") {
        const { error: clearPrimaryError } = await supabaseAdmin
          .from("profile_photos")
          .update({ is_primary: false })
          .eq("user_id", data.userId);
        if (clearPrimaryError) throw clearPrimaryError;
        const { error: setPrimaryError } = await supabaseAdmin
          .from("profile_photos" as never)
          .update({ is_primary: true, is_private: false, moderation_status: "approved" } as never)
          .eq("id", data.photoId)
          .eq("user_id", data.userId);
        if (setPrimaryError) throw setPrimaryError;
      } else {
        const patch =
          data.action === "approve"
            ? { moderation_status: "approved" }
            : data.action === "reject"
              ? { moderation_status: "rejected", is_primary: false }
              : data.action === "public"
                ? { is_private: false }
                : data.action === "private"
                  ? { is_private: true, is_primary: false }
                  : { url: data.url, storage_path: data.url };
        const { error: updateError } = await supabaseAdmin
          .from("profile_photos")
          .update(patch as never)
          .eq("id", data.photoId)
          .eq("user_id", data.userId);
        if (updateError) throw updateError;
      }
      await auditAdminAction(
        context.userId,
        `member_photo.${data.action}`,
        "profile",
        data.userId,
        {
          photoId: data.photoId,
        },
      );
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Could not update photo.",
      };
    }
  });

export const reorderAdminMemberPhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ userId: z.string().uuid(), photoIds: z.array(z.string().uuid()).max(6) })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    try {
      await requireServerAdmin(context.supabase, context.userId);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const results = await Promise.all(
        data.photoIds.map((id, position) =>
          supabaseAdmin
            .from("profile_photos")
            .update({ position })
            .eq("id", id)
            .eq("user_id", data.userId),
        ),
      );
      const error = results.find((result) => result.error)?.error;
      if (error) throw error;
      await auditAdminAction(context.userId, "member_photo.reorder", "profile", data.userId);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Could not reorder photos.",
      };
    }
  });

export const deleteAdminMemberPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ userId: z.string().uuid(), photoId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    try {
      await requireServerAdmin(context.supabase, context.userId);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: photo, error: loadError } = await supabaseAdmin
        .from("profile_photos")
        .select("id, url, storage_path, is_primary")
        .eq("id", data.photoId)
        .eq("user_id", data.userId)
        .maybeSingle();
      if (loadError) throw loadError;
      if (!photo) return { ok: false, error: "Photo not found." };
      const { error: deleteError } = await supabaseAdmin
        .from("profile_photos")
        .delete()
        .eq("id", data.photoId)
        .eq("user_id", data.userId);
      if (deleteError) throw deleteError;
      const path = photo.storage_path || photo.url;
      if (path && shouldRemoveStoragePath(path))
        await supabaseAdmin.storage.from(BUCKET).remove([path]);
      if (photo.is_primary) {
        const { data: next } = await supabaseAdmin
          .from("profile_photos")
          .select("id")
          .eq("user_id", data.userId)
          .order("position", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (next) {
          const { error: nextPrimaryError } = await supabaseAdmin
            .from("profile_photos")
            .update({ is_primary: true })
            .eq("id", next.id);
          if (nextPrimaryError) throw nextPrimaryError;
        }
      }
      await auditAdminAction(context.userId, "member_photo.delete", "profile", data.userId, {
        photoId: data.photoId,
      });
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Could not delete photo.",
      };
    }
  });
