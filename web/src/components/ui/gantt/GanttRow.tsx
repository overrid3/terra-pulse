import type React from "react";
import { useMemo, useRef, useState } from "react";
import { useDndMonitor, useDroppable } from "@dnd-kit/core";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { Mechanic, MechanicAbsence, ServiceOrder } from "../../../types";
import { findConflicts, ScheduledItem } from "../../../lib/findConflicts";
import { GanttChip, LANE_HEIGHT_PX } from "./GanttChip";
import { GanttAbsenceBand } from "./GanttAbsenceBand";

const LANE_GAP_PX = 4;
const ROW_PADDING_PX = 4;
const BASE_ROW_MIN_HEIGHT_PX = 72;

const POOL_SNAP_MS = 30 * 60_000;
const RESIZE_SNAP_MS = 30 * 60_000;

// Snap a raw absolute time to the nearest wall-clock boundary (e.g. :00/:30)
// OR to the estimated boundary, whichever is closer to the raw position.
// Exported via duplication in DispatchPage (preview vs. commit must agree).
function snapResizeAbsolute(rawMs: number, stepMs: number, estMs: number): number {
  const wallMs = Math.round(rawMs / stepMs) * stepMs;
  return Math.abs(estMs - rawMs) < Math.abs(wallMs - rawMs) ? estMs : wallMs;
}

type ResizePreview = {
  edge: "start" | "end";
  leftPct: number;
  rightPct: number;
  startTime: Date;
  endTime: Date;
} | null;

type Props = {
  mechanic: Mechanic;
  orders: ServiceOrder[];
  absences: MechanicAbsence[];
  gridTemplate: string;
  minTimelineWidth: number;
  eventPosition: (s: Date, e: Date) => { leftPct: number; rightPct: number } | null;
  chipLabel: (o: ServiceOrder) => string;
  chipTitle: (o: ServiceOrder) => string;
  winStart: Date;
  winEnd: Date;
  onSelectOrder: (id: string) => void;
  onEditOrder: (id: string) => void;
  onUnassignOrder: (id: string) => void;
  onDeleteOrder: (id: string) => void;
  onAddAbsence: (mechanicId: string) => void;
  registerRow: (mechanicId: string, el: HTMLDivElement | null) => void;
};

function eventBounds(o: ServiceOrder) {
  // Planned dates are authoritative for the chip span. The estimation is
  // only a suggestion — once scheduled, the user controls start/end via
  // drag + resize handles. Fall back to estimation-derived end only when
  // no scheduledEndAt exists (REQUESTED/QUOTED/APPROVED rows that don't
  // normally render on the gantt anyway).
  const start = new Date(o.startedAt ?? o.scheduledStartAt ?? o.requestedAt);
  if (o.scheduledEndAt) return { start, end: new Date(o.scheduledEndAt) };
  const minutes = o.actualMinutes ?? o.estimatedMinutes;
  return { start, end: new Date(start.getTime() + minutes * 60_000) };
}

function estimateGhostBounds(o: ServiceOrder) {
  if (o.state !== "SCHEDULED" || !o.scheduledStartAt || !o.scheduledEndAt) return null;
  const start = new Date(o.scheduledStartAt);
  const scheduledMs = new Date(o.scheduledEndAt).getTime() - start.getTime();
  const estimatedMs = o.estimatedMinutes * 60_000;
  if (Math.abs(scheduledMs - estimatedMs) < 60_000) return null;
  return { start, end: new Date(start.getTime() + estimatedMs) };
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
  winStart, winEnd,
  onSelectOrder, onEditOrder, onUnassignOrder, onDeleteOrder,
  onAddAbsence, registerRow,
}: Props) {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const [cursorX, setCursorX] = useState<number | null>(null);
  const [resizePreview, setResizePreview] = useState<ResizePreview>(null);

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

  // While dnd-kit owns the pointer (during a drag) the browser's mousemove
  // events still fire on this row, but in practice React's onMouseMove can
  // miss frames depending on overlay z-order. Subscribe to the drag monitor
  // and derive cursorX from the activator event + cumulative delta — that
  // is what dnd-kit itself uses, so it's always in sync with isOver.
  useDndMonitor({
    onDragMove: (e) => {
      const activator = e.activatorEvent as MouseEvent | PointerEvent | TouchEvent | null;
      let baseX: number | null = null;
      if (activator) {
        if ("clientX" in activator && typeof (activator as MouseEvent).clientX === "number") {
          baseX = (activator as MouseEvent).clientX;
        } else if ("touches" in activator && (activator as TouchEvent).touches.length > 0) {
          baseX = (activator as TouchEvent).touches[0].clientX;
        }
      }
      const rect = rowRef.current?.getBoundingClientRect();
      if (rect && baseX != null) setCursorX(baseX + e.delta.x - rect.left);

      // Resize preview: only the row that owns the order being resized
      // computes & shows it. Anchor preview to the actual scheduled times
      // (not the chip's current visual span). Snap is *absolute* — to the
      // wall-clock :00/:30 boundary nearest the raw cursor position — with
      // the estimated boundary as an alternative candidate. Picks whichever
      // is closer to where the cursor actually is.
      const data = e.active.data.current as
        | { kind?: string; edge?: "start" | "end"; scheduledStartAt?: string; scheduledEndAt?: string; currentMechanicId?: string; estimatedMinutes?: number }
        | undefined;
      if (
        rect &&
        data?.kind === "resize" &&
        data.currentMechanicId === mechanic.id &&
        data.scheduledStartAt &&
        data.scheduledEndAt
      ) {
        const totalMs = winEnd.getTime() - winStart.getTime();
        const rawDelta = (e.delta.x / rect.width) * totalMs;
        const oldStart = new Date(data.scheduledStartAt);
        const oldEnd = new Date(data.scheduledEndAt);
        const estMs = (data.estimatedMinutes ?? 0) * 60_000;
        let newStart = oldStart;
        let newEnd = oldEnd;
        if (data.edge === "start") {
          const raw = oldStart.getTime() + rawDelta;
          const snapped = snapResizeAbsolute(raw, RESIZE_SNAP_MS, oldEnd.getTime() - estMs);
          const ns = new Date(snapped);
          if (ns < oldEnd) newStart = ns;
        } else {
          const raw = oldEnd.getTime() + rawDelta;
          const snapped = snapResizeAbsolute(raw, RESIZE_SNAP_MS, oldStart.getTime() + estMs);
          const ne = new Date(snapped);
          if (ne > oldStart) newEnd = ne;
        }
        const pos = eventPosition(newStart, newEnd);
        if (pos) {
          setResizePreview({
            edge: data.edge!,
            leftPct: pos.leftPct,
            rightPct: pos.rightPct,
            startTime: newStart,
            endTime: newEnd,
          });
        }
      } else {
        setResizePreview(null);
      }
    },
    onDragEnd:    () => { setCursorX(null); setResizePreview(null); },
    onDragCancel: () => { setCursorX(null); setResizePreview(null); },
  });

  const composedRef = (el: HTMLDivElement | null) => {
    setNodeRef(el);
    rowRef.current = el;
    registerRow(mechanic.id, el);
  };

  const activeData = active?.data?.current as
    | { kind?: string; orderState?: string; currentMechanicId?: string; estimatedMinutes?: number }
    | undefined;

  const dropCursor = useMemo(() => {
    if (!isOver || activeData?.kind !== "pool" || cursorX === null) return null;
    const width = rowRef.current?.getBoundingClientRect().width ?? 0;
    if (width === 0) return null;
    const ratio = Math.max(0, Math.min(1, cursorX / width));
    const totalMs = winEnd.getTime() - winStart.getTime();
    const rawMs = winStart.getTime() + ratio * totalMs;
    const snappedStartMs = Math.round(rawMs / POOL_SNAP_MS) * POOL_SNAP_MS;
    const estMin = activeData.estimatedMinutes ?? 0;
    const snappedEndMs = snappedStartMs + estMin * 60_000;
    const startPct = Math.max(0, Math.min(100, ((snappedStartMs - winStart.getTime()) / totalMs) * 100));
    const endPct = Math.max(0, Math.min(100, ((snappedEndMs - winStart.getTime()) / totalMs) * 100));
    return {
      startPct,
      endPct,
      startTime: new Date(snappedStartMs),
      endTime: new Date(snappedEndMs),
    };
  }, [isOver, activeData, cursorX, winStart, winEnd]);

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
        className="w-48 shrink-0 border-r border-[var(--color-hairline)] sticky left-0 bg-[var(--color-surface-panel)] group-hover:bg-[var(--color-surface-sunken)] z-10 flex items-center gap-2 px-3 py-2 relative"
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
          className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] bg-[var(--color-surface-panel)] group-hover:bg-[var(--color-surface-sunken)] border border-[var(--color-hairline)] rounded-[var(--radius-sm)] px-1.5 py-0.5 shadow-sm"
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
        onMouseMove={(e) => {
          const rect = rowRef.current?.getBoundingClientRect();
          if (rect) setCursorX(e.clientX - rect.left);
        }}
        onMouseLeave={() => setCursorX(null)}
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

        {dropCursor && (
          <>
            <div
              aria-hidden="true"
              className="absolute top-0 bottom-0 z-20 pointer-events-none rounded-[var(--radius-sm)] border border-[var(--color-brand)] bg-[color-mix(in_srgb,var(--color-brand)_18%,transparent)]"
              style={{ left: `${dropCursor.startPct}%`, right: `${100 - dropCursor.endPct}%` }}
            />
            <CalloutLine pct={dropCursor.startPct} time={dropCursor.startTime} variant="brand" anchor="start" />
            <CalloutLine pct={dropCursor.endPct}   time={dropCursor.endTime}   variant="brand" anchor="end" />
          </>
        )}

        {resizePreview && (
          <>
            <div
              aria-hidden="true"
              className="absolute top-0 bottom-0 z-20 pointer-events-none rounded-[var(--radius-sm)] border border-dashed border-[var(--color-brand-strong)] bg-[color-mix(in_srgb,var(--color-brand)_12%,transparent)]"
              style={{ left: `${resizePreview.leftPct}%`, right: `${resizePreview.rightPct}%` }}
            />
            <CalloutLine
              pct={resizePreview.leftPct}
              time={resizePreview.startTime}
              variant="strong"
              anchor="start"
              showGuide={resizePreview.edge === "start"}
            />
            <CalloutLine
              pct={100 - resizePreview.rightPct}
              time={resizePreview.endTime}
              variant="strong"
              anchor="end"
              showGuide={resizePreview.edge === "end"}
            />
          </>
        )}

        {orders.map((o) => {
          const ghost = estimateGhostBounds(o);
          if (!ghost) return null;
          const pos = eventPosition(ghost.start, ghost.end);
          if (!pos) return null;
          const lane = laneByOrder.get(o.id) ?? 0;
          const top = ROW_PADDING_PX + lane * (LANE_HEIGHT_PX + LANE_GAP_PX);
          return (
            <div
              key={`ghost:${o.id}`}
              aria-hidden="true"
              title={`Estimated ${o.estimatedMinutes}m`}
              className="absolute rounded-[var(--radius-sm)] border border-dashed border-[var(--color-text-muted)] opacity-40 pointer-events-none"
              style={{
                left: `${pos.leftPct}%`,
                right: `${pos.rightPct}%`,
                top,
                height: LANE_HEIGHT_PX,
              }}
            />
          );
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
              onEdit={onEditOrder}
              onUnassign={onUnassignOrder}
              onDelete={onDeleteOrder}
            />
          );
        })}

      </div>
    </div>
  );
}

function CalloutLine({
  pct, time, variant, anchor, showGuide = true,
}: {
  pct: number;
  time: Date;
  variant: "brand" | "strong";
  anchor: "start" | "end";
  showGuide?: boolean;
}) {
  const color = variant === "strong" ? "var(--color-brand-strong)" : "var(--color-brand)";
  return (
    <div
      aria-hidden="true"
      className="absolute top-0 bottom-0 pointer-events-none z-20"
      style={{ left: `${pct}%` }}
    >
      {showGuide && (
        <div className="absolute top-0 bottom-0 w-0.5" style={{ background: color }} />
      )}
      <span
        className="absolute -top-5 text-[10px] font-mono font-semibold whitespace-nowrap bg-[var(--color-surface-panel)] px-1 rounded shadow-sm"
        style={{
          color,
          [anchor === "start" ? "left" : "right"]: 0,
          transform: anchor === "start" ? "translateX(-50%)" : "translateX(50%)",
        } as React.CSSProperties}
      >
        {format(time, "HH:mm")}
      </span>
    </div>
  );
}
