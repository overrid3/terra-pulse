import React, { KeyboardEvent } from "react";
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
          currentMechanicId={order.mechanicId ?? ""}
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
          currentMechanicId={order.mechanicId ?? ""}
        />
      )}
    </div>
  );
}

function ResizeHandle({
  orderId, edge, scheduledStartAt, scheduledEndAt, currentMechanicId,
}: {
  orderId: string;
  edge: "start" | "end";
  scheduledStartAt: string;
  scheduledEndAt: string;
  currentMechanicId: string;
}) {
  const data: GanttResizeDragData = {
    kind: "resize",
    orderId,
    edge,
    scheduledStartAt,
    scheduledEndAt,
    currentMechanicId,
  };
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `resize:${orderId}:${edge}`,
    data,
  });

  // Compose dnd-kit listeners with our own stopPropagation so the parent chip
  // drag doesn't also start. We must invoke listeners.onMouseDown / onTouchStart
  // ourselves — spreading {...listeners} after our handler would clobber ours,
  // spreading it before lets React's later prop win and drop dnd-kit's.
  type AnyEvt = React.MouseEvent | React.TouchEvent | React.PointerEvent;
  const fwd = (key: "onMouseDown" | "onTouchStart" | "onPointerDown") =>
    (e: AnyEvt) => {
      const l = listeners as Partial<Record<typeof key, (ev: AnyEvt) => void>> | undefined;
      l?.[key]?.(e);
      e.stopPropagation();
    };

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      role="separator"
      aria-label={`Resize ${edge}`}
      className={cn(
        "absolute top-0 bottom-0 w-2 cursor-ew-resize hover:bg-[var(--color-brand-strong)] z-10 touch-none",
        edge === "start" ? "left-0" : "right-0",
        isDragging && "bg-[var(--color-brand-strong)]",
      )}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={fwd("onMouseDown")}
      onTouchStart={fwd("onTouchStart")}
      onPointerDown={fwd("onPointerDown")}
    />
  );
}
