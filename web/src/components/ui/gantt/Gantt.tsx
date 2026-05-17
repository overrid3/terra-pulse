import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  addDays, format, getHours, getMinutes, getDaysInMonth, getDate,
} from "date-fns";
import { cn } from "@/lib/utils";
import type { ServiceOrder } from "../../../types";
import { DAY_HOURS, DAY_HOUR_START, DAY_HOUR_END } from "./time";
import type { GanttRenderProps } from "./types";
import { GanttRow } from "./GanttRow";

function clampPct(n: number) { return Math.max(0, Math.min(100, n)); }

export function Gantt({
  mechanics, orders, absences, selectedMechanicId,
  view, date, winStart, winEnd,
  onSelectOrder, onAddAbsence, registerRow,
}: GanttRenderProps) {
  const { t } = useTranslation();
  const visibleMechanics = selectedMechanicId
    ? mechanics.filter((m) => m.id === selectedMechanicId)
    : mechanics;

  const cols = useMemo<(number | Date)[]>(() => {
    if (view === "day")
      return Array.from({ length: DAY_HOURS }, (_, i) => DAY_HOUR_START + i);
    if (view === "week")
      return Array.from({ length: 7 }, (_, i) => addDays(winStart, i));
    return Array.from({ length: getDaysInMonth(date) }, (_, i) => addDays(winStart, i));
  }, [view, winStart, date]);

  function eventPosition(start: Date, end: Date): { leftPct: number; rightPct: number } | null {
    if (end <= winStart || start >= winEnd) return null;
    const s = start < winStart ? winStart : start;
    const e = end > winEnd ? winEnd : end;
    if (view === "day") {
      const sH = getHours(s) + getMinutes(s) / 60;
      const eH = getHours(e) + getMinutes(e) / 60;
      return {
        leftPct: clampPct(((sH - DAY_HOUR_START) / DAY_HOURS) * 100),
        rightPct: clampPct(((DAY_HOUR_END - eH) / DAY_HOURS) * 100),
      };
    }
    const totalMs = winEnd.getTime() - winStart.getTime();
    return {
      leftPct: clampPct(((s.getTime() - winStart.getTime()) / totalMs) * 100),
      rightPct: clampPct(((winEnd.getTime() - e.getTime()) / totalMs) * 100),
    };
  }

  function ordersForRow(id: string) {
    return orders.filter(
      (o) =>
        o.mechanicId === id &&
        (o.state === "SCHEDULED" ||
          o.state === "IN_PROGRESS" ||
          o.state === "COMPLETED"),
    );
  }
  function absencesForRow(id: string) {
    return absences.filter((a) => a.mechanicId === id);
  }

  function chipLabel(o: ServiceOrder): string {
    return o.title ?? o.siteName ?? o.vmrsCode;
  }
  function chipTitle(o: ServiceOrder): string {
    return [o.title, o.clientName, o.siteName, o.vmrsCode].filter(Boolean).join(" · ");
  }

  const gridTemplate = `repeat(${cols.length}, minmax(0, 1fr))`;
  const minTimelineWidth =
    view === "day" ? 0 : view === "week" ? 720 : Math.max(960, cols.length * 40);

  return (
    <div
      role="grid"
      aria-label={t("dispatch.pageTitle")}
      className="flex-1 min-h-0 flex flex-col bg-[var(--color-surface-panel)] rounded-[var(--radius-md)] overflow-hidden"
    >
      {/* Header */}
      <div
        role="row"
        className="flex border-b border-[var(--color-hairline)] bg-[var(--color-surface-sunken)] shrink-0 sticky top-0 z-20"
      >
        <div
          role="columnheader"
          className="w-48 shrink-0 border-r border-[var(--color-hairline)] flex items-center px-3 py-2 text-xs uppercase tracking-wider font-semibold text-[var(--color-text-muted)]"
        >
          {t("mechanics.columnName")}
        </div>
        <div
          className="flex-1 grid"
          style={{ gridTemplateColumns: gridTemplate, minWidth: minTimelineWidth || undefined }}
        >
          {cols.map((c, i) => (
            <div
              key={i}
              role="columnheader"
              className="border-r border-[var(--color-hairline)] flex items-center justify-center text-xs font-mono text-[var(--color-text-muted)] py-2"
            >
              {view === "day" && `${String(c as number).padStart(2, "0")}:00`}
              {view === "week" && format(c as Date, "EEE dd")}
              {view === "month" && (
                <span
                  className={cn(
                    getDate(c as Date) === getDate(new Date()) &&
                      "text-[var(--color-brand-strong)] font-bold",
                  )}
                >
                  {format(c as Date, "d")}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-auto">
        {visibleMechanics.length === 0 && (
          <div className="p-6 text-center text-sm text-[var(--color-text-muted)]">
            {t("mechanics.noMechanics")}
          </div>
        )}
        {visibleMechanics.map((m) => (
          <GanttRow
            key={m.id}
            mechanic={m}
            orders={ordersForRow(m.id)}
            absences={absencesForRow(m.id)}
            gridTemplate={gridTemplate}
            minTimelineWidth={minTimelineWidth}
            eventPosition={eventPosition}
            chipLabel={chipLabel}
            chipTitle={chipTitle}
            onSelectOrder={onSelectOrder}
            onAddAbsence={onAddAbsence}
            registerRow={registerRow}
          />
        ))}
      </div>
    </div>
  );
}
