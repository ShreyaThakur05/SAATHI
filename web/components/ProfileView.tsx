"use client";

import clsx from "clsx";
import { Banknote, FileCheck2, LifeBuoy, MapPin, Router, UserPlus, Zap } from "lucide-react";
import dynamic from "next/dynamic";
import { Chip } from "./Chip";
import { DeviceLive } from "./DeviceLive";
import { Badge, Card, CardHeader, Skeleton, Stat } from "./ui/primitives";
import { formatDate, formatInr } from "@/lib/format";
import type { Diagnostics, HistoryEvent, MerchantProfile } from "@/lib/types";

const LocationMap = dynamic(() => import("./LocationMap").then((m) => m.LocationMap), {
  ssr: false,
  loading: () => <Skeleton className="h-80" />,
});

const KIND_ICON: Record<HistoryEvent["kind"], { icon: typeof Zap; cls: string }> = {
  case: { icon: LifeBuoy, cls: "bg-navy-2/10 text-link" },
  device: { icon: Router, cls: "bg-brand/20 text-brand-ink" },
  money: { icon: Banknote, cls: "bg-success/10 text-success" },
  kyc: { icon: FileCheck2, cls: "bg-warn/10 text-warn" },
  account: { icon: UserPlus, cls: "bg-surface text-muted" },
  action: { icon: Zap, cls: "bg-surface text-muted" },
};

export function HistoryTimeline({ events }: { events: HistoryEvent[] }) {
  return (
    <ol className="relative px-4 py-2">
      <span aria-hidden className="absolute bottom-4 left-[2.15rem] top-4 w-px bg-line" />
      {events.map((e, i) => {
        const { icon: Icon, cls } = KIND_ICON[e.kind];
        return (
          <li key={i} className="relative flex gap-3 py-2.5">
            <span className={clsx("z-10 flex size-8 shrink-0 items-center justify-center rounded-full ring-4 ring-white", cls)}>
              <Icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                {e.title}
                {e.status === "FAILED" && <Badge tone="danger">failed</Badge>}
              </p>
              <p className="truncate text-xs text-muted">{e.detail} · {formatDate(e.ts, true)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** A merchant's profile: who they are, where they are, their devices live, and everything that happened. */
export function ProfileView({
  profile,
  diagnosticsKey,
  diagnostics,
}: {
  profile: MerchantProfile;
  diagnosticsKey: (deviceId: number) => unknown[];
  diagnostics: (deviceId: number) => Promise<Diagnostics>;
}) {
  const m = profile.merchant;
  const s = profile.stats;
  return (
    <div className="space-y-5">
      <Card className="flex flex-wrap items-center gap-5 p-5">
        <span aria-hidden className="flex size-16 items-center justify-center rounded-2xl bg-navy-2 text-2xl font-bold text-white">{m.name.charAt(0)}</span>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold text-heading">{m.name}</h2>
          <p className="text-sm text-muted">{m.category} · {m.city}</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted"><MapPin className="size-4" aria-hidden />{m.address || "No address on file"}</p>
        </div>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <div><dt className="text-xs text-muted">Member since</dt><dd className="font-medium">{formatDate(m.member_since)}, {new Date(m.member_since).getFullYear()}</dd></div>
          <div><dt className="text-xs text-muted">KYC</dt><dd><Chip status={m.kyc_status === "VERIFIED" ? "VERIFIED" : "PENDING"} label={m.kyc_status.toLowerCase()} /></dd></div>
          <div><dt className="text-xs text-muted">Language</dt><dd className="font-medium capitalize">{m.language}</dd></div>
          {m.email && <div><dt className="text-xs text-muted">Email</dt><dd className="truncate font-medium">{m.email}</dd></div>}
        </dl>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Collected, all time" value={formatInr(s.collections_inr)} sub={`${s.collections_count} payments`} />
        <Stat label="Devices" value={String(s.devices)} />
        <Stat label="Help requests" value={String(s.requests)} sub={`${s.resolved} resolved`} />
        <Stat label="Solved by Saathi" value={String(s.solved_by_saathi)} sub="no person needed" tone="success" />
      </div>

      {profile.location && (
        <Card>
          <CardHeader title="Location" hint="Shop, devices and the nearest cell site. Red dashed lines are devices that are not connected." />
          <div className="p-4"><LocationMap location={profile.location} /></div>
        </Card>
      )}

      {profile.devices.length > 0 && (
        <section aria-label="Live device connections" className="space-y-4">
          <h2 className="text-lg font-semibold text-heading">Live device connections</h2>
          {profile.devices.map((d) => (
            <div key={d.id} className="space-y-2">
              <p className="text-sm font-semibold text-ink">{d.kind === "SOUNDBOX" ? "Soundbox" : "Card machine"} <span className="font-mono text-xs text-muted">{d.serial}</span></p>
              <DeviceLive queryKey={diagnosticsKey(d.id)} fetcher={() => diagnostics(d.id)} kind={d.kind} />
            </div>
          ))}
        </section>
      )}

      <Card>
        <CardHeader title="History" hint="Requests, actions taken, and payouts, newest first." />
        <HistoryTimeline events={profile.history} />
      </Card>
    </div>
  );
}
