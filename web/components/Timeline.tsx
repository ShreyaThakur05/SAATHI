"use client";

import clsx from "clsx";
import {
  CheckCheck,
  ChevronDown,
  ListTree,
  MessageSquare,
  Mic,
  Scale,
  Search,
  UserCheck,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { clock, humanize } from "@/lib/format";
import type { Step, StepKind } from "@/lib/types";

const ICONS: Record<StepKind, typeof Mic> = {
  LISTEN: Mic,
  UNDERSTAND: ListTree,
  LOOKUP: Search,
  DECIDE: Scale,
  ACT: Zap,
  PROVE: CheckCheck,
  HANDOFF: UserCheck,
  REPLY: MessageSquare,
};

const LABEL: Record<StepKind, string> = {
  LISTEN: "Listen",
  UNDERSTAND: "Understand",
  LOOKUP: "Look up",
  DECIDE: "Decide",
  ACT: "Act",
  PROVE: "Prove",
  HANDOFF: "Hand off",
  REPLY: "Reply",
};

const SIX: StepKind[] = ["LISTEN", "UNDERSTAND", "LOOKUP", "DECIDE", "ACT", "PROVE"];

/** The deck's six-step strip, lit up from the steps that actually happened. */
export function SixStepBar({ steps }: { steps: Step[] }) {
  return (
    <ol className="flex items-center gap-1.5 overflow-x-auto" aria-label="Progress through the six steps">
      {SIX.map((kind, i) => {
        const hits = steps.filter((s) => s.kind === kind);
        const failed = hits.some((s) => s.status === "FAILED") && !hits.some((s) => s.status === "OK");
        const done = hits.length > 0;
        const Icon = ICONS[kind];
        return (
          <li key={kind} className="flex items-center gap-1.5">
            <span
              className={clsx(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                !done && "bg-surface text-muted ring-1 ring-line",
                done && !failed && kind === "PROVE" && "bg-success text-white",
                done && !failed && kind !== "PROVE" && "bg-navy-2 text-white",
                failed && "bg-danger text-white",
              )}
            >
              <Icon className="size-3.5" aria-hidden />
              {LABEL[kind]}
            </span>
            {i < SIX.length - 1 && <span className="h-px w-3 bg-line" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

const REDACT = new Set(["text"]);

function Detail({ detail }: { detail: Record<string, unknown> }) {
  const entries = Object.entries(detail).filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (!entries.length) return null;
  return (
    <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 rounded-lg bg-surface p-3 text-xs">
      {entries.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted">{humanize(k)}</dt>
          <dd className={clsx("break-words font-mono text-ink", REDACT.has(k) && "italic")}>
            {typeof v === "object" ? JSON.stringify(v) : String(v)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function StepList({ steps }: { steps: Step[] }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!steps.length) return null;
  const t0 = new Date(steps[0].created_at).getTime();
  return (
    <ol className="relative space-y-1">
      {steps.map((s) => {
        const Icon = ICONS[s.kind];
        const isOpen = open === s.seq;
        const elapsed = (new Date(s.created_at).getTime() - t0) / 1000;
        const hasDetail = Object.keys(s.detail).length > 0;
        return (
          <li key={s.seq} className="animate-in">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : s.seq)}
              aria-expanded={isOpen}
              disabled={!hasDetail}
              className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left hover:bg-surface disabled:cursor-default disabled:hover:bg-transparent"
            >
              <span
                className={clsx(
                  "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
                  s.status === "FAILED" && "bg-danger/10 text-danger",
                  s.status === "INFO" && "bg-warn/10 text-warn",
                  s.status === "OK" && s.kind === "PROVE" && "bg-success/10 text-success",
                  s.status === "OK" && s.kind !== "PROVE" && "bg-navy-2/10 text-navy-2",
                )}
              >
                <Icon className="size-3.5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-xs text-muted">
                  <span className="font-semibold uppercase tracking-wide">{LABEL[s.kind]}</span>
                  <span className="tabular-nums">{clock(elapsed)}</span>
                  {s.status === "FAILED" && <span className="font-semibold text-danger">failed</span>}
                </span>
                <span className="block text-sm text-ink">{s.title}</span>
              </span>
              {hasDetail && (
                <ChevronDown
                  className={clsx("mt-1 size-4 shrink-0 text-muted transition-transform", isOpen && "rotate-180")}
                  aria-hidden
                />
              )}
            </button>
            {isOpen && <div className="pb-2 pl-12 pr-2"><Detail detail={s.detail} /></div>}
          </li>
        );
      })}
    </ol>
  );
}
