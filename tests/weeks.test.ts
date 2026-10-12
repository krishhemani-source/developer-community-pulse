import { describe, expect, it } from "vitest";
import { backfillPlan, dateInZone, daysBetween, formatWeekRange, weeksOverlap, windowEndingAt } from "@/lib/weeks";

const IST = "Asia/Kolkata";

describe("cron timing", () => {
  it("02:30 UTC on Friday is 08:00 IST the same Friday", () => {
    const cron = new Date("2026-10-09T02:30:00Z"); // a Friday
    const ist = new Intl.DateTimeFormat("en-GB", { timeZone: IST, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(cron);
    expect(ist).toBe("Fri 08:00");
  });
});

describe("dateInZone", () => {
  it("uses the IST calendar date, not the UTC one", () => {
    // 20:00 UTC on 8 Oct is 01:30 IST on 9 Oct.
    expect(dateInZone(new Date("2026-10-08T20:00:00Z"), IST)).toBe("2026-10-09");
  });
});

describe("windowEndingAt", () => {
  it("is the 7 days ending at the run time, labelled with IST dates", () => {
    const w = windowEndingAt(new Date("2026-10-09T02:30:00Z"), IST);
    expect(w.start.toISOString()).toBe("2026-10-02T02:30:00.000Z");
    expect(w.weekStart).toBe("2026-10-02");
    expect(w.weekEnd).toBe("2026-10-09");
  });
});

describe("weeksOverlap", () => {
  it("treats week starts within 3 days as the same week", () => {
    expect(weeksOverlap("2026-10-02", "2026-10-05")).toBe(true);
    expect(weeksOverlap("2026-10-02", "2026-10-06")).toBe(false);
    expect(daysBetween("2026-09-28", "2026-10-02")).toBe(4);
  });
});

describe("backfillPlan", () => {
  const anchor = new Date("2026-10-09T02:30:00Z");
  it("builds four weeks, oldest first, when nothing exists", () => {
    const plan = backfillPlan(anchor, [], IST, 4);
    expect(plan.map((w) => w.weekStart)).toEqual(["2026-09-11", "2026-09-18", "2026-09-25", "2026-10-02"]);
  });
  it("skips weeks that already exist (including near-overlaps)", () => {
    const plan = backfillPlan(anchor, ["2026-10-01", "2026-09-18"], IST, 4);
    expect(plan.map((w) => w.weekStart)).toEqual(["2026-09-11", "2026-09-25"]);
  });
  it("returns nothing when history is complete", () => {
    expect(backfillPlan(anchor, ["2026-09-11", "2026-09-18", "2026-09-25", "2026-10-02"], IST, 4)).toEqual([]);
  });
});

describe("formatWeekRange", () => {
  it("formats same-month and cross-month ranges", () => {
    expect(formatWeekRange("2026-10-02", "2026-10-09")).toBe("2–9 Oct 2026");
    expect(formatWeekRange("2026-09-28", "2026-10-05")).toBe("28 Sep – 5 Oct 2026");
  });
});
