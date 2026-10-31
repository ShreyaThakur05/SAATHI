"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Check, FileUp, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/MerchantBits";
import { useSaathi } from "@/components/SaathiDock";
import { Badge, Button, Card, EmptyState, ErrorState, Skeleton } from "@/components/ui/primitives";
import { ApiError } from "@/lib/api";
import { formatDate, humanize } from "@/lib/format";
import { useMerchant, useMerchantQuery } from "@/lib/merchantAuth";
import type { CaseStatus, HelpRequest } from "@/lib/types";

const STATUS: Record<CaseStatus, { label: string; tone: "success" | "info" | "warn" | "danger" | "neutral" }> = {
  OPEN: { label: "Received", tone: "info" },
  IN_PROGRESS: { label: "In progress", tone: "info" },
  WAITING_MERCHANT: { label: "Needs your input", tone: "warn" },
  AWAITING_APPROVAL: { label: "With our team", tone: "warn" },
  RESOLVED: { label: "Resolved", tone: "success" },
  REJECTED: { label: "Declined", tone: "danger" },
  BLOCKED: { label: "Not done", tone: "danger" },
  FAILED: { label: "With our team", tone: "warn" },
};
const DOC: Record<string, string> = { PAN: "PAN card", GST: "GST certificate", BANK_PROOF: "Bank proof", SHOP_PHOTO: "Shop photo" };

function RequestCard({ r }: { r: HelpRequest }) {
  const { api } = useMerchant();
  const qc = useQueryClient();
  const upload = useMutation({
    mutationFn: () => api!.uploadDocument(r.id, r.waiting_for as string),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["m"] }),
  });
  const s = STATUS[r.status];
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-ink">{r.summary}</h2>
          <p className="text-xs text-muted">Request #{r.id} · {humanize(r.product.toLowerCase())} · {formatDate(r.created_at, true)}</p>
        </div>
        <Badge tone={s.tone}>{s.label}</Badge>
      </div>
      {r.references.length > 0 && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
          References: {r.references.map((ref) => <code key={ref} className="rounded bg-surface px-1.5 py-0.5 font-semibold text-ink ring-1 ring-line">{ref}</code>)}
        </p>
      )}
      {r.steps.length > 0 && (
        <ol className="mt-4 space-y-2 border-l-2 border-line pl-4">
          {r.steps.map((st, i) => (
            <li key={i} className="relative text-sm">
              <span className={clsx("absolute -left-[1.4rem] top-1.5 size-2.5 rounded-full", st.status === "FAILED" ? "bg-danger" : st.kind === "PROVE" ? "bg-success" : "bg-navy-2")} aria-hidden />
              <span className="text-ink">{st.title}</span>
              <span className="ml-2 text-xs text-muted">{formatDate(st.at, true)}</span>
            </li>
          ))}
        </ol>
      )}
      {r.status === "WAITING_MERCHANT" && r.waiting_for && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-brand/10 p-4">
          <p className="text-sm text-ink">We only need your <strong>{DOC[r.waiting_for] ?? r.waiting_for}</strong> to move this forward.</p>
          <div className="text-right">
            <Button onClick={() => upload.mutate()} loading={upload.isPending}>
              <FileUp className="size-4" aria-hidden /> Upload {DOC[r.waiting_for] ?? r.waiting_for}
            </Button>
            {upload.isError && <p role="alert" className="mt-1 text-xs text-danger">{upload.error instanceof ApiError ? upload.error.message : "Upload failed"}</p>}
          </div>
        </div>
      )}
      {r.status === "RESOLVED" && r.resolved_at && <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-success"><Check className="size-3.5" aria-hidden />Verified and closed {formatDate(r.resolved_at, true)}</p>}
    </Card>
  );
}

export default function Help() {
  const { open } = useSaathi();
  const q = useMerchantQuery(["help-requests"], (api) => api.helpRequests(), { refetchInterval: 3000 });
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Help requests" subtitle="Everything you have asked Saathi, and what was done." action={<Button onClick={open}><Sparkles className="size-4" aria-hidden /> New request</Button>} />
      {q.isPending ? <Skeleton className="h-48" /> : q.isError ? <ErrorState message={q.error.message} onRetry={() => q.refetch()} /> : q.data.length === 0 ? (
        <Card><EmptyState title="No requests yet" body="Tap Ask Saathi and describe the problem. You can speak or type, in Hindi, Hinglish or English." /></Card>
      ) : (
        <div className="space-y-4">{q.data.map((r) => <RequestCard key={r.id} r={r} />)}</div>
      )}
    </div>
  );
}
