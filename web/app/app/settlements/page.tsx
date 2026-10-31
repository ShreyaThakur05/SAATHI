"use client";

import { CheckCircle2, CircleDashed, FileWarning } from "lucide-react";
import { AskSaathiButton, PageHeader } from "@/components/MerchantBits";
import { Chip } from "@/components/Chip";
import { Card, CardHeader, ErrorState, Skeleton } from "@/components/ui/primitives";
import { formatDate, formatInr } from "@/lib/format";
import { useMerchantQuery } from "@/lib/merchantAuth";

const DOC: Record<string, string> = { PAN: "PAN card", GST: "GST certificate", BANK_PROOF: "Bank proof", SHOP_PHOTO: "Shop photo" };

export default function Settlements() {
  const q = useMerchantQuery(["settlements"], (api) => api.settlements());
  if (q.isPending) return <Skeleton className="mx-auto h-64 max-w-4xl" />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;
  const held = q.data.settlements.find((s) => s.status === "HELD");
  const missing = q.data.documents.filter((d) => d.status !== "VERIFIED");

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader title="Settlements" subtitle="Payouts to your bank account, and the documents they depend on." />
      {held && (
        <div role="alert" className="flex flex-wrap items-center gap-4 rounded-xl border border-warn/30 bg-warn/5 p-4">
          <FileWarning className="size-6 shrink-0 text-warn" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{formatInr(held.amount_inr)} is on hold</p>
            <p className="text-sm text-muted">{missing.length ? `We are missing: ${missing.map((d) => DOC[d.doc_type] ?? d.doc_type).join(", ")}.` : "It is being reviewed by our team."}</p>
          </div>
          <AskSaathiButton text="My settlement is on hold, please help" />
        </div>
      )}
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader title="Payouts" />
          <ul>
            {q.data.settlements.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-0">
                <div>
                  <p className="text-sm font-semibold tabular-nums">{formatInr(s.amount_inr)}</p>
                  <p className="text-xs text-muted">{formatDate(s.created_at)}</p>
                </div>
                <Chip status={s.status} />
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="KYC documents" />
          <ul>
            {q.data.documents.map((d) => (
              <li key={d.doc_type} className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-0">
                <span className="flex items-center gap-2 text-sm">
                  {d.status === "VERIFIED" ? <CheckCircle2 className="size-4 text-success" aria-hidden /> : <CircleDashed className="size-4 text-warn" aria-hidden />}
                  {DOC[d.doc_type] ?? d.doc_type}
                </span>
                <Chip status={d.status} />
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
