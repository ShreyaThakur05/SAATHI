"use client";

import clsx from "clsx";
import { useState } from "react";
import { ApprovalCard } from "@/components/ApprovalCard";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/primitives";
import { useStaff, useStaffQuery } from "@/lib/auth";

const TABS = [
  { id: "PENDING", label: "Waiting for you" },
  { id: "APPROVED", label: "Approved" },
  { id: "REJECTED", label: "Declined" },
] as const;

export default function ApprovalsPage() {
  const { api, user } = useStaff();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("PENDING");
  const q = useStaffQuery(["approvals", tab], () => api.approvals(tab), { refetchInterval: 3000 });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-heading">Approvals</h1>
        <p className="text-sm text-muted">
          Saathi prepares the case and the evidence. You make the judgement call, in one click.
          {user && user.role === "AGENT" && " You are signed in as an agent, so these are read-only."}
        </p>
      </header>
      <div role="tablist" className="flex gap-2">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={clsx("rounded-full px-3 py-1.5 text-sm font-medium", tab === t.id ? "bg-navy-2 text-white" : "bg-card text-muted ring-1 ring-line hover:text-ink")}>
            {t.label}
          </button>
        ))}
      </div>
      {q.isPending ? (
        <div className="space-y-3"><Skeleton className="h-56" /><Skeleton className="h-56" /></div>
      ) : q.isError ? (
        <ErrorState message={q.error.message} onRetry={() => q.refetch()} />
      ) : q.data.items.length === 0 ? (
        <div className="rounded-xl border border-line bg-card">
          <EmptyState title={tab === "PENDING" ? "Nothing needs a person right now" : "Nothing here yet"} body={tab === "PENDING" ? "Cases that hit a limit, a risk flag or a records mismatch show up here with the evidence attached." : undefined} />
        </div>
      ) : (
        <div className="space-y-4">{q.data.items.map((a) => <ApprovalCard key={a.id} approval={a} />)}</div>
      )}
    </div>
  );
}
