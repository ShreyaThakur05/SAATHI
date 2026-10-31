"use client";

import { AskSaathiButton, PageHeader } from "@/components/MerchantBits";
import { Chip } from "@/components/Chip";
import { Card, EmptyState, ErrorState, Skeleton } from "@/components/ui/primitives";
import { formatDate, formatInr } from "@/lib/format";
import { useMerchantQuery } from "@/lib/merchantAuth";

export default function Bills() {
  const q = useMerchantQuery(["bills"], (api) => api.bills());
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Bills and refunds" subtitle="Bill payments and recharges you made, and any refunds." />
      {q.isPending ? <Skeleton className="h-56" /> : q.isError ? <ErrorState message={q.error.message} onRetry={() => q.refetch()} /> : q.data.length === 0 ? (
        <Card><EmptyState title="No bill payments yet" /></Card>
      ) : (
        <Card>
          <ul>
            {q.data.map((b) => {
              const needsRefund = b.debited && b.biller_status === "FAILED" && !b.refund;
              return (
                <li key={b.txn} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-4 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">{b.biller}</p>
                    <p className="font-mono text-xs text-muted">{b.txn} · {formatDate(b.paid_at, true)}</p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums">{formatInr(b.amount_inr)}</p>
                  <div className="flex items-center gap-2">
                    <Chip status={b.biller_status === "SUCCESS" ? "SUCCESS" : b.biller_status} label={b.biller_status === "SUCCESS" ? "Bill paid" : b.biller_status === "FAILED" ? "Bill failed" : "Bill pending"} />
                    {b.refund && <Chip status={b.refund.status} label={b.refund.status === "SUCCESS" ? "Refunded" : `Refund ${b.refund.status.toLowerCase()}`} />}
                  </div>
                  {needsRefund && <AskSaathiButton text={`My ${b.biller} bill payment failed but the money was debited`} label="Get my refund" />}
                  {b.refund && <p className="basis-full font-mono text-xs text-muted">Refund reference {b.refund.refund_id}</p>}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
