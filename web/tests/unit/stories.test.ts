import { describe, expect, it } from "vitest";
import { FIX_MS, nextPhase, STORIES, storyFrame } from "@/lib/stories";

describe("story timeline", () => {
  it("starts empty and ends fully done", () => {
    const start = storyFrame(0);
    expect(start).toMatchObject({ typing: false, ack: false, reply: false, verified: false, finished: false });
    expect(start.steps.every((s) => s === "pending")).toBe(true);
    const end = storyFrame(FIX_MS);
    expect(end.steps.every((s) => s === "done")).toBe(true);
    expect(end).toMatchObject({ ack: true, reply: true, verified: true, finished: true });
  });
  it("types, then acknowledges, then works the steps one at a time, in order", () => {
    expect(storyFrame(500).typing).toBe(true);
    expect(storyFrame(1000)).toMatchObject({ typing: false, ack: true });
    for (let t = 0; t <= FIX_MS; t += 100) {
      const s = storyFrame(t).steps;
      expect(s.filter((x) => x === "running").length).toBeLessThanOrEqual(1);
      const firstPending = s.indexOf("pending");
      if (firstPending >= 0) expect(s.slice(firstPending).every((x) => x === "pending")).toBe(true);
    }
  });
  it("replies only after every step is done, and verifies after replying", () => {
    for (let t = 0; t <= FIX_MS; t += 100) {
      const f = storyFrame(t);
      if (f.reply) expect(f.steps.every((x) => x === "done")).toBe(true);
      if (f.verified) expect(f.reply).toBe(true);
    }
  });
});

describe("story phases", () => {
  const [soundbox, , settlement] = STORIES;
  it("walks healthy to broken to fixing to fixed, and ignores out-of-order actions", () => {
    let p = nextPhase("healthy", "fix", soundbox);
    expect(p).toBe("healthy"); // cannot fix what is not broken
    p = nextPhase(p, "break", soundbox);
    expect(p).toBe("broken");
    expect(nextPhase(p, "break", soundbox)).toBe("broken");
    p = nextPhase(p, "fix", soundbox);
    expect(p).toBe("fixing");
    expect(nextPhase(p, "break", soundbox)).toBe("fixing");
    expect(nextPhase(p, "done", soundbox)).toBe("fixed");
  });
  it("only the settlement story ends with a person's approval", () => {
    expect(nextPhase("fixed", "approve", soundbox)).toBe("fixed");
    expect(nextPhase("fixed", "approve", settlement)).toBe("approved");
    expect(nextPhase("approved", "reset", settlement)).toBe("healthy");
  });
  it("every scenario has six steps and a reply that never promises a settlement date", () => {
    for (const s of STORIES) {
      expect(s.steps).toHaveLength(6);
      expect(s.reply).not.toMatch(/\b(kal|tomorrow|by \d)/i);
    }
    expect(settlement.reply).toMatch(/vaada nahi/);
  });
});
