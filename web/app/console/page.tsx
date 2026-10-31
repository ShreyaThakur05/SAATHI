"use client";

import clsx from "clsx";
import { CaseRow } from "@/components/CaseRow";
import { Card, EmptyState, ErrorState, Skeleton, Stat } from "@/components/ui/primitives";
import { useStaff, useStaffQuery } from "@/lib/auth";
import { formatDuration, formatPercent } from "@/lib/format";
import { useState } from "react";

const FILTERS = [
  { id: "", label: "All" },
  { id: "AWAITING_APPROVAL", label: "Needs a person" },
  { id: "WAITING_MERCHANT", label: "Waiting for merchant" },
  { id: "RESOLVED", label: "Resolved" },
  { id: "BLOCKED", label: "Blocked" },
];

export default function CasesPage() {
  const { api } = useStaff();
  const [status, setStatus] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 15;
  const cases = useStaffQuery(["cases", status, offset], () => api.cases({ status, limit, offset }), { refetchInterval: 3000 });
  const metrics = useStaffQuery(["metrics"], () => api.metrics(), { refetchInterval: 5000 });
  const m = metrics.data;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-heading">Cases</h1>
        <p className="text-sm text-muted">Everything Saathi is working on, and what needs a person.</p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.isPending ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)
        ) : m ? (
          <>
            <Stat label="Solved without a person" value={formatPercent(m.solved_without_person.rate)} sub={`${m.solved_without_person.count} of ${m.cases_total} cases`} tone="success" />
            <Stat label="Actions confirmed successful" value={formatPercent(m.actions_confirmed_success.rate)} sub={`${m.actions_confirmed_success.confirmed} of ${m.actions_confirmed_success.attempted} attempts`} />
            <Stat label="Median time to resolve" value={formatDuration(m.median_time_to_resolve_s)} sub="automated cases only" />
            <Stat label="Waiting for a person" value={String(m.awaiting_person)} sub="open approvals" tone={m.awaiting_person ? "warn" : "default"} />
          </>
        ) : null}
      </div>

      <div role="tablist" aria-label="Filter by status" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={status === f.id}
            onClick={() => {
              setStatus(f.id);
              setOffset(0);
            }}
            className={clsx(
              "rounded-full px-3 py-1.5 text-sm font-medium",
              status === f.id ? "bg-navy-2 text-white" : "bg-card text-muted ring-1 ring-line hover:text-ink",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Card>
        {cases.isPending ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : cases.isError ? (
          <ErrorState message={cases.error.message} onRetry={() => cases.refetch()} />
        ) : cases.data.items.length === 0 ? (
          <EmptyState
            title={status ? "No cases with this status" : "No cases yet"}
            body="Send a message from the demo chat and the case will appear here, live."
          />
        ) : (
          <>
            {cases.data.items.map((c) => (
              <CaseRow key={c.id} c={c} />
            ))}
            <footer className="flex items-center justify-between px-4 py-3 text-sm text-muted">
              <span>
                {offset + 1}-{Math.min(offset + limit, cases.data.total)} of {cases.data.total}
              </span>
              <span className="flex gap-2">
                <button className="rounded px-2 py-1 hover:bg-surface disabled:opacity-40" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>
                  Previous
                </button>
                <button className="rounded px-2 py-1 hover:bg-surface disabled:opacity-40" disabled={offset + limit >= cases.data.total} onClick={() => setOffset(offset + limit)}>
                  Next
                </button>
              </span>
            </footer>
          </>
        )}
      </Card>
    </div>
  );
}
