import { describe, expect, it } from "vitest";
import { currentMonth, dayLabel, monthLabel, prevMonth, today } from "./format";

// Fixed instant: 2026-07-11 00:00 UTC = 07:00 Asia/Bangkok, same calendar day.
const now = new Date("2026-07-11T00:00:00.000Z");

describe("currentMonth / today (Asia/Bangkok)", () => {
  it("returns YYYY-MM", () => expect(currentMonth(now)).toBe("2026-07"));
  it("returns YYYY-MM-DD", () => expect(today(now)).toBe("2026-07-11"));

  it("rolls to next Bangkok day past 17:00 UTC", () => {
    // 2026-07-11 17:30 UTC = 00:30 Bangkok on the 12th.
    const late = new Date("2026-07-11T17:30:00.000Z");
    expect(today(late)).toBe("2026-07-12");
  });
});

describe("monthLabel", () => {
  it("formats a human month", () => expect(monthLabel("2026-07")).toBe("July 2026"));
  it("handles January", () => expect(monthLabel("2026-01")).toBe("January 2026"));
});

describe("prevMonth", () => {
  it("steps back within a year", () => expect(prevMonth("2026-07")).toBe("2026-06"));
  it("rolls across a year boundary", () => expect(prevMonth("2026-01")).toBe("2025-12"));
});

describe("dayLabel", () => {
  it("labels today", () => expect(dayLabel("2026-07-11", now)).toBe("Today"));
  it("labels yesterday", () => expect(dayLabel("2026-07-10", now)).toBe("Yesterday"));
  it("labels older dates with weekday", () =>
    expect(dayLabel("2026-07-04", now)).toMatch(/^Sat,? 4 Jul$/));
});
