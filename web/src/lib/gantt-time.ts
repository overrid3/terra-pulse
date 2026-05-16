export type GanttView = "day" | "week" | "month";

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

function utcStartOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function pxToTime(
  rect: DOMRect, clientX: number, view: GanttView, winStart: Date, winEnd: Date
): Date {
  const ratio = clamp01((clientX - rect.left) / rect.width);
  const totalMs = winEnd.getTime() - winStart.getTime();
  return snap(new Date(winStart.getTime() + ratio * totalMs), view);
}

export function snap(d: Date, view: GanttView): Date {
  if (view === "day") {
    const minutes = d.getUTCMinutes();
    const rounded = new Date(d);
    if (minutes >= 30) rounded.setUTCHours(d.getUTCHours() + 1);
    rounded.setUTCMinutes(0, 0, 0);
    return rounded;
  }
  return utcStartOfDay(d);
}
