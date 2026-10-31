import { describe, expect, it } from "vitest";
import { deriveScene, heartbeatBars } from "@/lib/scene";
import type { Diagnostics } from "@/lib/types";

const base = (over: Partial<Diagnostics> = {}): Diagnostics => ({
  source: "simulated telemetry",
  device: { id: 1, kind: "SOUNDBOX", serial: "SB-1", status: "ONLINE", pairing_ok: true },
  signal: { quality: "GOOD", dbm: -72 },
  heartbeat: { interval_s: 5, last_seen_at: "2026-10-30T12:00:00Z", median_rtt_ms: 85, missed_recent: 0, window: 24, series: [] },
  path: { device: "ok", link_tower: "ok", link_gateway: "ok", failing_hop: null },
  work: null,
  as_of: "2026-10-30T12:00:00Z",
  ...over,
});

describe("deriveScene", () => {
  it("healthy device: green, no checking", () => {
    const s = deriveScene(base());
    expect(s).toMatchObject({ mode: "healthy", checking: false, stage: null, linkTower: "ok" });
    expect(s.summary).toMatch(/connected/);
  });
  it("weak signal: degraded and paced slower", () => {
    const s = deriveScene(base({ path: { device: "ok", link_tower: "degraded", link_gateway: "ok", failing_hop: null } }));
    expect(s.mode).toBe("degraded");
    expect(s.pulseEveryS).toBeGreaterThan(deriveScene(base()).pulseEveryS);
  });
  it("names the failing hop in plain words", () => {
    const tower = deriveScene(base({ path: { device: "ok", link_tower: "down", link_gateway: "ok", failing_hop: "device_tower" } }));
    expect(tower.mode).toBe("broken");
    expect(tower.summary).toMatch(/cannot reach the cell site/);
    const dev = deriveScene(base({ path: { device: "fault", link_tower: "down", link_gateway: "ok", failing_hop: "device" } }));
    expect(dev.device).toBe("fault");
    expect(dev.summary).toMatch(/fault/);
  });
  it("shows what Saathi is doing only while the case is active", () => {
    const work = (active: boolean) => ({
      case_id: 3, summary: "x", status: active ? ("IN_PROGRESS" as const) : ("RESOLVED" as const), active,
      steps: [{ seq: 1, kind: "ACT" as const, status: "OK" as const, title: "Remote fix", at: "2026-10-30T12:00:00Z" }],
    });
    const live = deriveScene(base({ work: work(true) }));
    expect(live.checking).toBe(true);
    expect(live.stage).toBe("Sending a command to the device");
    expect(live.summary).toMatch(/Saathi: sending a command/);
    expect(deriveScene(base({ work: work(false) })).checking).toBe(false);
  });
});

describe("heartbeatBars", () => {
  it("marks missed heartbeats as gaps and scales the rest", () => {
    const bars = heartbeatBars([{ t: "a", rtt_ms: null }, { t: "b", rtt_ms: 200 }, { t: "c", rtt_ms: 900 }]);
    expect(bars.map((b) => b.missed)).toEqual([true, false, false]);
    expect(bars[1].h).toBeCloseTo(0.5);
    expect(bars[2].h).toBe(1); // clamped
  });
});
