import { useEffect, useState } from "react";
import { Globe } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { listPaystackTransactions } from "@/lib/paystack.functions";
import { formatPrice } from "@/lib/membership";
import { PanelLoader } from "@/components/admin/shared";

type Txn = Awaited<ReturnType<typeof listPaystackTransactions>>[number];

function formatDate(d: string): string {
  return new Date(d).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const METHOD_LABELS: Record<string, string> = {
  mpesa: "M-Pesa",
  card: "Card",
  apple_pay: "Apple Pay",
  bank_transfer: "Bank transfer",
  pesalink: "PesaLink",
  other: "Other",
};

const STATUS_CLASS: Record<string, string> = {
  succeeded: "bg-success/10 text-success",
  pending: "bg-amber-500/10 text-amber-600",
  failed: "bg-destructive/10 text-destructive",
  refunded: "bg-muted text-muted-foreground",
};

export function TransactionsLedger() {
  const run = useServerFn(listPaystackTransactions);
  const [rows, setRows] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    run({})
      .then((data) => setRows(data))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <PanelLoader />;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">All transactions ({rows.length})</h3>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
          <Globe className="h-3.5 w-3.5" /> Website: HeartConnect
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No transactions yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[920px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="p-3 font-medium">Date</th>
                <th className="p-3 font-medium">User</th>
                <th className="p-3 font-medium">Email</th>
                <th className="p-3 font-medium">Plan</th>
                <th className="p-3 font-medium">Amount</th>
                <th className="p-3 font-medium">Method</th>
                <th className="p-3 font-medium">Reference</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Website</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/50 last:border-0">
                  <td className="p-3 whitespace-nowrap">{formatDate(r.created_at)}</td>
                  <td className="p-3">{r.member}</td>
                  <td className="p-3 text-muted-foreground">{r.email ?? "—"}</td>
                  <td className="p-3">{r.plan ?? "—"}</td>
                  <td className="p-3 tabular-nums">{formatPrice(r.amount_cents, r.currency)}</td>
                  <td className="p-3">
                    {r.payment_method ? (METHOD_LABELS[r.payment_method] ?? r.payment_method) : "—"}
                  </td>
                  <td className="p-3 font-mono text-xs">{r.reference ?? "—"}</td>
                  <td className="p-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                        STATUS_CLASS[r.status] ?? "bg-muted text-muted-foreground"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="p-3 font-medium">{r.website}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
