import type { PaymentRow } from "@/lib/subscriptions";
import { formatPrice } from "@/lib/membership";

/** Generate a printable HTML invoice and trigger a download (client-side, no deps). */
export function downloadInvoice(payment: PaymentRow, memberName: string | null) {
  const date = new Date(payment.created_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const amount = formatPrice(payment.amount_cents, payment.currency);
  const esc = (s: string) =>
    s.replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
    );

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Invoice ${esc(payment.invoice_number ?? "")}</title>
<style>
  body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a2e;max-width:680px;margin:40px auto;padding:0 24px}
  h1{font-size:22px;margin:0}
  .brand{color:#e94560;font-weight:700;letter-spacing:.3px}
  .muted{color:#6b7280;font-size:13px}
  .row{display:flex;justify-content:space-between;margin:6px 0}
  table{width:100%;border-collapse:collapse;margin-top:24px}
  th,td{text-align:left;padding:10px 0;border-bottom:1px solid #eee;font-size:14px}
  td:last-child,th:last-child{text-align:right}
  .total{font-weight:700;font-size:16px}
  .badge{display:inline-block;padding:2px 10px;border-radius:999px;background:#f1f5f9;font-size:12px}
</style></head><body>
  <div class="row" style="align-items:flex-start">
    <div><h1 class="brand">HeartConnect</h1><div class="muted">Membership receipt</div></div>
    <div style="text-align:right">
      <div><strong>Invoice</strong> ${esc(payment.invoice_number ?? payment.id)}</div>
      <div class="muted">${esc(date)}</div>
      <div class="badge">${esc(payment.status)}</div>
    </div>
  </div>
  <div style="margin-top:24px">
    <div class="muted">Billed to</div>
    <div>${esc(memberName ?? "HeartConnect member")}</div>
  </div>
  <table>
    <thead><tr><th>Description</th><th>Provider</th><th>Amount</th></tr></thead>
    <tbody>
      <tr><td>${esc(payment.description ?? "Membership")}</td><td>${esc(payment.provider)}</td><td>${esc(amount)}</td></tr>
      ${payment.coupon_code ? `<tr><td>Promo code applied</td><td>${esc(payment.coupon_code)}</td><td></td></tr>` : ""}
    </tbody>
    <tfoot><tr class="total"><td colspan="2">Total</td><td>${esc(amount)}</td></tr></tfoot>
  </table>
  <p class="muted" style="margin-top:32px">Thank you for being part of HeartConnect. Questions? Reach out from your settings page.</p>
</body></html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `invoice-${payment.invoice_number ?? payment.id}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
