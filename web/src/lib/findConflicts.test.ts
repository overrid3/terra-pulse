import { describe, it, expect } from "vitest";
import { findConflicts, ScheduledItem } from "./findConflicts";

const mk = (id: string, startISO: string, endISO: string): ScheduledItem => ({
  id, startAt: new Date(startISO), endAt: new Date(endISO),
});

describe("findConflicts", () => {
  it("returns empty for non-overlapping items", () => {
    const items = [
      mk("a", "2026-06-01T08:00Z", "2026-06-01T09:00Z"),
      mk("b", "2026-06-01T10:00Z", "2026-06-01T11:00Z"),
    ];
    expect(findConflicts(items)).toEqual(new Set());
  });

  it("touching edges = no conflict", () => {
    const items = [
      mk("a", "2026-06-01T08:00Z", "2026-06-01T09:00Z"),
      mk("b", "2026-06-01T09:00Z", "2026-06-01T10:00Z"),
    ];
    expect(findConflicts(items).size).toBe(0);
  });

  it("overlap returns both ids", () => {
    const items = [
      mk("a", "2026-06-01T08:00Z", "2026-06-01T10:00Z"),
      mk("b", "2026-06-01T09:00Z", "2026-06-01T11:00Z"),
    ];
    expect(findConflicts(items)).toEqual(new Set(["a", "b"]));
  });

  it("nested overlap returns both", () => {
    const items = [
      mk("a", "2026-06-01T08:00Z", "2026-06-01T12:00Z"),
      mk("b", "2026-06-01T09:00Z", "2026-06-01T10:00Z"),
    ];
    expect(findConflicts(items)).toEqual(new Set(["a", "b"]));
  });

  it("three-way overlap returns all", () => {
    const items = [
      mk("a", "2026-06-01T08:00Z", "2026-06-01T10:00Z"),
      mk("b", "2026-06-01T09:00Z", "2026-06-01T11:00Z"),
      mk("c", "2026-06-01T08:30Z", "2026-06-01T09:30Z"),
    ];
    expect(findConflicts(items)).toEqual(new Set(["a", "b", "c"]));
  });
});
