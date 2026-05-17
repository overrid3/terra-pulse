import { useMemo, useRef } from "react";
import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import type { Mechanic, MechanicAbsence, ServiceOrder } from "../../../types";
import { findConflicts, ScheduledItem } from "../../../lib/findConflicts";
import { GanttChip, LANE_HEIGHT_PX } from "./GanttChip";
import { GanttAbsenceBand } from "./GanttAbsenceBand";

const LANE_GAP_PX = 4;
const ROW_PADDING_PX = 4;
const BASE_ROW_MIN_HEIGHT_PX = 72;

type Props = {
  mechanic: Mechanic;
  orders: ServiceOrder[];
  absences: MechanicAbsence[];
  gridTemplate: string;
  minTimelineWidth: number;
  eventPosition: (s: Date, e: Date) => { leftPct: number; rightPct: number } | null;
  chipLabel: (o: ServiceOrder) => string;
  chipTitle: (o: ServiceOrder) => string;
  onSelectOrder: (id: string) => void;
  onAddAbsence: (mechanicId: string) => void;
  registerRow: (mechanicId: string, el: HTMLDivElement | null) => void;
};

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
        placed = true;
        break;
      }
    }
    if (!placed) {
      laneByOrder.set(o.id, laneEndTimes.length);
      laneEndTimes.push(end.getTime());
    }
  }
  return { laneByOrder, lanes: Math.max(1, laneEndTimes.length) };
}

export function GanttRow({
  mechanic, orders, absences,
  gridTemplate, minTimelineWidth,
  eventPosition, chipLabel, chipTitle,
  onSelectOrder, onAddAbsence, registerRow,
}: Props) {
  const rowRef = useRef<HTMLDivElement | null>(null);

  const initials = mechanic.fullName
    .split(/\s+/).slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase()).join("");

  const { laneByOrder, lanes } = useMemo(() => assignLanes(orders), [orders]);
  const minHeight = Math.max(
    BASE_ROW_MIN_HEIGHT_PX,
    ROW_PADDING_PX * 2 + lanes * LANE_HEIGHT_PX + (lanes - 1) * LANE_GAP_PX,
  );

  const conflictIds = useMemo(() => {
    const items: ScheduledItem[] = [
      ...orders
        .filter((o) => o.scheduledStartAt && o.scheduledEndAt)
        .map((o) => ({
          id: o.id,
          startAt: new Date(o.scheduledStartAt!),
          endAt: new Date(o.scheduledEndAt!),
        })),
      ...absences.map((a) => ({
        id: `abs:${a.id}`,
        startAt: new Date(a.startAt),
        endAt: new Date(a.endAt),
      })),
    ];
    return findConflicts(items);
  }, [orders, absences]);

  const { isOver, setNodeRef, active } = useDroppable({
    id: `row:${mechanic.id}`,
    data: { kind: "row", mechanicId: mechanic.id },
  });

  const composedRef = (el: HTMLDivElement | null) => {
    setNodeRef(el);
    rowRef.current = el;
    registerRow(mechanic.id, el);
  };

  const activeData = active?.data?.current as
    | { kind?: string; orderState?: string; currentMechanicId?: string }
    | undefined;

  const validDrop: boolean | null =
    !active ? null :
    activeData?.kind === "pool" ? (activeData.orderState === "APPROVED") :
    activeData?.kind === "event" ? true :
    activeData?.kind === "resize" ? (activeData.currentMechanicId == null || activeData.currentMechanicId === mechanic.id) :
    false;

  return (
    <div
      role="row"
      className="flex border-b border-[var(--color-hairline)] group hover:bg-[var(--color-surface-sunken)] transition-colors"
      style={{ minHeight }}
    >
      <div
        role="rowheader"
        className="w-48 shrink-0 border-r border-[var(--color-hairline)] sticky left-0 bg-[var(--color-surface-panel)] group-hover:bg-[var(--color-surface-sunken)] z-10 flex items-center gap-2 px-3 py-2"
      >
        <div className="w-8 h-8 rounded bg-[var(--color-surface-container-highest)] border border-[var(--color-hairline)] flex items-center justify-center font-mono text-xs shrink-0">
          {initials || "??"}
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="font-medium text-sm text-[var(--color-text)] truncate">{mechanic.fullName}</span>
          <span className="text-xs font-mono text-[var(--color-text-muted)] truncate flex items-center gap-1">
            <span className={cn("status-dot", `dot-${mechanic.status}`)} aria-hidden="true" />
            {mechanic.status}
          </span>
        </div>
        <button
          type="button"
          className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] px-1 shrink-0"
          onClick={(e) => { e.stopPropagation(); onAddAbsence(mechanic.id); }}
          aria-label={`Add absence for ${mechanic.fullName}`}
        >
          + Absence
        </button>
      </div>
      <div
        ref={composedRef}
        role="gridcell"
        aria-label={`${mechanic.fullName} timeline`}
        className={cn(
          "flex-1 relative",
          isOver && validDrop === true && "bg-[var(--color-brand-soft)]",
          isOver && validDrop === false && "bg-[color-mix(in_srgb,var(--color-danger)_15%,transparent)] ring-1 ring-[var(--color-danger)] ring-inset",
        )}
        style={{ minWidth: minTimelineWidth || undefined }}
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 grid pointer-events-none"
          style={{ gridTemplateColumns: gridTemplate }}
        >
          {gridTemplate.match(/\d+/) && Array.from({
            length: parseInt(gridTemplate.match(/\d+/)![0], 10),
          }).map((_, i) => (
            <div key={i} className="border-r border-[var(--color-hairline)] border-opacity-50" />
          ))}
        </div>

        {absences.map((a) => {
          const pos = eventPosition(new Date(a.startAt), new Date(a.endAt));
          if (!pos) return null;
          return <GanttAbsenceBand key={a.id} absence={a} leftPct={pos.leftPct} rightPct={pos.rightPct} />;
        })}

        {orders.map((o) => {
          const { start, end } = eventBounds(o);
          const pos = eventPosition(start, end);
          if (!pos) return null;
          const lane = laneByOrder.get(o.id) ?? 0;
          const top = ROW_PADDING_PX + lane * (LANE_HEIGHT_PX + LANE_GAP_PX);
          return (
            <GanttChip
              key={o.id}
              order={o}
              mechanicName={mechanic.fullName}
              leftPct={pos.leftPct}
              rightPct={pos.rightPct}
              top={top}
              label={chipLabel(o)}
              tooltip={chipTitle(o)}
              hasConflict={conflictIds.has(o.id)}
              onSelect={onSelectOrder}
            />
          );
        })}

      </div>
    </div>
  );
}
