import clsx from "clsx";
import type { CaseStatus } from "@/lib/types";

const MAP: Record<CaseStatus, { label: string; cls: string; pulse?: boolean }> = {
  OPEN: { label: "Queued", cls: "bg-surface text-muted ring-1 ring-line" },
  IN_PROGRESS: { label: "Working", cls: "bg-brand/15 text-brand-ink", pulse: true },
  WAITING_MERCHANT: { label: "Waiting for merchant", cls: "bg-brand/15 text-brand-ink" },
  AWAITING_APPROVAL: { label: "Needs a person", cls: "bg-warn/10 text-warn" },
  RESOLVED: { label: "Resolved", cls: "bg-success/10 text-success" },
  REJECTED: { label: "Declined", cls: "bg-danger/10 text-danger" },
  BLOCKED: { label: "Blocked by rules", cls: "bg-danger/10 text-danger" },
  FAILED: { label: "Failed", cls: "bg-danger/10 text-danger" },
};

export function StatusPill({ status }: { status: CaseStatus }) {
  const m = MAP[status];
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold", m.cls)}>
      <span
        aria-hidden
        className="size-1.5 rounded-full bg-current"
        style={m.pulse ? { animation: "saathi-pulse 1.2s ease-in-out infinite" } : undefined}
      />
      {m.label}
    </span>
  );
}
