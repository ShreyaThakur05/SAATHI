import type { Diagnostics, HopState } from "./types";

export interface SceneState {
  /** overall picture: drives colours and the one-line summary */
  mode: "healthy" | "degraded" | "broken";
  device: "ok" | "fault";
  linkTower: HopState;
  linkGateway: HopState;
  /** Saathi is actively probing or fixing this device right now */
  checking: boolean;
  stage: string | null;
  /** seconds between visible heartbeat pulses (visual pacing, not the real 5 s interval) */
  pulseEveryS: number;
  summary: string;
}

const STAGE: Record<string, string> = {
  LISTEN: "Reading the request",
  UNDERSTAND: "Understanding the problem",
  LOOKUP: "Checking the device's status",
  DECIDE: "Applying the product's rules",
  ACT: "Sending a command to the device",
  PROVE: "Waiting for a heartbeat to confirm the fix",
  HANDOFF: "Passing the case to a person",
  REPLY: "Telling the merchant",
};

export function deriveScene(d: Diagnostics): SceneState {
  const { path } = d;
  const mode: SceneState["mode"] =
    path.failing_hop !== null ? "broken" : path.link_tower === "degraded" ? "degraded" : "healthy";
  const work = d.work;
  const checking = !!work?.active;
  const last = work?.steps[work.steps.length - 1];
  const stage = checking && last ? (STAGE[last.kind] ?? null) : null;

  const name = d.device.kind === "SOUNDBOX" ? "Soundbox" : "Card machine";
  let summary: string;
  if (mode === "healthy") summary = `${name} is connected. Heartbeats are arriving normally.`;
  else if (mode === "degraded") summary = `${name} is connected but the signal is weak, so some heartbeats are late or lost.`;
  else if (path.failing_hop === "device_tower") summary = `${name} cannot reach the cell site, so no heartbeats are getting through.`;
  else summary = `${name} has a fault. It has a signal but is not responding.`;
  if (stage) summary += ` Saathi: ${stage.toLowerCase()}.`;

  return {
    mode,
    device: path.device,
    linkTower: path.link_tower,
    linkGateway: path.link_gateway,
    checking,
    stage,
    pulseEveryS: mode === "degraded" ? 2.4 : 1.6,
    summary,
  };
}

/** Heartbeat strip geometry: one bar per slot; missed slots are marked as gaps. */
export function heartbeatBars(series: Diagnostics["heartbeat"]["series"], maxRtt = 400) {
  return series.map((b, i) => ({
    i,
    missed: b.rtt_ms === null,
    h: b.rtt_ms === null ? 0 : Math.max(0.08, Math.min(1, b.rtt_ms / maxRtt)),
    rtt: b.rtt_ms,
  }));
}
