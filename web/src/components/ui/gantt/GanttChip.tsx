import React, { KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { useDraggable } from "@dnd-kit/core";
import { Eye, Pencil, UserMinus, Trash2, MapPin, Truck, User, Clock } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useDateLocale } from "@/i18n/format";
import type { ServiceOrder, Vehicle } from "../../../types";
import type { GanttEventDragData, GanttResizeDragData } from "./types";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export const LANE_HEIGHT_PX = 28;

type Props = {
  order: ServiceOrder;
  mechanicName: string;
  vehicle: Vehicle | null;
  leftPct: number;
  rightPct: number;
  top: number;
  label: string;
  tooltip: string;
  hasConflict: boolean;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onUnassign: (id: string) => void;
  onDelete: (id: string) => void;
};

/** Mechanic-movable states (cross-row and time moves). */
const MOVABLE_STATES = new Set<ServiceOrder["state"]>(["SCHEDULED", "IN_PROGRESS"]);

export function GanttChip({
  order, mechanicName, vehicle, leftPct, rightPct, top, label, tooltip: _tooltip, hasConflict,
  onSelect, onEdit, onUnassign, onDelete,
}: Props) {
  const { t } = useTranslation();
  const locale = useDateLocale();
  const movable = MOVABLE_STATES.has(order.state);

  const siteAddr = order.siteName
    ?? (order.siteLocation
      ? `${order.siteLocation.lat.toFixed(3)}, ${order.siteLocation.lng.toFixed(3)}`
      : null);
  const timeRange = order.scheduledStartAt && order.scheduledEndAt
    ? `${format(new Date(order.scheduledStartAt), "HH:mm", { locale })} – ${format(new Date(order.scheduledEndAt), "HH:mm", { locale })}`
    : null;

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

  const canUnassign = order.state === "SCHEDULED";
  const canDelete = order.state !== "IN_PROGRESS";

  return (
    <ContextMenu>
      <Tooltip>
        <ContextMenuTrigger asChild>
          <TooltipTrigger asChild>
            <div
              ref={setNodeRef}
              {...attributes}
              {...listeners}
              aria-label={`${label}, ${mechanicName}, ${order.state}`}
              onClick={(e) => { e.stopPropagation(); onSelect(order.id); }}
              onDoubleClick={(e) => { e.stopPropagation(); onEdit(order.id); }}
              onKeyDown={onKeyDown}
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
                  estimatedMinutes={order.estimatedMinutes}
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
                  estimatedMinutes={order.estimatedMinutes}
                />
              )}
            </div>
          </TooltipTrigger>
        </ContextMenuTrigger>
        <TooltipContent side="top" align="start">
          {hasConflict && (
            <div className="mb-1.5 text-[var(--color-danger-fg)] font-semibold text-[11px]">
              {t("dispatch.tooltipConflict")}
            </div>
          )}
          <div className="font-semibold text-[12px] mb-1 leading-tight">
            {order.title ?? order.vmrsDescription ?? order.vmrsCode}
          </div>
          <div className="flex flex-col gap-1 text-[11px] text-[var(--color-text-muted)]">
            {order.clientName && (
              <div className="flex items-start gap-1.5">
                <User className="h-3 w-3 mt-0.5 shrink-0" aria-hidden="true" />
                <span className="text-[var(--color-text)]">{order.clientName}</span>
              </div>
            )}
            {siteAddr && (
              <div className="flex items-start gap-1.5">
                <MapPin className="h-3 w-3 mt-0.5 shrink-0" aria-hidden="true" />
                <span>{siteAddr}</span>
              </div>
            )}
            <div className="flex items-start gap-1.5">
              <span className="font-mono text-[10px] bg-[var(--color-surface-container)] border border-[var(--color-hairline)] rounded px-1 py-px shrink-0">
                {order.vmrsCode}
              </span>
              {order.vmrsDescription && <span>{order.vmrsDescription}</span>}
            </div>
            {vehicle && (
              <div className="flex items-start gap-1.5">
                <Truck className="h-3 w-3 mt-0.5 shrink-0" aria-hidden="true" />
                <span>{vehicle.make} {vehicle.model} · <span className="font-mono">{vehicle.serialNumber}</span></span>
              </div>
            )}
            <div className="flex items-start gap-1.5">
              <User className="h-3 w-3 mt-0.5 shrink-0" aria-hidden="true" />
              <span>{mechanicName}</span>
            </div>
            {timeRange && (
              <div className="flex items-start gap-1.5">
                <Clock className="h-3 w-3 mt-0.5 shrink-0" aria-hidden="true" />
                <span className="font-mono">{timeRange}</span>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onSelect={() => onSelect(order.id)}>
          <Eye className="mr-2 h-4 w-4" />
          {t("dispatch.menuViewDetails")}
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => onEdit(order.id)}>
          <Pencil className="mr-2 h-4 w-4" />
          {t("dispatch.menuEdit")}
        </ContextMenuItem>
        {canUnassign && (
          <ContextMenuItem onSelect={() => onUnassign(order.id)}>
            <UserMinus className="mr-2 h-4 w-4" />
            {t("dispatch.menuUnassign")}
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem
          variant="destructive"
          disabled={!canDelete}
          onSelect={() => canDelete && onDelete(order.id)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {t("dispatch.menuDelete")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

function ResizeHandle({
  orderId, edge, scheduledStartAt, scheduledEndAt, currentMechanicId, estimatedMinutes,
}: {
  orderId: string;
  edge: "start" | "end";
  scheduledStartAt: string;
  scheduledEndAt: string;
  currentMechanicId: string;
  estimatedMinutes: number;
}) {
  const data: GanttResizeDragData = {
    kind: "resize",
    orderId,
    edge,
    scheduledStartAt,
    scheduledEndAt,
    currentMechanicId,
    estimatedMinutes,
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
