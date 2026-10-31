"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { AlertCard, LedgerRow, PageHeader } from "@/components/MerchantBits";
import { Chip } from "@/components/Chip";
import { Card, CardHeader, EmptyState, ErrorState, Skeleton, Stat } from "@/components/ui/primitives";
import { formatDate, formatInr } from "@/lib/format";
import { useMerchantQuery } from "@/lib/merchantAuth";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function Overview() {
  const o = useMerchantQuery(["overview"], (api) => api.overview());
  const activity = useMerchantQuery(["activity"], (api) => api.activity());

  if (o.isPending) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (o.isError) return <ErrorState message={o.error.message} onRetry={() => o.refetch()} />;
  const d = o.data;
  const settle = d.settlement.held ?? d.settlement.last_paid;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader title={`${greeting()}, ${d.merchant.name}`} subtitle={`${d.merchant.city} · ${d.merchant.category}`} />

      {d.alerts.length > 0 && (
        <section aria-label="Needs your attention" className="space-y-3">
          {d.alerts.map((a) => <AlertCard key={a.id} alert={a} />)}
        </section>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Collected today" value={formatInr(d.collections.today_inr)} sub={`${d.collections.today_count} payments`} />
        <Stat label="Last 7 days" value={formatInr(d.collections.week_inr)} sub={`${d.collections.week_count} payments`} />
        <Stat
          label={d.settlement.held ? "Settlement on hold" : "Last settlement"}
          value={settle ? formatInr(settle.amount_inr) : "-"}
          sub={settle ? `${d.settlement.held ? "Waiting on a document" : "Paid"} · ${formatDate(settle.created_at)}` : "Nothing yet"}
          tone={d.settlement.held ? "warn" : "default"}
        />
        <Stat label="Devices online" value={`${d.devices.online} of ${d.devices.total}`} tone={d.devices.online < d.devices.total ? "warn" : "success"} sub={d.devices.online < d.devices.total ? "Needs attention" : "All working"} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader title="Recent activity" action={<Link href="/app/transactions" className="flex items-center gap-1 text-xs font-semibold text-link hover:underline">View all <ArrowRight className="size-3" aria-hidden /></Link>} />
          {activity.isPending ? (
            <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : activity.isError ? (
            <ErrorState message={activity.error.message} onRetry={() => activity.refetch()} />
          ) : activity.data.length === 0 ? (
            <EmptyState title="No activity yet" />
          ) : (
            <ul>{activity.data.slice(0, 8).map((i) => <LedgerRow key={i.id} item={i} />)}</ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Help with Saathi" hint="Describe a problem in Hindi, Hinglish or English, by voice or text." />
          <div className="space-y-3 p-4 text-sm">
            <p className="text-muted">
              {d.open_help_requests > 0
                ? `${d.open_help_requests} request${d.open_help_requests > 1 ? "s are" : " is"} in progress.`
                : "No open requests. When something goes wrong, Saathi checks your account, fixes what it is allowed to, and confirms it worked."}
            </p>
            <Link href="/app/help" className="inline-flex items-center gap-1 font-semibold text-link hover:underline">See your help requests <ArrowRight className="size-3.5" aria-hidden /></Link>
            <div className="flex items-center gap-2 border-t border-line pt-3 text-xs text-muted">
              <Chip status={d.merchant.kyc_status === "VERIFIED" ? "VERIFIED" : "PENDING"} label={`KYC ${d.merchant.kyc_status.toLowerCase()}`} />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
