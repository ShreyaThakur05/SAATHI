import { describe, expect, it } from "vitest";
import { ALT_TEXT, frameAt, STEPS, TOTAL_MS, TRANSCRIPT } from "@/lib/agentDemo";

describe("hero walkthrough timeline", () => {
  it("starts empty and ends fully resolved", () => {
    const start = frameAt(0);
    expect(start).toMatchObject({ voice: false, ack: false, result: false, verified: false, progress: 0 });
    expect(start.steps.every((s) => s === "pending")).toBe(true);
    const end = frameAt(TOTAL_MS);
    expect(end.result && end.verified && end.ack).toBe(true);
    expect(end.steps.every((s) => s === "done")).toBe(true);
    expect(end.progress).toBe(1);
  });
  it("types the transcript out and then stops", () => {
    expect(frameAt(1100).transcriptChars).toBe(0);
    const mid = frameAt(2000).transcriptChars;
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(TRANSCRIPT.length);
    expect(frameAt(3100).transcriptChars).toBe(TRANSCRIPT.length);
  });
  it("shows typing before the acknowledgement, never both", () => {
    const f = frameAt(3500);
    expect(f.typing).toBe(true);
    expect(f.ack).toBe(false);
    expect(frameAt(4200)).toMatchObject({ typing: false, ack: true });
  });
  it("works the steps strictly in order, one running at a time", () => {
    for (let t = 0; t <= TOTAL_MS; t += 250) {
      const s = frameAt(t).steps;
      expect(s.filter((x) => x === "running").length).toBeLessThanOrEqual(1);
      const firstPending = s.indexOf("pending");
      if (firstPending >= 0) expect(s.slice(firstPending).every((x) => x === "pending")).toBe(true);
    }
  });
  it("only shows the result after every step is done, and proves before claiming success", () => {
    for (let t = 0; t <= TOTAL_MS; t += 250) {
      const f = frameAt(t);
      if (f.result) expect(f.steps.every((x) => x === "done")).toBe(true);
      if (f.verified) expect(f.result).toBe(true);
    }
  });
  it("clamps out-of-range times and has a text alternative", () => {
    expect(frameAt(-50).progress).toBe(0);
    expect(frameAt(TOTAL_MS * 3).progress).toBe(1);
    expect(STEPS).toHaveLength(6);
    expect(ALT_TEXT).toMatch(/two reference numbers/);
  });
});
