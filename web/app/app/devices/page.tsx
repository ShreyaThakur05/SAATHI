"use client";

import clsx from "clsx";
import { Check, CreditCard, Speaker, Truck } from "lucide-react";
import { AskSaathiButton, PageHeader } from "@/components/MerchantBits";
import { Chip } from "@/components/Chip";
import { Card, EmptyState, ErrorState, Skeleton } from "@/components/ui/primitives";
import { formatDate, formatDuration, formatInr } from "@/lib/format";
import { useMerchantQuery } from "@/lib/merchantAuth";
import type { MerchantDevice } from "@/lib/types";

function Replacement({ r }: { r: NonNullable<MerchantDevice["replacement"]> }) {
  const steps = [
    { label: "Order placed", done: true, note: r.reference },
    { label: "Dispatched", done: false, note: "" },
    { label: "Delivered", done: false, note: `Expected by ${formatDate(r.eta_date)}` },
  ];
  return (
    <div className="mt-4 rounded-xl bg-brand/10 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-brand-ink">
        <Truck className="size-4" aria-hidden /> Replacement on the way
      </p>
      <ol className="mt-3 flex gap-3">
        {steps.map((s) => (
          <li key={s.label} className="flex-1">
            <div className="flex items-center gap-2">
              <span className={clsx("flex size-5 items-center justify-center rounded-full text-white", s.done ? "bg-success" : "bg-line")}>
                {s.done && <Check className="size-3" aria-hidden />}
              </span>
              <span className={clsx("h-px flex-1", s.done ? "bg-success" : "bg-line")} aria-hidden />
            </div>
            <p className="mt-1 text-xs font-semibold text-ink">{s.label}</p>
            {s.note && <p className="text-xs text-muted">{s.note}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}

function DeviceCard({ d }: { d: MerchantDevice }) {
  const Icon = d.kind === "SOUNDBOX" ? Speaker : CreditCard;
  const name = d.kind === "SOUNDBOX" ? "Soundbox" : "Card machine";
  const needsHelp = d.status === "OFFLINE" && !d.replacement;
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-navy-2/10 text-navy-2"><Icon className="size-5" aria-hidden /></span>
          <div>
            <h2 className="font-semibold text-ink">{name}</h2>
            <p className="font-mono text-xs text-muted">{d.serial}</p>
          </div>
        </div>
        <Chip status={d.status} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        <div><dt className="text-xs text-muted">Last seen</dt><dd className="font-medium">{d.status === "ONLINE" ? "Now" : formatDate(d.last_seen_at, true)}</dd></div>
        {d.status === "OFFLINE" && <div><dt className="text-xs text-muted">Offline for</dt><dd className="font-medium text-danger">{formatDuration(d.offline_hours * 3600)}</dd></div>}
        <div><dt className="text-xs text-muted">SIM signal</dt><dd className="font-medium capitalize">{d.sim_signal.toLowerCase()}</dd></div>
        {d.kind === "CARD_MACHINE" && <div><dt className="text-xs text-muted">Pairing</dt><dd className="font-medium">{d.pairing_ok ? "Paired" : "Not paired"}</dd></div>}
        {d.monthly_rent_inr && <div><dt className="text-xs text-muted">Monthly rent</dt><dd className="font-medium">{formatInr(d.monthly_rent_inr)}</dd></div>}
      </dl>
      {d.replacement && <Replacement r={d.replacement} />}
      {needsHelp && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-danger/5 p-4">
          <p className="text-sm text-ink">This device isn&rsquo;t connecting. Saathi can try a remote fix and arrange a replacement.</p>
          <AskSaathiButton text={`My ${name.toLowerCase()} ${d.serial} is offline${d.offline_hours ? ` for ${d.offline_hours} hours` : ""}`} label="Fix with Saathi" />
        </div>
      )}
    </Card>
  );
}

export default function Devices() {
  const q = useMerchantQuery(["devices"], (api) => api.devices());
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Devices" subtitle="Your Soundbox and card machines." />
      {q.isPending ? <Skeleton className="h-56" /> : q.isError ? <ErrorState message={q.error.message} onRetry={() => q.refetch()} /> : q.data.length === 0 ? (
        <Card><EmptyState title="No devices on your account" body="Devices you rent or buy from us will show up here." /></Card>
      ) : (
        <div className="space-y-4">{q.data.map((d) => <DeviceCard key={d.id} d={d} />)}</div>
      )}
    </div>
  );
}
