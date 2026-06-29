import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import type { PaystackEvent } from "@/lib/paystack.server";

/**
 * Paystack webhook. Verifies the x-paystack-signature (HMAC SHA512 of the raw
 * body with the secret key) before processing, then idempotently fulfills the
 * transaction. Lives under /api/public/* so external Paystack servers can reach
 * it without an app session.
 */
export const Route = createFileRoute("/api/public/paystack-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.PAYSTACK_SECRET_KEY;
        if (!secret) return new Response("Not configured", { status: 500 });

        const body = await request.text();
        const signature = request.headers.get("x-paystack-signature") ?? "";
        const expected = createHmac("sha512", secret).update(body).digest("hex");

        const sigBuf = Buffer.from(signature);
        const expBuf = Buffer.from(expected);
        if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let event: PaystackEvent;
        try {
          event = JSON.parse(body);
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        if (!event.event) return new Response("ok");

        try {
          const { handleWebhookEvent } = await import("@/lib/paystack.server");
          // Signature is verified; dispatch to the matching event handler.
          // Charge/invoice payments are re-verified against Paystack inside.
          const result = await handleWebhookEvent(event);
          console.log("[paystack-webhook]", event.event, result.status);
        } catch (err) {
          console.error("[paystack-webhook]", event.event, err);
          // Return 200 so Paystack does not hammer retries on transient errors;
          // the verify-on-redirect path is a second safety net for charges.
          return new Response("received");
        }

        return new Response("ok");
      },
    },
  },
});
