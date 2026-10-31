"use client";

import clsx from "clsx";
import dynamic from "next/dynamic";
import { useMemo, useState, useSyncExternalStore } from "react";
import { deriveScene } from "@/lib/scene";
import type { Diagnostics } from "@/lib/types";
import { Skeleton } from "./ui/primitives";

const Scene = dynamic(() => import("./DeviceScene3D"), { ssr: false, loading: () => <Skeleton className="h-full w-full rounded-none bg-navy/70" /> });

type Mode = "healthy" | "weak" | "broken" | "fixing";
const MODES: { id: Mode; label: string }[] = [
  { id: "healthy", label: "Connected" },
  { id: "weak", label: "Weak signal" },
  { id: "broken", label: "Can't connect" },
  { id: "fixing", label: "Saathi is fixing it" },
];

function fixture(mode: Mode): Diagnostics {
  const broken = mode === "broken" || mode === "fixing";
  return {
    source: "sample",
    device: { id: 1, kind: "SOUNDBOX", serial: "SB-77120", status: broken ? "OFFLINE" : "ONLINE", pairing_ok: true },
    signal: { quality: mode === "weak" ? "WEAK" : "GOOD", dbm: mode === "weak" ? -104 : -72 },
    heartbeat: { interval_s: 5, last_seen_at: "2026-01-01T00:00:00Z", median_rtt_ms: null, missed_recent: 0, window: 24, series: [] },
    path: broken
      ? { device: "ok", link_tower: "down", link_gateway: "ok", failing_hop: "device_tower" }
      : { device: "ok", link_tower: mode === "weak" ? "degraded" : "ok", link_gateway: "ok", failing_hop: null },
    work:
      mode === "fixing"
        ? { case_id: 1, summary: "Soundbox not working", status: "IN_PROGRESS", active: true, steps: [{ seq: 1, kind: "ACT", status: "OK", title: "Remote restart", at: "2026-01-01T00:00:00Z" }] }
        : null,
    as_of: "2026-01-01T00:00:00Z",
  };
}

const subscribeMotion = (cb: () => void) => {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/** Interactive explainer: flip between connection states and watch the 3D scene change. */
export function SceneExplainer() {
  const [mode, setMode] = useState<Mode>("healthy");
  const reduced = useSyncExternalStore(subscribeMotion, () => window.matchMedia("(prefers-reduced-motion: reduce)").matches, () => false);
  const scene = useMemo(() => deriveScene(fixture(mode)), [mode]);
  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-card shadow-xl shadow-navy/5">
      <div className="relative h-80 bg-navy sm:h-96">
        <Scene scene={scene} kind="SOUNDBOX" serial="SB-77120" reducedMotion={reduced} />
        <span className="absolute left-3 top-3 rounded-full bg-card/95 px-3 py-1 text-xs font-semibold text-ink shadow">Sample device</span>
      </div>
      <div className="space-y-3 p-4">
        <div role="group" aria-label="Connection state" className="flex flex-wrap gap-2">
          {MODES.map((m) => (
            <button key={m.id} type="button" aria-pressed={mode === m.id} onClick={() => setMode(m.id)} className={clsx("rounded-full px-3.5 py-1.5 text-sm font-medium", mode === m.id ? "bg-navy-2 text-white" : "bg-surface text-muted ring-1 ring-line hover:text-ink")}>
              {m.label}
            </button>
          ))}
        </div>
        <p aria-live="polite" className="min-h-10 text-sm text-muted">{scene.summary}</p>
      </div>
    </div>
  );
}
