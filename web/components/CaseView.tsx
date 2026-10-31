"use client";

import { ArrowLeft, Bot, Clock, ExternalLink, UserRound } from "lucide-react";
import Link from "next/link";
import { ApprovalCard } from "@/components/ApprovalCard";
import { StatusPill } from "@/components/StatusPill";
import { SixStepBar, StepList } from "@/components/Timeline";
import { Badge, Card, CardHeader, ErrorState, Skeleton } from "@/components/ui/primitives";
import { useStaff, useStaffQuery } from "@/lib/auth";
import { formatDuration, formatInr, humanize, understandingLabel } from "@/lib/format";
import { useCaseStream } from "@/lib/useCaseStream";
import type { CaseStatus } from "@/lib/types";

const SETTLED: CaseStatus[] = ["RESOLVED", "REJECTED", "BLOCKED", "FAILED"];

/** Shared by the console case page and the demo's live panel. */
export function CaseView({ caseId, embedded = false }: { caseId: number; embedded?: boolean }) {
  const { api, token } = useStaff();
  const q = useStaffQuery(["case", caseId], () => api.caseDetail(caseId), { refetchInterval: 2500 });
  const status = q.data?.case.status;
  useCaseStream(caseId, token, !!status && !SETTLED.includes(status));

  if (q.isPending) return <Skeleton className="h-64" />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;
  const { case: c, steps, actions, approvals } = q.data;
  const pending = approvals.filter((a) => a.status === "PENDING");
  const took = c.resolved_at ? (new Date(c.resolved_at).getTime() - new Date(c.created_at).getTime()) / 1000 : null;

  return (
    <div className="space-y-4">
      {!embedded && (
        <Link href="/console" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden /> All cases
        </Link>
      )}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className={embedded ? "text-base font-bold text-navy" : "text-2xl font-bold text-navy"}>{c.summary}</h1>
          <p className="mt-1 text-sm text-muted">
            Case #{c.id} · {c.merchant_name ?? `Merchant ${c.merchant_id}`} · {humanize(c.product.toLowerCase())}
          </p>
        </div>
        <StatusPill status={c.status} />
      </header>

      <Card className="p-4">
        <SixStepBar steps={steps} />
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            {c.handled_by_person ? <UserRound className="size-3.5" aria-hidden /> : <Bot className="size-3.5" aria-hidden />}
            {c.handled_by_person ? "Closed by a person" : "Handled by Saathi"}
          </span>
          {took !== null && (
            <span className="flex items-center gap-1.5">
              <Clock className="size-3.5" aria-hidden /> {formatDuration(took)} total
            </span>
          )}
          <span>
            Understanding: <strong className="text-ink">{understandingLabel(c.understanding_mode)}</strong>
          </span>
          <span>AI cost: <strong className="text-ink">{formatInr(c.ai_cost_inr)}</strong></span>
          {c.refund_deadline_at && (
            <span>Refund deadline (configured): <strong className="text-ink">{new Date(c.refund_deadline_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</strong></span>
          )}
        </div>
      </Card>

      {pending.map((a) => (
        <ApprovalCard key={a.id} approval={a} compact={embedded} />
      ))}

      <div className={embedded ? "space-y-4" : "grid gap-4 lg:grid-cols-[1.4fr_1fr]"}>
        <Card>
          <CardHeader title="What Saathi did" hint="Every step is logged. Click a step to see the evidence." />
          <div className="p-2">
            <StepList steps={steps} />
          </div>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Actions and proof" hint="One ID per action; none can run twice." />
            {actions.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted">No action was taken.</p>
            ) : (
              <ul className="divide-y divide-line">
                {actions.map((a) => (
                  <li key={a.id} className="space-y-1 px-4 py-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{humanize(a.name)}</span>
                      {a.proved === true ? <Badge tone="success">proved</Badge> : a.proved === false || a.status === "FAILED" ? <Badge tone="danger">not proved</Badge> : <Badge>pending proof</Badge>}
                    </div>
                    <p className="font-mono text-xs text-muted">{a.reference ?? "-"} · {a.idempotency_key}</p>
                    {a.amount_inr && <p className="text-xs text-muted">{formatInr(a.amount_inr)}{a.approved_by_user_id ? " · approved by a person" : ""}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {approvals.filter((a) => a.status !== "PENDING").map((a) => (
            <ApprovalCard key={a.id} approval={a} compact />
          ))}
        </div>
      </div>
      {!embedded && (
        <p className="text-right text-xs text-muted">
          <Link href={`/console/audit?case=${c.id}`} className="inline-flex items-center gap-1 hover:text-ink">
            View audit log for this case <ExternalLink className="size-3" aria-hidden />
          </Link>
        </p>
      )}
    </div>
  );
}
