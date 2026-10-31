"use client";

import clsx from "clsx";
import { useState } from "react";
import { LedgerRow, PageHeader } from "@/components/MerchantBits";
import { Card, EmptyState, ErrorState, Skeleton } from "@/components/ui/primitives";
import { useMerchantQuery } from "@/lib/merchantAuth";
import type { LedgerItem } from "@/lib/types";

const FILTERS: { id: string; label: string; kinds: LedgerItem["kind"][] | null }[] = [
  { id: "all", label: "All", kinds: null },
  { id: "payments", label: "Payments received", kinds: ["payment_received"] },
  { id: "settlements", label: "Settlements", kinds: ["settlement"] },
  { id: "bills", label: "Bills", kinds: ["bill_payment"] },
  { id: "credits", label: "Refunds and reversals", kinds: ["refund", "rent_reversal", "rent_charge"] },
];

export default function Transactions() {
  const [filter, setFilter] = useState("all");
  const q = useMerchantQuery(["activity"], (api) => api.activity());
  const kinds = FILTERS.find((f) => f.id === filter)?.kinds;
  const items = q.data?.filter((i) => !kinds || kinds.includes(i.kind)) ?? [];
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Transactions" subtitle="Money in and out of your account." />
      <div role="tablist" aria-label="Filter transactions" className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f.id} role="tab" aria-selected={filter === f.id} onClick={() => setFilter(f.id)} className={clsx("rounded-full px-3 py-1.5 text-sm font-medium", filter === f.id ? "bg-navy-2 text-white" : "bg-card text-muted ring-1 ring-line hover:text-ink")}>
            {f.label}
          </button>
        ))}
      </div>
      <Card>
        {q.isPending ? <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div> : q.isError ? <ErrorState message={q.error.message} onRetry={() => q.refetch()} /> : items.length === 0 ? <EmptyState title="Nothing here" body="No transactions match this filter." /> : <ul>{items.map((i) => <LedgerRow key={i.id} item={i} />)}</ul>}
      </Card>
    </div>
  );
}
