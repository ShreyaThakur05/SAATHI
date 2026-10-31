import { describe, expect, it } from "vitest";
import { parseSse } from "@/lib/useCaseStream";

describe("parseSse", () => {
  it("parses a step frame", () => {
    expect(parseSse('event: step\ndata: {"seq": 3, "kind": "PROVE"}')).toEqual({ event: "step", data: { seq: 3, kind: "PROVE" } });
  });
  it("ignores empty, comment-only and malformed frames", () => {
    expect(parseSse("")).toBeNull();
    expect(parseSse(": keepalive")).toBeNull();
    expect(parseSse("event: step\ndata: {not json")).toBeNull();
  });
});
