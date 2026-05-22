import { describe, it, expect } from "vitest";
import { pxToTime, snap, dayBoundary } from "./gantt-time";

const RECT = { left: 0, width: 1200 } as DOMRect;

describe("snap", () => {
  it("Day view snaps to nearest hour (local)", () => {
    const d = new Date(2026, 5, 1, 8, 23, 45);
    const s = snap(d, "day");
    expect(s.getHours()).toBe(8);
    expect(s.getMinutes()).toBe(0);
    expect(s.getSeconds()).toBe(0);
  });

  it("Day view rounds up past 30min", () => {
    const d = new Date(2026, 5, 1, 8, 45, 0);
    const s = snap(d, "day");
    expect(s.getHours()).toBe(9);
    expect(s.getMinutes()).toBe(0);
  });

  it("Week view snaps to start of day (local)", () => {
    const d = new Date(2026, 5, 1, 15, 30, 0);
    const s = snap(d, "week");
    expect(s.getHours()).toBe(0);
    expect(s.getMinutes()).toBe(0);
    expect(s.getSeconds()).toBe(0);
  });
});

describe("pxToTime (day view, 06:00-20:00 window)", () => {
  it("midpoint maps to 13:00", () => {
    const [winStart, winEnd] = dayBoundary(new Date(2026, 5, 1));
    const t = pxToTime(RECT, 600, "day", winStart, winEnd);
    expect(t.getHours()).toBe(13);
    expect(t.getMinutes()).toBe(0);
  });

  it("left edge maps to 06:00", () => {
    const [winStart, winEnd] = dayBoundary(new Date(2026, 5, 1));
    const t = pxToTime(RECT, 0, "day", winStart, winEnd);
    expect(t.getHours()).toBe(6);
  });

  it("right edge maps to 20:00", () => {
    const [winStart, winEnd] = dayBoundary(new Date(2026, 5, 1));
    const t = pxToTime(RECT, 1200, "day", winStart, winEnd);
    expect(t.getHours()).toBe(20);
  });
});
