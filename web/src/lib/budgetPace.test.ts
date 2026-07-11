import { describe, expect, it } from "vitest";
import { budgetPace, daysLeftInMonth } from "./budgetPace";

// 2026-07-11 07:00 Bangkok. July has 31 days -> 31 - 11 + 1 = 21 days left.
const now = new Date("2026-07-11T00:00:00.000Z");

describe("daysLeftInMonth", () => {
  it("counts remaining days inclusive of today for the current month", () => {
    expect(daysLeftInMonth("2026-07", now)).toBe(21);
  });
  it("returns 0 for a past or future month", () => {
    expect(daysLeftInMonth("2026-06", now)).toBe(0);
    expect(daysLeftInMonth("2026-08", now)).toBe(0);
  });
});

describe("budgetPace", () => {
  it("computes remaining and a floored daily pace", () => {
    // limit 10000, spent 4000 -> 6000 remaining over 21 days -> floor(285.7) = 285
    const p = budgetPace(10000, 4000, "2026-07", now);
    expect(p.remaining).toBe(6000);
    expect(p.daysLeft).toBe(21);
    expect(p.dailyPace).toBe(285);
  });

  it("returns negative remaining and null pace when over limit", () => {
    const p = budgetPace(5000, 8000, "2026-07", now);
    expect(p.remaining).toBe(-3000);
    expect(p.dailyPace).toBeNull();
  });

  it("returns null pace for a non-current month (no days left)", () => {
    const p = budgetPace(10000, 2000, "2026-06", now);
    expect(p.daysLeft).toBe(0);
    expect(p.dailyPace).toBeNull();
  });
});
