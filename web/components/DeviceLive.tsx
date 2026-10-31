"use client";

import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { Activity, Radio, Wifi, WifiOff } from "lucide-react";
import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";
import { ApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { deriveScene, heartbeatBars } from "@/lib/scene";
import type { Diagnostics } from "@/lib/types";
import { Skeleton } from "./ui/primitives";

const Scene = dynamic(() => import("./DeviceScene3D"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-none bg-navy/60" />,
});

const subscribeMotion = (cb: () => void) => {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const useReducedMotion = () =>
  useSyncExternalStore(subscribeMotion, () => window.matchMedia("(prefers-reduced-motion: reduce)").matches, () => false);

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}
const useWebgl = () => useSyncExternalStore(() => () => {}, webglAvailable, () => true);

function HeartbeatStrip({ series }: { series: Diagnostics["heartbeat"]["series"] }) {
  const bars = heartbeatBars(series);
  const w = 100 / bars.length;
  return (
    <svg viewBox="0 0 100 24" preserveAspectRatio="none" className="h-14 w-full" role="img" aria-label={`Last ${bars.length} heartbeats: ${bars.filter((b) => b.missed).length} missed`}>
      {bars.map((b) =>
        b.missed ? (
          <rect key={b.i} x={b.i * w + w * 0.2} y={10} width={w * 0.6} height={4} rx={0.6} fill="#b42d2d" opacity={0.85} />
        ) : (
          <rect key={b.i} x={b.i * w + w * 0.2} y={24 - b.h * 22} width={w * 0.6} height={b.h * 22} rx={0.6} fill={b.rtt! > 200 ? "#8f5b00" : "#0b7a50"} />
        ),
      )}
    </svg>
  );
}

const MODE_LABEL = { healthy: "Connected", degraded: "Weak connection", broken: "Not connected" } as const;

/**
 * Live view of how one device connects, with simulated heartbeat telemetry. It reads the same
 * device state the rest of the system uses, and shows Saathi's steps as it works on the device.
 */
export function DeviceLive({
  queryKey,
  fetcher,
  kind,
}: {
  queryKey: unknown[];
  fetcher: () => Promise<Diagnostics>;
  kind: "SOUNDBOX" | "CARD_MACHINE";
}) {
  const reduced = useReducedMotion();
  const webgl = useWebgl();
  const q = useQuery({
    queryKey,
    queryFn: fetcher,
    // poll quickly while Saathi is working on it so the scene follows each step
    refetchInterval: (query) => (query.state.data?.work?.active ? 1000 : 4000),
    retry: (n, e) => !(e instanceof ApiError && e.status < 500) && n < 2,
  });

  if (q.isPending) return <Skeleton className="h-96" />;
  if (q.isError) return <p role="alert" className="p-4 text-sm text-danger">{q.error.message}</p>;
  const d = q.data;
  const scene = deriveScene(d);
  const tone = scene.mode === "healthy" ? "text-success" : scene.mode === "degraded" ? "text-warn" : "text-danger";
  const steps = d.work?.steps.slice(-5) ?? [];

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-card">
      <div className="grid lg:grid-cols-[1.35fr_1fr]">
        <div className="relative h-80 bg-navy lg:h-auto lg:min-h-[22rem]">
          {webgl ? (
            <Scene scene={scene} kind={kind} serial={d.device.serial} reducedMotion={reduced} />
          ) : (
            <p className="flex h-full items-center justify-center p-6 text-center text-sm text-white/80">3D view needs WebGL, which this browser does not provide. The live readings are on the right.</p>
          )}
          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-card/95 px-3 py-1 text-xs font-semibold shadow">
            <span className={clsx("size-2 rounded-full", scene.mode === "healthy" ? "bg-success" : scene.mode === "degraded" ? "bg-warn" : "bg-danger")} aria-hidden />
            <span className={tone}>{MODE_LABEL[scene.mode]}</span>
          </div>
          {scene.checking && (
            <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 rounded-lg bg-brand/95 px-3 py-2 text-xs font-semibold text-brand-ink shadow">
              <Radio className="size-4 animate-pulse" aria-hidden /> Saathi: {scene.stage ?? "working on it"}
            </div>
          )}
          <span className="absolute right-3 top-3 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-medium text-white/80">Simulated telemetry</span>
        </div>

        <div className="space-y-4 p-4">
          <p aria-live="polite" className="text-sm text-ink">{scene.summary}</p>
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <div><dt className="text-xs text-muted">Signal</dt><dd className="font-semibold tabular-nums">{d.signal.dbm} dBm</dd><dd className="text-xs capitalize text-muted">{d.signal.quality.toLowerCase()}</dd></div>
            <div><dt className="text-xs text-muted">Round trip</dt><dd className="font-semibold tabular-nums">{d.heartbeat.median_rtt_ms === null ? "-" : `${d.heartbeat.median_rtt_ms} ms`}</dd><dd className="text-xs text-muted">median</dd></div>
            <div><dt className="text-xs text-muted">Missed</dt><dd className={clsx("font-semibold tabular-nums", d.heartbeat.missed_recent > 0 && "text-danger")}>{d.heartbeat.missed_recent} of {d.heartbeat.window}</dd><dd className="text-xs text-muted">recent beats</dd></div>
          </dl>
          <div>
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted">
              <Activity className="size-3.5" aria-hidden /> Heartbeat, every {d.heartbeat.interval_s}s
              <span className="ml-auto font-normal">{d.device.status === "ONLINE" ? <Wifi className="inline size-3.5 text-success" aria-label="online" /> : <WifiOff className="inline size-3.5 text-danger" aria-label="offline" />}</span>
            </p>
            <HeartbeatStrip series={d.heartbeat.series} />
            <p className="mt-1 text-xs text-muted">{d.device.status === "ONLINE" ? "Last heartbeat just now" : `Last heard ${formatDate(d.heartbeat.last_seen_at, true)}`}</p>
          </div>
          {steps.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-muted">What Saathi did on request #{d.work?.case_id}</p>
              <ol className="space-y-1">
                {steps.map((s, i) => (
                  <li key={s.seq} className={clsx("flex items-start gap-2 text-xs", i === steps.length - 1 && d.work?.active ? "font-semibold text-ink" : "text-muted")}>
                    <span className={clsx("mt-1 size-1.5 shrink-0 rounded-full", s.status === "FAILED" ? "bg-danger" : s.kind === "PROVE" ? "bg-success" : "bg-navy-2")} aria-hidden />
                    <span className="min-w-0 break-words"><span className="uppercase tracking-wide">{s.kind}</span> · {s.title}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
