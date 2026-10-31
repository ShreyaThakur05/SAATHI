"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Badge, Card, EmptyState, ErrorState, Skeleton, inputClass } from "@/components/ui/primitives";
import { useStaff, useStaffQuery } from "@/lib/auth";

const EVENTS = [
  { id: "", label: "All events" },
  { id: "case.", label: "Case lifecycle" },
  { id: "step.decide", label: "Decisions (rules)" },
  { id: "step.act", label: "Actions" },
  { id: "step.prove", label: "Proofs" },
  { id: "approval.", label: "Approvals" },
  { id: "instruction_blocked", label: "Blocked instructions" },
];

function AuditInner() {
  const { api } = useStaff();
  const params = useSearchParams();
  const [event, setEvent] = useState("");
  const [caseId, setCaseId] = useState(params.get("case") ?? "");
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const limit = 30;
  const cid = caseId && /^\d+$/.test(caseId) ? Number(caseId) : undefined;
  const q = useStaffQuery(["audit", event, cid, offset], () => api.audit({ event, case_id: cid, limit, offset }), { refetchInterval: 5000 });

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-heading">Audit log</h1>
        <p className="text-sm text-muted">Every action, rule and approver. Append-only: the database refuses edits and deletes.</p>
      </header>
      <div className="flex flex-wrap gap-3">
        <select aria-label="Event type" className={`${inputClass} w-56`} value={event} onChange={(e) => { setEvent(e.target.value); setOffset(0); }}>
          {EVENTS.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
        </select>
        <input aria-label="Case id" inputMode="numeric" placeholder="Case id" className={`${inputClass} w-32`} value={caseId} onChange={(e) => { setCaseId(e.target.value.trim()); setOffset(0); }} />
      </div>
      <Card>
        {q.isPending ? (
          <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9" />)}</div>
        ) : q.isError ? (
          <ErrorState message={q.error.message} onRetry={() => q.refetch()} />
        ) : q.data.items.length === 0 ? (
          <EmptyState title="No audit entries match" />
        ) : (
          <>
            <ul>
              {q.data.items.map((r) => (
                <li key={r.id} className="border-b border-line last:border-0">
                  <button onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id} className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-4 px-4 py-2.5 text-left text-sm hover:bg-surface md:grid-cols-[10rem_12rem_1fr_5rem]">
                    <span className="hidden font-mono text-xs text-muted md:block">{new Date(r.ts).toLocaleTimeString("en-IN")}</span>
                    <span className="font-mono text-xs font-semibold text-ink">{r.event}</span>
                    <span className="min-w-0 truncate text-muted">{r.actor.startsWith("user:") ? <Badge tone="info">{r.actor}</Badge> : r.actor}</span>
                    <span className="text-right text-xs text-muted">{r.case_id ? `case #${r.case_id}` : ""}</span>
                  </button>
                  {open === r.id && <pre className="mx-4 mb-3 overflow-x-auto rounded-lg bg-surface p-3 font-mono text-xs">{JSON.stringify(r.data, null, 2)}</pre>}
                </li>
              ))}
            </ul>
            <footer className="flex items-center justify-between px-4 py-3 text-sm text-muted">
              <span>{offset + 1}-{Math.min(offset + limit, q.data.total)} of {q.data.total}</span>
              <span className="flex gap-2">
                <button className="rounded px-2 py-1 hover:bg-surface disabled:opacity-40" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>Previous</button>
                <button className="rounded px-2 py-1 hover:bg-surface disabled:opacity-40" disabled={offset + limit >= q.data.total} onClick={() => setOffset(offset + limit)}>Next</button>
              </span>
            </footer>
          </>
        )}
      </Card>
    </div>
  );
}

export default function AuditPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <AuditInner />
    </Suspense>
  );
}
