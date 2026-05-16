import { describe, it, expect } from "vitest";
import { pxToTime, snap } from "./gantt-time";

const RECT = { left: 0, width: 1200, right: 1200, top: 0, bottom: 100, height: 100, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;

describe("snap", () => {
  it("Day view snaps to nearest hour", () => {
    const d = new Date("2026-06-01T08:23:45Z");
    expect(snap(d, "day").toISOString()).toBe("2026-06-01T08:00:00.000Z");
  });

  it("Day view rounds up past 30min", () => {
    const d = new Date("2026-06-01T08:45:00Z");
    expect(snap(d, "day").toISOString()).toBe("2026-06-01T09:00:00.000Z");
  });

  it("Week view snaps to start of day", () => {
    const d = new Date("2026-06-01T15:30:00Z");
    expect(snap(d, "week").toISOString()).toBe("2026-06-01T00:00:00.000Z");
  });
});

describe("pxToTime", () => {
  it("midpoint of Day view returns middle hour", () => {
    const winStart = new Date("2026-06-01T00:00:00Z");
    const winEnd = new Date("2026-06-02T00:00:00Z");
    const t = pxToTime(RECT, 600, "day", winStart, winEnd);
    expect(t.toISOString()).toBe("2026-06-01T12:00:00.000Z");
  });
});
