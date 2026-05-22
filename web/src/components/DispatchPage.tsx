import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Filter, RefreshCw, Inbox, MapPin, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { addDays, addMonths, addWeeks, startOfDay, format } from "date-fns";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  MouseSensor, TouchSensor, useSensor, useSensors, useDraggable,
} from "@dnd-kit/core";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import { mechanicsApi } from "../api/mechanics";
import { serviceOrdersApi, CreateOrderBody, ServiceOrderPatchBody } from "../api/serviceOrders";
import { absencesApi } from "../api/absences";
import { queryKeys } from "../api/client";
import { Gantt, dayBoundary, weekBoundary, monthBoundary } from "@/components/ui/gantt";
import type { GanttView } from "@/components/ui/gantt";
import { ServiceOrderDrawer } from "./ServiceOrderDrawer";
import { AbsencesPanel } from "./AbsencesPanel";
import { SearchInput } from "./SearchInput";
import { CreateOrderForm } from "./CreateOrderForm";
import { OrderEditForm, OrderSaveBody } from "./OrderEditForm";
import { ResizableSplitHandle } from "./ResizableSplitHandle";
import { useResizableSplit, useIsMobile } from "@/hooks/useResizableSplit";
import { ServiceOrder, MechanicAbsence, ServiceOrderState, UUID } from "../types";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const PENDING_STATES = new Set(["REQUESTED", "QUOTED", "APPROVED"]);

function priorityBadge(o: ServiceOrder): { key: string; cls: string } {
  if (o.state === "REQUESTED") return { key: "dispatch.priorityCritical",  cls: "state-REQUESTED" };
  if (o.state === "QUOTED")    return { key: "dispatch.priorityQuoted",    cls: "state-QUOTED" };
  return                              { key: "dispatch.priorityScheduled", cls: "state-APPROVED" };
}

const POOL_SNAP_MS = 30 * 60_000;
const EVENT_SNAP_MS = 15 * 60_000;
const RESIZE_SNAP_MS = 30 * 60_000;

function snapMs(ms: number, step: number): number {
  return Math.round(ms / step) * step;
}

function pxDeltaToMs(deltaPx: number, rowWidthPx: number, winStart: Date, winEnd: Date): number {
  if (rowWidthPx <= 0) return 0;
  const totalMs = winEnd.getTime() - winStart.getTime();
  return (deltaPx / rowWidthPx) * totalMs;
}

function cursorToTime(
  rect: DOMRect,
  clientX: number,
  winStart: Date,
  winEnd: Date,
): Date {
  const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  const totalMs = winEnd.getTime() - winStart.getTime();
  return new Date(winStart.getTime() + ratio * totalMs);
}

function intersectsAbsence(absences: MechanicAbsence[], mechanicId: string, start: Date, end: Date): boolean {
  for (const a of absences) {
    if (a.mechanicId !== mechanicId) continue;
    const aStart = new Date(a.startAt).getTime();
    const aEnd = new Date(a.endAt).getTime();
    if (aEnd > start.getTime() && aStart < end.getTime()) return true;
  }
  return false;
}

export function DispatchPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [selectedMechanicId, setSelectedMechanicId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<GanttView>("day");
  const [date, setDate] = useState<Date>(startOfDay(new Date()));
  const [createOpen, setCreateOpen] = useState(false);
  const [editOrderId, setEditOrderId] = useState<string | null>(null);
  const [deleteOrderId, setDeleteOrderId] = useState<string | null>(null);
  const [absenceMechanicId, setAbsenceMechanicId] = useState<string | null>(null);

  const [activeDrag, setActiveDrag] = useState<{ kind: string; orderId?: string } | null>(null);

  const isMobile = useIsMobile();
  const { panelRef: poolPanelRef, initialWidth: poolInitialWidth, startDrag: startPoolDrag } =
    useResizableSplit({
      storageKey: "tp.dispatch.poolWidth",
      defaultWidth: 320,
      minWidth: 240,
      maxWidth: 600,
      reverse: true,
    });

  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const registerRow = (mechanicId: string, el: HTMLDivElement | null) => {
    if (el) rowRefs.current.set(mechanicId, el);
    else    rowRefs.current.delete(mechanicId);
  };

  const [winStart, winEnd] = useMemo(() => {
    if (view === "day")  return dayBoundary(date);
    if (view === "week") return weekBoundary(date);
    return monthBoundary(date);
  }, [view, date]);

  const mechanicsQ = useQuery({ queryKey: queryKeys.mechanics,     queryFn: mechanicsApi.list });
  const ordersQ    = useQuery({ queryKey: queryKeys.serviceOrders, queryFn: serviceOrdersApi.list });

  const windowRange = useMemo(() => {
    const now = new Date();
    const from = new Date(now.getTime() - 3 * 86400_000).toISOString();
    const to   = new Date(now.getTime() + 14 * 86400_000).toISOString();
    return { from, to };
  }, []);
  const absencesQ = useQuery({
    queryKey: [...queryKeys.absences, "range", windowRange.from, windowRange.to] as const,
    queryFn: () => absencesApi.listInRange(windowRange.from, windowRange.to),
  });

  const invalidateOrders = () => qc.invalidateQueries({ queryKey: queryKeys.serviceOrders });

  const createMut = useMutation({
    mutationFn: (body: CreateOrderBody) => serviceOrdersApi.create(body),
    onSuccess: () => {
      invalidateOrders();
      setCreateOpen(false);
      toast.success(t("dispatch.orderCreatedToast"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const scheduleMut = useMutation({
    mutationFn: (args: { id: UUID; mechanicId: UUID; start: string; end: string }) =>
      serviceOrdersApi.schedule(args.id, { mechanicId: args.mechanicId, scheduledStartAt: args.start, scheduledEndAt: args.end }),
    onSuccess: () => { invalidateOrders(); toast.success(t("dispatch.scheduleSuccess")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rescheduleMut = useMutation({
    mutationFn: (args: { id: UUID; mechanicId?: UUID; start?: string; end?: string }) =>
      serviceOrdersApi.reschedule(args.id, {
        mechanicId: args.mechanicId,
        scheduledStartAt: args.start,
        scheduledEndAt: args.end,
      }),
    onSuccess: () => { invalidateOrders(); toast.success(t("dispatch.rescheduleSuccess")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const patchMut = useMutation({
    mutationFn: (args: { id: UUID; body: ServiceOrderPatchBody }) =>
      serviceOrdersApi.patch(args.id, args.body),
    onSuccess: () => { invalidateOrders(); toast.success(t("orders.savedToast")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const overrideMut = useMutation({
    mutationFn: (args: {
      id: UUID;
      body: { state: ServiceOrderState; reason: string; mechanicId?: string; actualMinutes?: number };
    }) => serviceOrdersApi.override(args.id, args.body),
    onSuccess: () => { invalidateOrders(); toast.success(t("orders.overriddenToast")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const unassignMut = useMutation({
    mutationFn: (id: UUID) => serviceOrdersApi.unassign(id),
    onSuccess: () => { invalidateOrders(); toast.success(t("dispatch.unassignSuccess")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: UUID) => serviceOrdersApi.delete(id),
    onSuccess: () => {
      invalidateOrders();
      setDeleteOrderId(null);
      if (selectedOrderId === deleteOrderId) setSelectedOrderId(null);
      toast.success(t("dispatch.deleteSuccess"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleEditSave(id: UUID, body: OrderSaveBody) {
    if (body.patch) await patchMut.mutateAsync({ id, body: body.patch });
    if (body.override) await overrideMut.mutateAsync({ id, body: body.override });
    setEditOrderId(null);
  }

  const selectedOrder = useMemo(
    () => ordersQ.data?.find((o) => o.id === selectedOrderId) ?? null,
    [ordersQ.data, selectedOrderId],
  );

  const q = search.trim().toLowerCase();
  const allOrders = ordersQ.data ?? [];

  const matchSearch = (o: ServiceOrder) => {
    if (!q) return true;
    return (
      (o.title ?? "").toLowerCase().includes(q) ||
      o.vmrsCode.toLowerCase().includes(q) ||
      (o.clientName ?? "").toLowerCase().includes(q)
    );
  };

  const unassigned = allOrders.filter((o) => PENDING_STATES.has(o.state) && !o.mechanicId).filter(matchSearch);
  const filteredOrders = allOrders.filter(matchSearch);

  function navigate(delta: -1 | 1) {
    if (view === "day")        setDate((d) => addDays(d, delta));
    else if (view === "week")  setDate((d) => addWeeks(d, delta));
    else                       setDate((d) => addMonths(d, delta));
  }

  function jumpToday() { setDate(startOfDay(new Date())); }

  function rangeLabel(): string {
    if (view === "day")   return format(date, "EEE dd MMM yyyy");
    if (view === "week")  return `${format(date, "MMM dd")} – ${format(addDays(date, 6), "MMM dd, yyyy")}`;
    return format(date, "MMMM yyyy");
  }

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  function handleDragStart(e: DragStartEvent) {
    const d = e.active.data.current as { kind?: string; orderId?: string } | undefined;
    setActiveDrag({ kind: d?.kind ?? "unknown", orderId: d?.orderId });
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveDrag(null);
    const a = e.active.data.current as
      | { kind?: string; orderId?: string; orderState?: string; currentMechanicId?: string;
          scheduledStartAt?: string; scheduledEndAt?: string; edge?: "start" | "end" }
      | undefined;
    const o = e.over?.data.current as { kind?: string; mechanicId?: string } | undefined;
    if (!a || !a.orderId) return;
    const absences = absencesQ.data ?? [];

    // Resize: anchor target mechanic to the source order's mechanic.
    if (a.kind === "resize" && a.scheduledStartAt && a.scheduledEndAt) {
      const targetMechanicId = (a.currentMechanicId || o?.mechanicId) as UUID | undefined;
      if (!targetMechanicId) return;
      const rect = rowRefs.current.get(targetMechanicId)?.getBoundingClientRect();
      if (!rect) return;
      const deltaMs = snapMs(pxDeltaToMs(e.delta.x, rect.width, winStart, winEnd), RESIZE_SNAP_MS);
      const oldStart = new Date(a.scheduledStartAt);
      const oldEnd = new Date(a.scheduledEndAt);
      if (a.edge === "start") {
        const newStart = new Date(oldStart.getTime() + deltaMs);
        if (newStart >= oldEnd) { toast.error(t("dispatch.errorStartBeforeEnd")); return; }
        if (intersectsAbsence(absences, targetMechanicId, newStart, oldEnd)) {
          toast.error(t("dispatch.errorBlockedByAbsence")); return;
        }
        rescheduleMut.mutate({ id: a.orderId as UUID, start: newStart.toISOString() });
      } else {
        const newEnd = new Date(oldEnd.getTime() + deltaMs);
        if (newEnd <= oldStart) { toast.error(t("dispatch.errorEndAfterStart")); return; }
        if (intersectsAbsence(absences, targetMechanicId, oldStart, newEnd)) {
          toast.error(t("dispatch.errorBlockedByAbsence")); return;
        }
        rescheduleMut.mutate({ id: a.orderId as UUID, end: newEnd.toISOString() });
      }
      return;
    }

    if (!o || o.kind !== "row" || !o.mechanicId) return;
    const mechanicId = o.mechanicId as UUID;
    const orderId = a.orderId as UUID;
    const rect = rowRefs.current.get(mechanicId)?.getBoundingClientRect();
    if (!rect) return;

    if (a.kind === "pool") {
      if (a.orderState !== "APPROVED") {
        toast.error(t("dispatch.errorMustBeApproved", { state: a.orderState }));
        return;
      }
      const order = ordersQ.data?.find((x) => x.id === orderId);
      if (!order) return;
      const cursorX = ((e.activatorEvent as MouseEvent | null)?.clientX ?? 0) + e.delta.x;
      const raw = cursorToTime(rect, cursorX, winStart, winEnd);
      const snappedMs = snapMs(raw.getTime(), POOL_SNAP_MS);
      const start = new Date(snappedMs);
      const end = new Date(snappedMs + order.estimatedMinutes * 60_000);
      if (intersectsAbsence(absences, mechanicId, start, end)) {
        toast.error(t("dispatch.errorBlockedByAbsence"));
        return;
      }
      scheduleMut.mutate({ id: orderId, mechanicId, start: start.toISOString(), end: end.toISOString() });
      return;
    }

    if (a.kind === "event") {
      if (!a.scheduledStartAt || !a.scheduledEndAt) return;
      const oldStart = new Date(a.scheduledStartAt);
      const oldEnd = new Date(a.scheduledEndAt);
      const deltaMs = snapMs(pxDeltaToMs(e.delta.x, rect.width, winStart, winEnd), EVENT_SNAP_MS);
      const newStart = new Date(oldStart.getTime() + deltaMs);
      const newEnd = new Date(oldEnd.getTime() + deltaMs);
      const sameRow = a.currentMechanicId === mechanicId;
      if (sameRow && deltaMs === 0) return;
      if (intersectsAbsence(absences, mechanicId, newStart, newEnd)) {
        toast.error(t("dispatch.errorBlockedByAbsence"));
        return;
      }
      rescheduleMut.mutate({
        id: orderId,
        mechanicId: sameRow ? undefined : mechanicId,
        start: newStart.toISOString(),
        end: newEnd.toISOString(),
      });
    }
  }

  // Resize is intrinsically a horizontal-only gesture; for event chip moves we
  // want vertical motion too so dnd-kit's collision detection picks up the row
  // the cursor enters (otherwise the dragged overlay never overlaps another
  // mechanic's row and cross-mechanic reassignment can't fire).
  const dndModifiers = activeDrag?.kind === "resize" ? [restrictToHorizontalAxis] : [];

  return (
    <DndContext sensors={sensors} modifiers={dndModifiers} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
    <div className="flex-1 min-h-0 flex flex-col">
      <header className="bg-[var(--color-surface-panel)] border-b border-[var(--color-hairline)] flex flex-wrap items-center justify-between gap-3 px-4 py-2 shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="m-0 text-xl font-semibold tracking-tight text-[var(--color-text)]">
            {t("dispatch.pageTitle")}
          </h1>
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={(v) => v && setView(v as GanttView)}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="day">{t("dispatch.viewDay")}</ToggleGroupItem>
            <ToggleGroupItem value="week">{t("dispatch.viewWeek")}</ToggleGroupItem>
            <ToggleGroupItem value="month">{t("dispatch.viewMonth")}</ToggleGroupItem>
          </ToggleGroup>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => navigate(-1)} aria-label={t("common.previous")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={jumpToday}>
              {t("dispatch.today")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(1)} aria-label={t("common.next")}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <span className="text-sm font-mono text-[var(--color-text-muted)] hidden md:inline">
            {rangeLabel()}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" />{t("dispatch.newOrder")}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{t("dispatch.newOrder")}</DialogTitle></DialogHeader>
              <CreateOrderForm
                submitting={createMut.isPending}
                onCancel={() => setCreateOpen(false)}
                onSubmit={(body) => createMut.mutate(body)}
              />
            </DialogContent>
          </Dialog>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t("dispatch.searchPlaceholder")}
            className="w-full sm:w-64"
          />
          <Select
            value={selectedMechanicId ?? "ALL"}
            onValueChange={(v) => setSelectedMechanicId(v === "ALL" ? null : v)}
          >
            <SelectTrigger size="sm" className="min-w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("mechanics.filterAll")}</SelectItem>
              {(mechanicsQ.data ?? []).map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.fullName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" aria-label={t("common.filter")}>
            <Filter className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" aria-label={t("common.refresh")} onClick={() => { ordersQ.refetch(); mechanicsQ.refetch(); absencesQ.refetch(); }}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="flex-1 min-h-0 min-w-0 p-3 flex flex-row gap-0">
        <section className="flex-1 min-w-0 border border-[var(--color-hairline)] rounded-[var(--radius-md)] flex flex-col min-h-0 overflow-hidden">
          <Gantt
            mechanics={mechanicsQ.data ?? []}
            orders={filteredOrders}
            absences={absencesQ.data ?? []}
            selectedMechanicId={selectedMechanicId}
            view={view}
            date={date}
            winStart={winStart}
            winEnd={winEnd}
            onSelectOrder={setSelectedOrderId}
            onEditOrder={setEditOrderId}
            onUnassignOrder={(id) => unassignMut.mutate(id as UUID)}
            onDeleteOrder={setDeleteOrderId}
            onAddAbsence={setAbsenceMechanicId}
            registerRow={registerRow}
          />
        </section>

        {!isMobile && <ResizableSplitHandle onStart={startPoolDrag} ariaLabel={t("dispatch.unassignedPool")} />}

        <aside
          ref={poolPanelRef}
          style={{ width: isMobile ? undefined : poolInitialWidth }}
          className="md:shrink-0 md:min-w-[240px] md:max-w-[600px] bg-[var(--color-surface-panel)] border border-[var(--color-hairline)] rounded-[var(--radius-md)] flex flex-col min-h-0 overflow-hidden"
        >
          <div className="px-3 py-2.5 border-b border-[var(--color-hairline)] bg-[var(--color-surface-sunken)] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Inbox className="h-4 w-4 text-[var(--color-text-muted)]" />
              <h2 className="m-0 text-sm font-semibold text-[var(--color-text)]">
                {t("dispatch.unassignedPool")}
              </h2>
            </div>
            <span className="bg-[var(--color-surface-container-highest)] text-[var(--color-text)] px-2 py-0.5 rounded-[var(--radius-sm)] text-xs font-bold font-mono">
              {unassigned.length}
            </span>
          </div>
          <ul
            role="list"
            aria-label={t("dispatch.unassignedPool")}
            className="flex-1 overflow-y-auto p-2 flex flex-col gap-2 list-none m-0"
          >
            {unassigned.length === 0 && (
              <li className="text-center text-[var(--color-text-muted)] text-sm py-6">
                {t("dispatch.pendingNone")}
              </li>
            )}
            {unassigned.map((o) => {
              const badge = priorityBadge(o);
              const badgeLabel = t(badge.key);
              const isCritical = o.state === "REQUESTED";
              const label = `${o.vmrsCode}, ${o.title ?? o.vmrsDescription ?? ""}, ${badgeLabel}, ${o.clientName ?? ""}`;
              return (
                <PoolCard
                  key={o.id}
                  order={o}
                  isSelected={o.id === selectedOrderId}
                  isCritical={isCritical}
                  badge={{ label: badgeLabel, cls: badge.cls }}
                  onSelect={setSelectedOrderId}
                  label={label}
                />
              );
            })}
          </ul>
        </aside>
      </main>

      {selectedOrder && (
        <ServiceOrderDrawer order={selectedOrder} onClose={() => setSelectedOrderId(null)} />
      )}

      <Dialog open={!!editOrderId} onOpenChange={(open) => !open && setEditOrderId(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("dispatch.editOrderTitle")}</DialogTitle>
            <DialogDescription>{t("dispatch.editOrderDescription")}</DialogDescription>
          </DialogHeader>
          {(() => {
            const order = ordersQ.data?.find((o) => o.id === editOrderId);
            if (!order) return null;
            return (
              <OrderEditForm
                order={order}
                submitting={patchMut.isPending || overrideMut.isPending}
                onCancel={() => setEditOrderId(null)}
                onSubmit={(body) => handleEditSave(order.id as UUID, body)}
              />
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteOrderId} onOpenChange={(open) => !open && setDeleteOrderId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("dispatch.deleteOrderTitle")}</DialogTitle>
            <DialogDescription>
              {(() => {
                const o = ordersQ.data?.find((x) => x.id === deleteOrderId);
                return t("dispatch.deleteOrderConfirm", { title: o?.title ?? o?.vmrsCode ?? "" });
              })()}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOrderId(null)}>{t("common.cancel")}</Button>
            <Button
              variant="destructive"
              disabled={deleteMut.isPending}
              onClick={() => deleteOrderId && deleteMut.mutate(deleteOrderId as UUID)}
            >
              {t("dispatch.menuDelete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!absenceMechanicId} onOpenChange={(open) => !open && setAbsenceMechanicId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
          {absenceMechanicId && (() => {
            const mech = (mechanicsQ.data ?? []).find((m) => m.id === absenceMechanicId);
            return (
              <>
                <SheetHeader className="border-b border-[var(--color-hairline)] px-4 py-3">
                  <SheetTitle>{mech ? t("absences.sheetTitle", { name: mech.fullName }) : t("absences.sheetTitleEmpty")}</SheetTitle>
                  <SheetDescription>{t("absences.sheetDescription")}</SheetDescription>
                </SheetHeader>
                <div className="p-0">
                  <AbsencesPanel mechanicId={absenceMechanicId} mechanicName={mech?.fullName ?? ""} />
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>
    </div>
    <DragOverlay>
      {activeDrag?.kind === "pool" && (() => {
        const o = ordersQ.data?.find((x) => x.id === activeDrag.orderId);
        if (!o) return null;
        return (
          <div className="bg-[var(--color-surface-container)] border border-[var(--color-hairline)] rounded-[var(--radius-md)] p-2 shadow-md text-sm">
            {o.title ?? o.vmrsCode}
          </div>
        );
      })()}
      {activeDrag?.kind === "event" && (() => {
        const o = ordersQ.data?.find((x) => x.id === activeDrag.orderId);
        if (!o) return null;
        return (
          <div className={cn("rounded-[var(--radius-sm)] border px-2 py-1 shadow-md text-xs", `state-${o.state}`)}>
            {o.title ?? o.vmrsCode}
          </div>
        );
      })()}
      {activeDrag?.kind === "resize" && (
        <div className="w-1.5 h-7 bg-[var(--color-brand-strong)] rounded" />
      )}
    </DragOverlay>
    </DndContext>
  );
}

function PoolCard({
  order, isSelected, isCritical, badge, onSelect, label,
}: {
  order: ServiceOrder;
  isSelected: boolean;
  isCritical: boolean;
  badge: { label: string; cls: string };
  onSelect: (id: string) => void;
  label: string;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `pool:${order.id}`,
    data: { kind: "pool", orderId: order.id, orderState: order.state, estimatedMinutes: order.estimatedMinutes },
  });
  return (
    <li
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-pressed={isSelected}
      onClick={() => onSelect(order.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(order.id);
        }
      }}
      className={cn(
        "bg-[var(--color-surface-container)] border border-[var(--color-hairline)] rounded-[var(--radius-md)] p-2.5 cursor-grab active:cursor-grabbing transition-colors hover:bg-[var(--color-surface-container-high)]",
        "border-l-4",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] focus-visible:ring-offset-1",
        isCritical ? "border-l-[var(--color-danger-fg)]" : "border-l-[var(--color-warn-fg)]",
        isSelected && "ring-1 ring-[var(--color-brand)]",
        isDragging && "opacity-40",
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="font-mono text-xs font-bold text-[var(--color-text)] tracking-wider">
          {order.vmrsCode}
        </span>
        <Badge className={badge.cls} variant="secondary">{badge.label}</Badge>
      </div>
      <div className="text-sm font-medium text-[var(--color-text)] mb-1 truncate">
        {order.title ?? order.vmrsDescription ?? order.vmrsCode}
      </div>
      <div className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
        <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span className="truncate">
          {order.clientName ?? (order.siteLocation ? `${order.siteLocation.lat.toFixed(3)}, ${order.siteLocation.lng.toFixed(3)}` : (order.siteName ?? "—"))}
        </span>
      </div>
    </li>
  );
}
