"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ShieldAlert, X } from "lucide-react";
import { useState } from "react";
import { ApiError } from "@/lib/api";
import { useStaff } from "@/lib/auth";
import { formatInr, humanize, relativeTime } from "@/lib/format";
import type { Approval } from "@/lib/types";
import { Dialog } from "./ui/Dialog";
import { Badge, Button, Card, inputClass } from "./ui/primitives";

export function Evidence({ data }: { data: Record<string, unknown> }) {
  const rows = Object.entries(data).filter(([, v]) => v !== null && v !== undefined);
  if (!rows.length) return <p className="text-xs text-muted">No extra evidence was collected.</p>;
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted">{humanize(k.replace(/_inr$/, ""))}</dt>
          <dd className="break-words font-medium text-ink">
            {k.endsWith("_inr") ? formatInr(v as string) : typeof v === "object" ? JSON.stringify(v) : String(v)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

const ACTION_LABEL: Record<string, string> = {
  release_settlement_hold: "Release settlement hold",
  reverse_rent: "Reverse rent",
  refund_bill: "Refund bill payment",
  replace_device: "Send replacement device",
  remote_fix: "Remote fix",
  repair_device: "Re-pair device",
  manual_review: "Take over this case",
};

export function ApprovalCard({ approval, compact = false }: { approval: Approval; compact?: boolean }) {
  const { api, user } = useStaff();
  const qc = useQueryClient();
  const [mode, setMode] = useState<"approve" | "reject" | null>(null);
  const [note, setNote] = useState("");
  const canDecide = user?.role === "RISK_APPROVER" || user?.role === "ADMIN";

  const decide = useMutation({
    mutationFn: (approve: boolean) => api.decide(approval.id, approve, note.trim() || undefined),
    onSuccess: () => {
      setMode(null);
      setNote("");
      for (const key of ["approvals", "approvals-count", "cases", "case", "metrics"]) qc.invalidateQueries({ queryKey: [key] });
    },
  });
  const error = decide.error instanceof ApiError ? decide.error.message : decide.error ? "Something went wrong" : null;
  const pending = approval.status === "PENDING";

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{ACTION_LABEL[approval.action] ?? humanize(approval.action)}</h3>
            {approval.amount_inr && <Badge tone="dark">{formatInr(approval.amount_inr)}</Badge>}
            <Badge tone={pending ? "warn" : approval.status === "APPROVED" ? "success" : "danger"}>
              {approval.status.toLowerCase()}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted">
            {approval.merchant_name ?? "Merchant"} · case #{approval.case_id} · {relativeTime(approval.requested_at)}
          </p>
        </div>
        {!compact && (
          <a href={`/console/cases/${approval.case_id}`} className="text-xs font-semibold text-navy-2 hover:underline">
            Open case
          </a>
        )}
      </div>

      <div className="mx-4 flex items-start gap-2 rounded-lg bg-warn/10 p-3 text-sm text-ink">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
        <p>
          <span className="font-semibold">Why a person is needed: </span>
          {approval.reason} <span className="font-mono text-xs text-muted">({approval.rule_id})</span>
        </p>
      </div>

      <div className="p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Evidence Saathi collected</p>
        <Evidence data={approval.evidence} />
      </div>

      {pending ? (
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-surface px-4 py-3">
          {canDecide ? (
            <>
              <p className="text-xs text-muted">Your name is recorded on the action and in the audit log.</p>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setMode("reject")}>
                  <X className="size-4" aria-hidden /> Decline
                </Button>
                <Button onClick={() => setMode("approve")}>
                  <Check className="size-4" aria-hidden /> Approve
                </Button>
              </div>
            </>
          ) : (
            <p className="text-xs text-muted">Only a risk approver can decide this. You can review the evidence.</p>
          )}
        </footer>
      ) : (
        <footer className="border-t border-line bg-surface px-4 py-3 text-xs text-muted">
          {approval.status === "APPROVED" ? "Approved" : "Declined"} by {approval.decided_by ?? "a team member"}
          {approval.decision_note ? `: "${approval.decision_note}"` : ""}
        </footer>
      )}

      <Dialog
        open={mode !== null}
        onClose={() => {
          setMode(null);
          decide.reset();
        }}
        title={mode === "approve" ? "Approve this action?" : "Decline this request?"}
      >
        <p className="text-sm text-muted">
          {mode === "approve"
            ? "Saathi will perform the action, re-check the system, and reply to the merchant."
            : "The merchant is told the request was not approved. A reason is required."}
        </p>
        <textarea
          aria-label={mode === "approve" ? "Optional note" : "Reason for declining"}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={240}
          rows={3}
          placeholder={mode === "approve" ? "Optional note" : "Reason (required)"}
          className={`${inputClass} mt-3 h-auto py-2`}
        />
        {error && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setMode(null)}>
            Cancel
          </Button>
          <Button
            variant={mode === "approve" ? "primary" : "danger"}
            loading={decide.isPending}
            disabled={mode === "reject" && !note.trim()}
            onClick={() => decide.mutate(mode === "approve")}
          >
            {mode === "approve" ? "Approve" : "Decline"}
          </Button>
        </div>
      </Dialog>
    </Card>
  );
}
