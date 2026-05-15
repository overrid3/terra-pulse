import { useMemo, useState, DragEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  addDays, startOfDay, startOfMonth, endOfMonth, startOfWeek,
  format, getHours, getMinutes, getDaysInMonth, getDate
} from "date-fns";
import { Mechanic, MechanicAbsence, ServiceOrder, UUID } from "../types";
import { cn } from "@/lib/utils";

export type GanttView = "day" | "week" | "month";

export type DropPayload = {
  mechanicId: UUID;
  // Visual hour/day position the user dropped on. Backend has no scheduled-time field,
  // but kept here for future scheduling support and for callers to surface in toasts.
  hint?: { hour?: number; date?: Date };
};

type Props = {
  mechanics: Mechanic[];
  orders: ServiceOrder[];
  absences: MechanicAbsence[];
  selectedMechanicId: string | null;
  view: GanttView;
  date: Date;
  onSelectOrder: (id: string) => void;
  // Existing event dragged onto a (different) mechanic row.
  onMoveEvent: (orderId: UUID, payload: DropPayload) => void;
  // Outside pool card dropped onto a mechanic row.
  onDropFromPool: (payload: DropPayload) => void;
};

// Day view hour window. Keep narrow so cells are readable on a laptop.
const HOUR_START = 7;
const HOUR_END = 19;
const HOURS = HOUR_END - HOUR_START; // 12

function clampPct(n: number) {
  return Math.max(0, Math.min(100, n));
}

function dayBoundary(d: Date): [Date, Date] {
  const s = startOfDay(d);
  return [s, addDays(s, 1)];
}

function weekBoundary(d: Date): [Date, Date] {
  const s = startOfWeek(d, { weekStartsOn: 1 });
  return [s, addDays(s, 7)];
}

function monthBoundary(d: Date): [Date, Date] {
  const s = startOfDay(startOfMonth(d));
  const e = startOfDay(addDays(endOfMonth(d), 1));
  return [s, e];
}

export function DispatchGantt({
  mechanics, orders, absences, selectedMechanicId, view, date,
  onSelectOrder, onMoveEvent, onDropFromPool
}: Props) {
  const { t } = useTranslation();
  const [hoverRow, setHoverRow] = useState<string | null>(null);

  const visibleMechanics = selectedMechanicId
    ? mechanics.filter((m) => m.id === selectedMechanicId)
    : mechanics;

  const [winStart, winEnd] = useMemo(() => {
    if (view === "day")   return dayBoundary(date);
    if (view === "week")  return weekBoundary(date);
    return monthBoundary(date);
  }, [view, date]);

  const cols = useMemo(() => {
    if (view === "day")  return Array.from({ length: HOURS }, (_, i) => HOUR_START + i);
    if (view === "week") return Array.from({ length: 7 }, (_, i) => addDays(winStart, i));
    return Array.from({ length: getDaysInMonth(date) }, (_, i) => addDays(winStart, i));
  }, [view, winStart, date]);

  function eventPosition(start: Date, end: Date): { leftPct: number; rightPct: number } | null {
    if (end <= winStart || start >= winEnd) return null;
    const s = start < winStart ? winStart : start;
    const e = end > winEnd ? winEnd : end;

    if (view === "day") {
      const sH = getHours(s) + getMinutes(s) / 60;
      const eH = getHours(e) + getMinutes(e) / 60;
      const leftPct  = clampPct(((sH - HOUR_START) / HOURS) * 100);
      const rightPct = clampPct(((HOUR_END - eH) / HOURS) * 100);
      return { leftPct, rightPct };
    }
    const totalMs = winEnd.getTime() - winStart.getTime();
    const leftPct  = clampPct(((s.getTime() - winStart.getTime()) / totalMs) * 100);
    const rightPct = clampPct(((winEnd.getTime() - e.getTime()) / totalMs) * 100);
    return { leftPct, rightPct };
  }

  function ordersForRow(mechanicId: string): ServiceOrder[] {
    return orders.filter(
      (o) =>
        o.mechanicId === mechanicId &&
        (o.state === "DISPATCHED" || o.state === "IN_PROGRESS" || o.state === "COMPLETED")
    );
  }

  function absencesForRow(mechanicId: string): MechanicAbsence[] {
    return absences.filter((a) => a.mechanicId === mechanicId);
  }

  function eventBounds(o: ServiceOrder): { start: Date; end: Date } {
    const start = new Date(o.startedAt ?? o.dispatchedAt ?? o.requestedAt);
    const minutes = o.actualMinutes ?? o.estimatedMinutes;
    const end = new Date(start.getTime() + minutes * 60_000);
    return { start, end };
  }

  function dropHint(e: DragEvent<HTMLDivElement>): DropPayload["hint"] {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = rect.width === 0 ? 0 : x / rect.width;
    if (view === "day") {
      const hour = HOUR_START + pct * HOURS;
      return { hour: Math.round(hour) };
    }
    const totalMs = winEnd.getTime() - winStart.getTime();
    const ms = pct * totalMs;
    return { date: new Date(winStart.getTime() + ms) };
  }

  function handleRowDragOver(e: DragEvent<HTMLDivElement>, mechanicId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setHoverRow(mechanicId);
  }

  function handleRowDrop(e: DragEvent<HTMLDivElement>, mechanicId: string) {
    e.preventDefault();
    setHoverRow(null);
    const hint = dropHint(e);
    // Discriminate source via data-transfer payload:
    //   "pool:<orderId>"   = external pool card
    //   "event:<orderId>"  = existing calendar event being moved
    const raw = e.dataTransfer.getData("text/plain");
    if (!raw) return;
    if (raw.startsWith("pool:")) {
      onDropFromPool({ mechanicId: mechanicId as UUID, hint });
    } else if (raw.startsWith("event:")) {
      const orderId = raw.slice("event:".length);
      onMoveEvent(orderId as UUID, { mechanicId: mechanicId as UUID, hint });
    }
  }

  function handleEventDragStart(e: DragEvent<HTMLDivElement>, orderId: string) {
    e.dataTransfer.setData("text/plain", `event:${orderId}`);
    e.dataTransfer.effectAllowed = "move";
    e.stopPropagation();
  }

  // Column template string for the grid background lines + header.
  const gridTemplate = `repeat(${cols.length}, minmax(0, 1fr))`;

  // Pixel width hint for week/month so columns don't collapse on narrow screens.
  const minTimelineWidth =
    view === "day" ? 0 : view === "week" ? 720 : Math.max(960, cols.length * 40);

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-[var(--color-surface-panel)] rounded-[var(--radius-md)] overflow-hidden">
      {/* Header row */}
      <div className="flex border-b border-[var(--color-hairline)] bg-[var(--color-surface-sunken)] shrink-0 sticky top-0 z-20">
        <div className="w-48 shrink-0 border-r border-[var(--color-hairline)] flex items-center px-3 py-2 text-xs uppercase tracking-wider font-semibold text-[var(--color-text-muted)]">
          {t("mechanics.columnName")}
        </div>
        <div
          className="flex-1 grid"
          style={{ gridTemplateColumns: gridTemplate, minWidth: minTimelineWidth || undefined }}
        >
          {cols.map((c, i) => (
            <div
              key={i}
              className="border-r border-[var(--color-hairline)] flex items-center justify-center text-xs font-mono text-[var(--color-text-muted)] py-2"
            >
              {view === "day"   && `${String(c as number).padStart(2, "0")}:00`}
              {view === "week"  && format(c as Date, "EEE dd")}
              {view === "month" && (
                <span className={cn(getDate(c as Date) === getDate(new Date()) && "text-[var(--color-brand-strong)] font-bold")}>
                  {format(c as Date, "d")}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Body — scrollable */}
      <div className="flex-1 overflow-auto">
        {visibleMechanics.length === 0 && (
          <div className="p-6 text-center text-sm text-[var(--color-text-muted)]">
            {t("mechanics.noMechanics")}
          </div>
        )}
        {visibleMechanics.map((m) => {
          const initials = m.fullName.split(/\s+/).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join("");
          const rowOrders = ordersForRow(m.id);
          const rowAbsences = absencesForRow(m.id);
          return (
            <div key={m.id} className="flex border-b border-[var(--color-hairline)] min-h-[72px] group hover:bg-[var(--color-surface-sunken)] transition-colors">
              <div className="w-48 shrink-0 border-r border-[var(--color-hairline)] sticky left-0 bg-[var(--color-surface-panel)] group-hover:bg-[var(--color-surface-sunken)] z-10 flex items-center gap-2 px-3 py-2">
                <div className="w-8 h-8 rounded bg-[var(--color-surface-container-highest)] border border-[var(--color-hairline)] flex items-center justify-center font-mono text-xs shrink-0">
                  {initials || "??"}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-medium text-sm text-[var(--color-text)] truncate">{m.fullName}</span>
                  <span className="text-xs font-mono text-[var(--color-text-muted)] truncate flex items-center gap-1">
                    <span className={cn("status-dot", `dot-${m.status}`)} aria-hidden="true" />
                    {m.status}
                  </span>
                </div>
              </div>
              <div
                className={cn(
                  "flex-1 relative",
                  hoverRow === m.id && "bg-[var(--color-brand-soft)]"
                )}
                style={{ minWidth: minTimelineWidth || undefined }}
                onDragOver={(e) => handleRowDragOver(e, m.id)}
                onDragLeave={() => setHoverRow((cur) => (cur === m.id ? null : cur))}
                onDrop={(e) => handleRowDrop(e, m.id)}
              >
                {/* Grid background */}
                <div
                  className="absolute inset-0 grid pointer-events-none"
                  style={{ gridTemplateColumns: gridTemplate }}
                >
                  {cols.map((_, i) => (
                    <div key={i} className="border-r border-[var(--color-hairline)] border-opacity-50" />
                  ))}
                </div>
                {/* Absences (background, dimmed) */}
                {rowAbsences.map((a) => {
                  const pos = eventPosition(new Date(a.startAt), new Date(a.endAt));
                  if (!pos) return null;
                  return (
                    <div
                      key={a.id}
                      className={cn(
                        "absolute top-1 bottom-1 rounded-[var(--radius-sm)] border border-dashed flex items-center px-2 text-xs",
                        `absence-${a.type}`
                      )}
                      style={{ left: `${pos.leftPct}%`, right: `${pos.rightPct}%`, opacity: 0.7 }}
                      title={`${t(`absenceType.${a.type}`)}${a.reason ? ` · ${a.reason}` : ""}`}
                    >
                      <span className="truncate font-mono uppercase tracking-wider">
                        {t(`absenceType.${a.type}`)}
                      </span>
                    </div>
                  );
                })}
                {/* Orders (foreground, draggable) */}
                {rowOrders.map((o) => {
                  const { start, end } = eventBounds(o);
                  const pos = eventPosition(start, end);
                  if (!pos) return null;
                  return (
                    <div
                      key={o.id}
                      draggable
                      onDragStart={(e) => handleEventDragStart(e, o.id)}
                      onClick={(e) => { e.stopPropagation(); onSelectOrder(o.id); }}
                      className={cn(
                        "absolute top-2 bottom-2 rounded-[var(--radius-sm)] border px-2 py-1 cursor-grab active:cursor-grabbing flex flex-col justify-center overflow-hidden shadow-sm hover:brightness-95",
                        `state-${o.state}`
                      )}
                      style={{ left: `${pos.leftPct}%`, right: `${pos.rightPct}%` }}
                      title={o.title ?? o.vmrsCode}
                    >
                      <div className="flex items-center justify-between gap-1 min-w-0">
                        <span className="font-mono text-[10px] font-bold tracking-wider truncate">{o.vmrsCode}</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                      </div>
                      <div className="text-xs truncate">{o.title ?? o.vmrsDescription ?? o.vmrsCode}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
