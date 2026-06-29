import { createFileRoute } from "@tanstack/react-router";

/**
 * Installment maintenance job. Call on a schedule (e.g. daily via pg_cron or an
 * external scheduler) with the header `x-cron-secret: <INSTALLMENT_CRON_SECRET>`.
 *
 * - Sends a reminder notification when the next installment is due within 3 days.
 * - Marks plans overdue and downgrades the member to Free when an installment is
 *   past its due date, until they resume payment.
 *
 * Lives under /api/public/* so an external scheduler can reach it without an app
 * session; the shared secret authenticates the caller.
 */
export const Route = createFileRoute("/api/public/installment-reminders")({
  server: {
    handlers: {
      POST: handler,
      GET: handler,
    },
  },
});

const REMINDER_WINDOW_DAYS = 3;

async function handler({ request }: { request: Request }) {
  const secret = process.env.INSTALLMENT_CRON_SECRET;
  if (!secret) {
    return Response.json(
      { ok: false, disabled: true, reason: "Installment reminders are not configured." },
      { status: 404 },
    );
  }

  const provided = request.headers.get("x-cron-secret") ?? "";
  if (provided !== secret) return new Response("Unauthorized", { status: 401 });

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date();
  const soon = new Date(now.getTime() + REMINDER_WINDOW_DAYS * 86400000);

  const { data: active } = await supabaseAdmin
    .from("payment_installments")
    .select("*")
    .eq("status", "active");

  let reminded = 0;
  let downgraded = 0;

  for (const inst of active ?? []) {
    if (!inst.next_due_at) continue;
    const due = new Date(inst.next_due_at);
    const meta = (inst.metadata as Record<string, unknown>) ?? {};

    // Overdue → downgrade to Free and flag the plan.
    if (due.getTime() < now.getTime()) {
      await supabaseAdmin
        .from("payment_installments")
        .update({ status: "overdue" })
        .eq("id", inst.id);
      await supabaseAdmin
        .from("subscriptions")
        .update({ status: "past_due" })
        .eq("user_id", inst.user_id)
        .in("status", ["active", "trialing"]);
      await supabaseAdmin
        .from("profiles")
        .update({ membership_tier: "free" })
        .eq("id", inst.user_id);
      await supabaseAdmin.rpc("create_notification", {
        _user_id: inst.user_id,
        _type: "payment",
        _title: "Installment overdue",
        _body:
          "Your Gold Annual installment is past due, so your account has moved to Free. " +
          "Pay the next installment to restore Gold access.",
        _data: { installment_id: inst.id },
      });
      downgraded++;
      continue;
    }

    // Due soon → send a reminder once per due date.
    if (due.getTime() <= soon.getTime() && meta.reminder_sent_for !== inst.next_due_at) {
      const remaining = inst.total_installments - inst.installments_paid;
      await supabaseAdmin.rpc("create_notification", {
        _user_id: inst.user_id,
        _type: "payment",
        _title: "Next installment due soon",
        _body:
          `Your next Gold Annual installment (${inst.installments_paid + 1} of ${inst.total_installments}) ` +
          `is due on ${due.toLocaleDateString()}. ${remaining} payment(s) left to unlock full annual access.`,
        _data: { installment_id: inst.id },
      });
      await supabaseAdmin
        .from("payment_installments")
        .update({ metadata: { ...meta, reminder_sent_for: inst.next_due_at } })
        .eq("id", inst.id);
      reminded++;
    }
  }

  return Response.json({ ok: true, reminded, downgraded });
}
