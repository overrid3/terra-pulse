import { useMemo, useRef, KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import {
  addDays, startOfDay, startOfMonth, endOfMonth, startOfWeek,
  format, getHours, getMinutes, getDaysInMonth, getDate
} from "date-fns";
import { Mechanic, MechanicAbsence, ServiceOrder } from "../types";
import { cn } from "@/lib/utils";

const LANE_HEIGHT_PX = 28;
const LANE_GAP_PX = 4;
const ROW_PADDING_PX = 4;
const BASE_ROW_MIN_HEIGHT_PX = 72;

export type GanttView = "day" | "week" | "month";

export function dayBoundary(d: Date): [Date, Date]   { const s = startOfDay(d); return [s, addDays(s, 1)]; }
export function weekBoundary(d: Date): [Date, Date]  { const s = startOfWeek(d, { weekStartsOn: 1 }); return [s, addDays(s, 7)]; }
export function monthBoundary(d: Date): [Date, Date] { const s = startOfDay(startOfMonth(d)); return [s, startOfDay(addDays(endOfMonth(d), 1))]; }

type Props = {
  mechanics: Mechanic[];
  orders: ServiceOrder[];
  absences: MechanicAbsence[];
  selectedMechanicId: string | null;
  view: GanttView;
  date: Date;
  winStart: Date;
  winEnd: Date;
  onSelectOrder: (id: string) => void;
  registerRow: (mechanicId: string, el: HTMLDivElement | null) => void;
};

const HOUR_START = 7;
const HOUR_END = 19;
const HOURS = HOUR_END - HOUR_START;

function clampPct(n: number) { return Math.max(0, Math.min(100, n)); }

export function DispatchGantt({ mechanics, orders, absences, selectedMechanicId, view, date, winStart, winEnd, onSelectOrder, registerRow }: Props) {
  const { t } = useTranslation();
  const visibleMechanics = selectedMechanicId ? mechanics.filter((m) => m.id === selectedMechanicId) : mechanics;

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
      return { leftPct: clampPct(((sH - HOUR_START) / HOURS) * 100), rightPct: clampPct(((HOUR_END - eH) / HOURS) * 100) };
    }
    const totalMs = winEnd.getTime() - winStart.getTime();
    return {
      leftPct: clampPct(((s.getTime() - winStart.getTime()) / totalMs) * 100),
      rightPct: clampPct(((winEnd.getTime() - e.getTime()) / totalMs) * 100),
    };
  }

  function ordersForRow(id: string) {
    return orders.filter((o) => o.mechanicId === id && (o.state === "SCHEDULED" || o.state === "IN_PROGRESS" || o.state === "COMPLETED"));
  }
  function absencesForRow(id: string) { return absences.filter((a) => a.mechanicId === id); }

  function eventBounds(o: ServiceOrder) {
    const start = new Date(o.startedAt ?? o.scheduledStartAt ?? o.requestedAt);
    const minutes = o.actualMinutes ?? o.estimatedMinutes;
    return { start, end: new Date(start.getTime() + minutes * 60_000) };
  }

  function assignLanes(items: ServiceOrder[]) {
    const sorted = [...items].sort((a, b) => eventBounds(a).start.getTime() - eventBounds(b).start.getTime());
    const laneEndTimes: number[] = [];
    const laneByOrder = new Map<string, number>();
    for (const o of sorted) {
      const { start, end } = eventBounds(o);
      let placed = false;
      for (let i = 0; i < laneEndTimes.length; i++) {
        if (laneEndTimes[i] <= start.getTime()) {
          laneEndTimes[i] = end.getTime();
          laneByOrder.set(o.id, i);
          placed = true; break;
        }
      }
      if (!placed) { laneByOrder.set(o.id, laneEndTimes.length); laneEndTimes.push(end.getTime()); }
    }
    return { laneByOrder, lanes: Math.max(1, laneEndTimes.length) };
  }

  function chipLabel(o: ServiceOrder): string {
    return o.title ?? o.siteName ?? o.vmrsCode;
  }
  function chipTitle(o: ServiceOrder): string {
    const parts = [o.title, o.clientName, o.siteName, o.vmrsCode].filter(Boolean);
    return parts.join(" · ");
  }

  const gridTemplate = `repeat(${cols.length}, minmax(0, 1fr))`;
  const minTimelineWidth = view === "day" ? 0 : view === "week" ? 720 : Math.max(960, cols.length * 40);

  return (
    <div role="grid" aria-label={t("dispatch.pageTitle")}
         className="flex-1 min-h-0 flex flex-col bg-[var(--color-surface-panel)] rounded-[var(--radius-md)] overflow-hidden">
      <div role="row" className="flex border-b border-[var(--color-hairline)] bg-[var(--color-surface-sunken)] shrink-0 sticky top-0 z-20">
        <div role="columnheader" className="w-48 shrink-0 border-r border-[var(--color-hairline)] flex items-center px-3 py-2 text-xs uppercase tracking-wider font-semibold text-[var(--color-text-muted)]">
          {t("mechanics.columnName")}
        </div>
        <div className="flex-1 grid" style={{ gridTemplateColumns: gridTemplate, minWidth: minTimelineWidth || undefined }}>
          {cols.map((c, i) => (
            <div key={i} role="columnheader" className="border-r border-[var(--color-hairline)] flex items-center justify-center text-xs font-mono text-[var(--color-text-muted)] py-2">
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

      <div className="flex-1 overflow-auto">
        {visibleMechanics.length === 0 && (
          <div className="p-6 text-center text-sm text-[var(--color-text-muted)]">{t("mechanics.noMechanics")}</div>
        )}
        {visibleMechanics.map((m) => {
          const initials = m.fullName.split(/\s+/).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join("");
          const rowOrders = ordersForRow(m.id);
          const rowAbsences = absencesForRow(m.id);
          const { laneByOrder, lanes } = assignLanes(rowOrders);
          const rowMinHeight = Math.max(BASE_ROW_MIN_HEIGHT_PX, ROW_PADDING_PX * 2 + lanes * LANE_HEIGHT_PX + (lanes - 1) * LANE_GAP_PX);
          return (
            <MechanicRow key={m.id} mechanic={m} initials={initials} minHeight={rowMinHeight} gridTemplate={gridTemplate} minTimelineWidth={minTimelineWidth}
                         absences={rowAbsences} orders={rowOrders} laneByOrder={laneByOrder}
                         eventPosition={eventPosition} chipLabel={chipLabel} chipTitle={chipTitle}
                         onSelectOrder={onSelectOrder} t={t} cols={cols} registerRow={registerRow} />
          );
        })}
      </div>
    </div>
  );
}

type RowProps = {
  mechanic: Mechanic;
  initials: string;
  minHeight: number;
  gridTemplate: string;
  minTimelineWidth: number;
  absences: MechanicAbsence[];
  orders: ServiceOrder[];
  laneByOrder: Map<string, number>;
  eventPosition: (s: Date, e: Date) => { leftPct: number; rightPct: number } | null;
  chipLabel: (o: ServiceOrder) => string;
  chipTitle: (o: ServiceOrder) => string;
  onSelectOrder: (id: string) => void;
  t: (k: string, opts?: Record<string, unknown>) => string;
  cols: (number | Date)[];
  registerRow: (mechanicId: string, el: HTMLDivElement | null) => void;
};

function MechanicRow({
  mechanic, initials, minHeight, gridTemplate, minTimelineWidth,
  absences, orders, laneByOrder, eventPosition, chipLabel, chipTitle,
  onSelectOrder, t, cols, registerRow
}: RowProps) {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const { isOver, setNodeRef, active } = useDroppable({
    id: `row:${mechanic.id}`,
    data: { kind: "row", mechanicId: mechanic.id },
  });

  const composedRef = (el: HTMLDivElement | null) => {
    setNodeRef(el);
    rowRef.current = el;
    registerRow(mechanic.id, el);
  };

  const activeData = active?.data?.current as { kind?: string; orderId?: string; orderState?: string; currentMechanicId?: string } | undefined;
  const validDrop: boolean | null = !active ? null
    : activeData?.kind === "pool" ? (activeData.orderState === "APPROVED")
    : activeData?.kind === "event" ? (activeData.currentMechanicId !== mechanic.id)
    : false;

  return (
    <div role="row" className="flex border-b border-[var(--color-hairline)] group hover:bg-[var(--color-surface-sunken)] transition-colors" style={{ minHeight }}>
      <div role="rowheader" className="w-48 shrink-0 border-r border-[var(--color-hairline)] sticky left-0 bg-[var(--color-surface-panel)] group-hover:bg-[var(--color-surface-sunken)] z-10 flex items-center gap-2 px-3 py-2">
        <div className="w-8 h-8 rounded bg-[var(--color-surface-container-highest)] border border-[var(--color-hairline)] flex items-center justify-center font-mono text-xs shrink-0">{initials || "??"}</div>
        <div className="flex flex-col min-w-0">
          <span className="font-medium text-sm text-[var(--color-text)] truncate">{mechanic.fullName}</span>
          <span className="text-xs font-mono text-[var(--color-text-muted)] truncate flex items-center gap-1">
            <span className={cn("status-dot", `dot-${mechanic.status}`)} aria-hidden="true" />
            {mechanic.status}
          </span>
        </div>
      </div>
      <div
        ref={composedRef}
        role="gridcell"
        aria-label={`${mechanic.fullName} timeline`}
        className={cn(
          "flex-1 relative",
          isOver && validDrop === true && "bg-[var(--color-brand-soft)]",
          isOver && validDrop === false && "bg-[color-mix(in_srgb,var(--color-danger)_15%,transparent)] ring-1 ring-[var(--color-danger)] ring-inset"
        )}
        style={{ minWidth: minTimelineWidth || undefined }}
      >
        <div aria-hidden="true" className="absolute inset-0 grid pointer-events-none" style={{ gridTemplateColumns: gridTemplate }}>
          {cols.map((_, i) => <div key={i} className="border-r border-[var(--color-hairline)] border-opacity-50" />)}
        </div>
        {absences.map((a) => {
          const pos = eventPosition(new Date(a.startAt), new Date(a.endAt));
          if (!pos) return null;
          return (
            <div key={a.id} role="img"
                 aria-label={`${t(`absenceType.${a.type}`)}${a.reason ? `: ${a.reason}` : ""}`}
                 className={cn("absolute top-1 bottom-1 rounded-[var(--radius-sm)] border border-dashed flex items-center px-2 text-xs", `absence-${a.type}`)}
                 style={{ left: `${pos.leftPct}%`, right: `${pos.rightPct}%`, opacity: 0.7 }}
                 title={`${t(`absenceType.${a.type}`)}${a.reason ? ` · ${a.reason}` : ""}`}>
              <span className="truncate font-mono uppercase tracking-wider">{t(`absenceType.${a.type}`)}</span>
            </div>
          );
        })}
        {orders.map((o) => {
          const startD = new Date(o.startedAt ?? o.scheduledStartAt ?? o.requestedAt);
          const mins = o.actualMinutes ?? o.estimatedMinutes;
          const end = new Date(startD.getTime() + mins * 60_000);
          const pos = eventPosition(startD, end);
          if (!pos) return null;
          const lane = laneByOrder.get(o.id) ?? 0;
          const top = ROW_PADDING_PX + lane * (LANE_HEIGHT_PX + LANE_GAP_PX);
          return (
            <EventChip key={o.id} order={o} mechanicName={mechanic.fullName}
                       pos={pos} top={top} label={chipLabel(o)} tooltip={chipTitle(o)}
                       onSelect={onSelectOrder} />
          );
        })}
      </div>
    </div>
  );
}

function EventChip({
  order, mechanicName, pos, top, label, tooltip, onSelect
}: {
  order: ServiceOrder; mechanicName: string;
  pos: { leftPct: number; rightPct: number }; top: number;
  label: string; tooltip: string;
  onSelect: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `event:${order.id}`,
    data: {
      kind: "event",
      orderId: order.id,
      orderState: order.state,
      currentMechanicId: order.mechanicId,
      scheduledStartAt: order.scheduledStartAt,
      scheduledEndAt: order.scheduledEndAt,
    },
  });

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(order.id); }
  }

  return (
    <div
      ref={setNodeRef}
      aria-label={`${label}, ${mechanicName}, ${order.state}`}
      onClick={(e) => { e.stopPropagation(); onSelect(order.id); }}
      onKeyDown={onKeyDown}
      title={tooltip}
      {...listeners}
      {...attributes}
      className={cn(
        "absolute rounded-[var(--radius-sm)] border px-2 py-1 cursor-grab active:cursor-grabbing flex items-center justify-between gap-1 overflow-hidden shadow-sm hover:brightness-95 active:brightness-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] focus-visible:ring-offset-1",
        `state-${order.state}`,
        isDragging && "opacity-40"
      )}
      style={{ left: `${pos.leftPct}%`, right: `${pos.rightPct}%`, top, height: LANE_HEIGHT_PX, minWidth: "2rem" }}
    >
      <span className="text-[11px] font-semibold truncate min-w-0">{label}</span>
      <span className="font-mono text-[9px] tracking-wider opacity-70 shrink-0">{order.vmrsCode}</span>
    </div>
  );
}
