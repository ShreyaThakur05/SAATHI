import { describe, expect, it } from "vitest";
import { clock, formatDuration, formatInr, formatPercent, humanize, relativeTime } from "@/lib/format";

describe("formatInr", () => {
  it("drops .00 and keeps real paise", () => {
    expect(formatInr("20.00")).toBe("₹20");
    expect(formatInr("1840")).toBe("₹1,840");
    expect(formatInr("48250")).toBe("₹48,250");
    expect(formatInr("19.5")).toBe("₹19.50");
  });
  it("is safe for missing or junk values", () => {
    expect(formatInr(null)).toBe("-");
    expect(formatInr(undefined)).toBe("-");
    expect(formatInr("abc")).toBe("-");
  });
});

describe("durations and rates", () => {
  it("formats seconds, minutes and hours", () => {
    expect(formatDuration(0.2)).toBe("<1s");
    expect(formatDuration(31)).toBe("31s");
    expect(formatDuration(125)).toBe("2m 5s");
    expect(formatDuration(3720)).toBe("1h 2m");
    expect(formatDuration(null)).toBe("-");
  });
  it("formats percentages without inventing data", () => {
    expect(formatPercent(0.6667)).toBe("67%");
    expect(formatPercent(null)).toBe("-");
  });
  it("formats the timeline clock like the deck (0:02 ... 0:31)", () => {
    expect(clock(2)).toBe("0:02");
    expect(clock(31)).toBe("0:31");
    expect(clock(65)).toBe("1:05");
    expect(clock(-3)).toBe("0:00");
  });
});

describe("relativeTime / humanize", () => {
  const now = new Date("2026-10-30T12:00:00Z").getTime();
  it("describes recent times", () => {
    expect(relativeTime("2026-10-30T11:59:58Z", now)).toBe("just now");
    expect(relativeTime("2026-10-30T11:59:20Z", now)).toBe("40s ago");
    expect(relativeTime("2026-10-30T11:50:00Z", now)).toBe("10m ago");
    expect(relativeTime("2026-10-30T09:00:00Z", now)).toBe("3h ago");
  });
  it("humanizes snake_case", () => expect(humanize("release_settlement_hold")).toBe("Release settlement hold"));
});

import { formatDate, formatSignedInr } from "@/lib/format";

describe("ledger formatting", () => {
  it("signs credits and debits", () => {
    expect(formatSignedInr("20.00")).toBe("+₹20");
    expect(formatSignedInr(-300)).toBe("-₹300");
    expect(formatSignedInr("1840")).toBe("+₹1,840");
    expect(formatSignedInr(0)).toBe("₹0");
    expect(formatSignedInr("junk")).toBe("-");
  });
  it("formats dates in en-IN", () => {
    expect(formatDate("2026-10-30T09:30:00Z")).toMatch(/30 Oct/);
  });
});
