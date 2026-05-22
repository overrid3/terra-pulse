import { KeyboardEvent } from "react";
import { useDraggable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import type { ServiceOrder } from "../../../types";
import type { GanttEventDragData, GanttResizeDragData } from "./types";

export const LANE_HEIGHT_PX = 28;

type Props = {
  order: ServiceOrder;
  mechanicName: string;
  leftPct: number;
  rightPct: number;
  top: number;
  label: string;
  tooltip: string;
  hasConflict: boolean;
  onSelect: (id: string) => void;
};

/** Mechanic-movable states (cross-row and time moves). */
const MOVABLE_STATES = new Set<ServiceOrder["state"]>(["SCHEDULED", "IN_PROGRESS"]);

export function GanttChip({
  order, mechanicName, leftPct, rightPct, top, label, tooltip, hasConflict, onSelect,
}: Props) {
  const movable = MOVABLE_STATES.has(order.state);

  const dragData: GanttEventDragData = {
    kind: "event",
    orderId: order.id,
    orderState: order.state,
    currentMechanicId: order.mechanicId ?? "",
    scheduledStartAt: order.scheduledStartAt,
    scheduledEndAt: order.scheduledEndAt,
  };

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `event:${order.id}`,
    data: dragData,
    disabled: !movable,
  });

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(order.id);
    }
  }

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`${label}, ${mechanicName}, ${order.state}`}
      onClick={(e) => { e.stopPropagation(); onSelect(order.id); }}
      onKeyDown={onKeyDown}
      title={hasConflict ? "Conflicts with another order or absence on this mechanic" : tooltip}
      className={cn(
        "absolute rounded-[var(--radius-sm)] border px-2 py-1 flex items-center justify-between gap-1 overflow-hidden shadow-sm hover:brightness-95 active:brightness-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] focus-visible:ring-offset-1",
        movable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        `state-${order.state}`,
        isDragging && "opacity-40",
        hasConflict && "ring-2 ring-[var(--color-danger)]",
      )}
      style={{
        left: `${leftPct}%`,
        right: `${rightPct}%`,
        top,
        height: LANE_HEIGHT_PX,
        minWidth: "2rem",
      }}
    >
      {order.state === "SCHEDULED" && order.scheduledStartAt && order.scheduledEndAt && (
        <ResizeHandle
          orderId={order.id}
          edge="start"
          scheduledStartAt={order.scheduledStartAt}
          scheduledEndAt={order.scheduledEndAt}
        />
      )}
      <span className="text-[11px] font-semibold truncate min-w-0">{label}</span>
      <span className="font-mono text-[9px] tracking-wider opacity-70 shrink-0">
        {order.vmrsCode}
      </span>
      {order.state === "SCHEDULED" && order.scheduledStartAt && order.scheduledEndAt && (
        <ResizeHandle
          orderId={order.id}
          edge="end"
          scheduledStartAt={order.scheduledStartAt}
          scheduledEndAt={order.scheduledEndAt}
        />
      )}
    </div>
  );
}

function ResizeHandle({
  orderId, edge, scheduledStartAt, scheduledEndAt,
}: {
  orderId: string;
  edge: "start" | "end";
  scheduledStartAt: string;
  scheduledEndAt: string;
}) {
  const data: GanttResizeDragData = {
    kind: "resize",
    orderId,
    edge,
    scheduledStartAt,
    scheduledEndAt,
  };
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `resize:${orderId}:${edge}`,
    data,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      role="separator"
      aria-label={`Resize ${edge}`}
      className={cn(
        "absolute top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-[var(--color-brand-strong)] z-10",
        edge === "start" ? "left-0" : "right-0",
        isDragging && "bg-[var(--color-brand-strong)]",
      )}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
      onPointerDown={(e) => {
        // Call dnd-kit's own listener first so resize drag activates,
        // then stop propagation so the parent chip drag doesn't also start.
        (listeners as Record<string, (ev: typeof e) => void> | undefined)?.onPointerDown?.(e);
        e.stopPropagation();
      }}
    />
  );
}
