"use client";

import { AlertCircle } from "lucide-react";
import { Card, CardHeader, ErrorState, Skeleton, Stat } from "@/components/ui/primitives";
import { useStaff, useStaffQuery } from "@/lib/auth";
import { formatDuration, formatInr, formatPercent, humanize } from "@/lib/format";

function Bars({ data, tone }: { data: Record<string, number>; tone: (k: string) => string }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  if (!entries.length) return <p className="px-4 py-6 text-sm text-muted">No data yet.</p>;
  return (
    <ul className="space-y-3 p-4">
      {entries.map(([k, v]) => (
        <li key={k}>
          <div className="mb-1 flex justify-between text-sm"><span>{humanize(k.toLowerCase())}</span><span className="font-semibold tabular-nums">{v}</span></div>
          <div className="h-2 rounded-full bg-line"><div className="h-2 rounded-full" style={{ width: `${(v / max) * 100}%`, background: tone(k) }} /></div>
        </li>
      ))}
    </ul>
  );
}

const STATUS_COLOR: Record<string, string> = { RESOLVED: "var(--success)", AWAITING_APPROVAL: "var(--warn)", BLOCKED: "var(--danger)", REJECTED: "var(--danger)", FAILED: "var(--danger)" };

export default function InsightsPage() {
  const { api } = useStaff();
  const q = useStaffQuery(["metrics"], () => api.metrics(), { refetchInterval: 5000 });
  if (q.isPending) return <div className="grid gap-3 md:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;
  const m = q.data;
  const claude = m.understanding_modes["claude"] ?? 0;
  const keyword = m.understanding_modes["keyword"] ?? 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-navy">Insights</h1>
        <p className="text-sm text-muted">Measured from the cases in this environment. Nothing here is projected.</p>
      </header>

      {keyword > 0 && (
        <div className="flex items-start gap-2 rounded-xl bg-warn/10 p-3 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
          <p>
            {keyword} of {keyword + claude} cases were understood by the <strong>keyword fallback</strong>, not an LLM (no model key configured, or the call failed). AI cost below is therefore Rs 0 for those cases.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Cases solved without a person" value={formatPercent(m.solved_without_person.rate)} sub={`${m.solved_without_person.count} of ${m.cases_total}`} tone="success" />
        <Stat label="Actions confirmed successful" value={formatPercent(m.actions_confirmed_success.rate)} sub={`${m.actions_confirmed_success.confirmed} proved of ${m.actions_confirmed_success.attempted} attempted`} />
        <Stat label="Median time to resolve" value={formatDuration(m.median_time_to_resolve_s)} sub="automated cases; includes simulated system latency" />
        <Stat label="AI cost per resolved ticket" value={m.ai_cost_per_resolved_ticket_inr === null ? "-" : formatInr(m.ai_cost_per_resolved_ticket_inr)} sub="model tokens only (speech, WhatsApp, hosting not included)" />
        <Stat label="Repeat contact within 7 days" value={formatPercent(m.repeat_contact_within_7d.rate)} sub={`${m.repeat_contact_within_7d.count} resolved cases followed by another`} />
        <Stat label="Refunds tracked vs deadline" value={`${m.refunds.past_deadline} past`} sub={`${m.refunds.tracked} tracked, ${m.refunds.open} still open (deadline length is a configured assumption)`} tone={m.refunds.past_deadline ? "warn" : "default"} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardHeader title="Cases by outcome" /><Bars data={m.by_status} tone={(k) => STATUS_COLOR[k] ?? "var(--navy-2)"} /></Card>
        <Card><CardHeader title="Cases by product" /><Bars data={m.by_product} tone={() => "var(--navy-2)"} /></Card>
      </div>

      <Card className="border-warn/40">
        <CardHeader title="Illustrative saving" hint="An assumption from the pitch, not a measurement." />
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <div>
            <p className="text-3xl font-bold tabular-nums text-ink">{formatInr(m.illustrative.estimated_saving_inr)}</p>
            <p className="mt-1 text-xs text-muted">on {m.solved_without_person.count} auto-resolved cases at an assumed {formatInr(m.illustrative.human_cost_per_ticket_inr)} per human-handled ticket</p>
          </div>
          <p className="text-sm text-muted">{m.illustrative.note}</p>
        </div>
      </Card>
    </div>
  );
}
