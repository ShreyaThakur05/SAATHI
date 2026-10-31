"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Chip } from "@/components/Chip";
import { Badge, Card, EmptyState, ErrorState, Skeleton, inputClass } from "@/components/ui/primitives";
import { useStaff, useStaffQuery } from "@/lib/auth";

export default function Merchants() {
  const { api } = useStaff();
  const [q, setQ] = useState("");
  const list = useStaffQuery(["merchants", q], () => api.merchants(q.trim() || undefined), { refetchInterval: 6000 });
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-heading">Merchants</h1>
        <p className="text-sm text-muted">Open a merchant to see their profile, location, live device connections and history.</p>
      </header>
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <input aria-label="Search merchants" placeholder="Search by name or city" value={q} onChange={(e) => setQ(e.target.value)} className={`${inputClass} pl-9`} />
      </div>
      <Card>
        {list.isPending ? <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div> : list.isError ? <ErrorState message={list.error.message} onRetry={() => list.refetch()} /> : list.data.length === 0 ? <EmptyState title="No merchants match" /> : (
          <ul>
            {list.data.map((m) => (
              <li key={m.id} className="border-b border-line last:border-0">
                <Link href={`/console/merchants/${m.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-surface">
                  <span aria-hidden className="flex size-10 items-center justify-center rounded-full bg-navy-2/10 font-bold text-link">{m.name.charAt(0)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{m.name}</span>
                    <span className="block text-xs text-muted">{m.category} · {m.city}</span>
                  </span>
                  {m.open_cases > 0 && <Badge tone="warn">{m.open_cases} open</Badge>}
                  <Chip status={m.kyc_status === "VERIFIED" ? "VERIFIED" : "PENDING"} label={`KYC ${m.kyc_status.toLowerCase()}`} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
