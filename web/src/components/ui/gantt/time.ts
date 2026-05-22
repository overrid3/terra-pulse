import {
  addDays, startOfDay, startOfMonth, endOfMonth, startOfWeek,
} from "date-fns";
import type { GanttView } from "./types";

// Day view renders 06:00 -> 20:00 (14 hours)
export const DAY_HOUR_START = 6;
export const DAY_HOUR_END = 20;
export const DAY_HOURS = DAY_HOUR_END - DAY_HOUR_START;

/** Returns [winStart, winEnd] in the user's local timezone matching the rendered grid. */
export function dayBoundary(d: Date): [Date, Date] {
  const s = startOfDay(d);
  const start = new Date(s);
  start.setHours(DAY_HOUR_START, 0, 0, 0);
  const end = new Date(s);
  end.setHours(DAY_HOUR_END, 0, 0, 0);
  return [start, end];
}
export function weekBoundary(d: Date): [Date, Date] {
  const s = startOfWeek(d, { weekStartsOn: 1 });
  return [s, addDays(s, 7)];
}
export function monthBoundary(d: Date): [Date, Date] {
  const s = startOfDay(startOfMonth(d));
  return [s, startOfDay(addDays(endOfMonth(d), 1))];
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * Convert a horizontal cursor position inside the timeline rect to a Date
 * inside [winStart, winEnd], then snap to the view granularity.
 */
export function pxToTime(
  rect: { left: number; width: number },
  clientX: number,
  view: GanttView,
  winStart: Date,
  winEnd: Date,
): Date {
  if (rect.width <= 0) return new Date(winStart);
  const ratio = clamp01((clientX - rect.left) / rect.width);
  const totalMs = winEnd.getTime() - winStart.getTime();
  const raw = new Date(winStart.getTime() + ratio * totalMs);
  return snap(raw, view);
}

/** Snap to hour (day view) or local midnight (week/month). */
export function snap(d: Date, view: GanttView): Date {
  const r = new Date(d);
  if (view === "day") {
    const minutes = r.getMinutes();
    if (minutes >= 30) r.setHours(r.getHours() + 1);
    r.setMinutes(0, 0, 0);
    return r;
  }
  r.setHours(0, 0, 0, 0);
  return r;
}
