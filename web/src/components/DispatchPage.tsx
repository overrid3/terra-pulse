import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Filter, RefreshCw, Inbox, MapPin, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { addDays, addMonths, addWeeks, startOfDay, format } from "date-fns";
import { DndContext, DragEndEvent, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors, useDraggable } from "@dnd-kit/core";
import { mechanicsApi } from "../api/mechanics";
import { serviceOrdersApi, CreateOrderBody } from "../api/serviceOrders";
import { absencesApi } from "../api/absences";
import { queryKeys } from "../api/client";
import { DispatchGantt, GanttView, dayBoundary, weekBoundary, monthBoundary } from "./DispatchGantt";
import { ServiceOrderDrawer } from "./ServiceOrderDrawer";
import { SearchInput } from "./SearchInput";
import { CreateOrderForm } from "./CreateOrderForm";
import { ServiceOrder, UUID } from "../types";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { pxToTime } from "../lib/gantt-time";

const PENDING_STATES = new Set(["REQUESTED", "QUOTED", "APPROVED"]);

function priorityBadge(o: ServiceOrder): { label: string; cls: string } {
  if (o.state === "REQUESTED") return { label: "CRITICAL", cls: "state-REQUESTED" };
  if (o.state === "QUOTED")    return { label: "QUOTED",   cls: "state-QUOTED" };
  return { label: "SCHEDULED", cls: "state-APPROVED" };
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

  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const registerRow = (mechanicId: string, el: HTMLDivElement | null) => {
    if (el) {
      rowRefs.current.set(mechanicId, el);
    } else {
      rowRefs.current.delete(mechanicId);
    }
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
    queryFn: () => absencesApi.listInRange(windowRange.from, windowRange.to)
  });

  const invalidateOrders = () => qc.invalidateQueries({ queryKey: queryKeys.serviceOrders });

  const createMut = useMutation({
    mutationFn: (body: CreateOrderBody) => serviceOrdersApi.create(body),
    onSuccess: () => {
      invalidateOrders();
      setCreateOpen(false);
      toast.success("Order created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const scheduleMut = useMutation({
    mutationFn: (args: { id: UUID; mechanicId: UUID; start: string; end: string }) =>
      serviceOrdersApi.schedule(args.id, { mechanicId: args.mechanicId, scheduledStartAt: args.start, scheduledEndAt: args.end }),
    onSuccess: () => { invalidateOrders(); toast.success("Order scheduled"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rescheduleMut = useMutation({
    mutationFn: (args: { id: UUID; mechanicId?: UUID; start?: string; end?: string }) =>
      serviceOrdersApi.reschedule(args.id, {
        mechanicId: args.mechanicId,
        scheduledStartAt: args.start,
        scheduledEndAt: args.end,
      }),
    onSuccess: () => { invalidateOrders(); toast.success("Schedule updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const selectedOrder = useMemo(
    () => ordersQ.data?.find((o) => o.id === selectedOrderId) ?? null,
    [ordersQ.data, selectedOrderId]
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

  const unassigned = allOrders
    .filter((o) => PENDING_STATES.has(o.state) && !o.mechanicId)
    .filter(matchSearch);

  const filteredOrders = allOrders.filter(matchSearch);

  function navigate(delta: -1 | 1) {
    if (view === "day")        setDate((d) => addDays(d, delta));
    else if (view === "week")  setDate((d) => addWeeks(d, delta));
    else                       setDate((d) => addMonths(d, delta));
  }

  function jumpToday() {
    setDate(startOfDay(new Date()));
  }

  function rangeLabel(): string {
    if (view === "day")   return format(date, "EEE dd MMM yyyy");
    if (view === "week")  return `${format(date, "MMM dd")} – ${format(addDays(date, 6), "MMM dd, yyyy")}`;
    return format(date, "MMMM yyyy");
  }

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  function handleDragEnd(e: DragEndEvent) {
    const a = e.active.data.current as
      | { kind?: string; orderId?: string; orderState?: string; currentMechanicId?: string;
          scheduledStartAt?: string; scheduledEndAt?: string; edge?: "start" | "end" }
      | undefined;
    const o = e.over?.data.current as { kind?: string; mechanicId?: string } | undefined;
    if (!a || !a.orderId) return;

    // Resize handler
    if (a.kind === "resize" && o?.kind === "row" && o.mechanicId) {
      const rect = rowRefs.current.get(o.mechanicId)?.getBoundingClientRect();
      if (!rect) return;
      const cursorX = ((e.activatorEvent as MouseEvent | null)?.clientX ?? 0) + (e.delta?.x ?? 0);
      const t = pxToTime(rect, cursorX, view, winStart, winEnd);
      if (a.edge === "start") {
        const end = new Date(a.scheduledEndAt!);
        if (t >= end) { toast.error("Start must be before end"); return; }
        rescheduleMut.mutate({ id: a.orderId as UUID, start: t.toISOString() });
      } else {
        const start = new Date(a.scheduledStartAt!);
        if (t <= start) { toast.error("End must be after start"); return; }
        rescheduleMut.mutate({ id: a.orderId as UUID, end: t.toISOString() });
      }
      return;
    }

    if (!o || o.kind !== "row" || !o.mechanicId) return;
    const mechanicId = o.mechanicId as UUID;
    const orderId = a.orderId as UUID;

    const rect = rowRefs.current.get(mechanicId)?.getBoundingClientRect();
    if (!rect) return;

    const cursorX = ((e.activatorEvent as MouseEvent | null)?.clientX ?? 0) + (e.delta?.x ?? 0);
    const t = pxToTime(rect, cursorX, view, winStart, winEnd);

    if (a.kind === "pool") {
      if (a.orderState !== "APPROVED") {
        toast.error(`Order must be APPROVED to schedule (current: ${a.orderState})`);
        return;
      }
      const order = ordersQ.data?.find((x) => x.id === orderId);
      if (!order) return;
      const end = new Date(t.getTime() + order.estimatedMinutes * 60_000);
      scheduleMut.mutate({ id: orderId, mechanicId, start: t.toISOString(), end: end.toISOString() });
      return;
    }

    if (a.kind === "event") {
      if (!a.scheduledStartAt || !a.scheduledEndAt) return;
      const oldStart = new Date(a.scheduledStartAt);
      const oldEnd   = new Date(a.scheduledEndAt);
      const duration = oldEnd.getTime() - oldStart.getTime();
      const newStart = t;
      const newEnd = new Date(newStart.getTime() + duration);
      const sameRow = a.currentMechanicId === mechanicId;
      const sameTime = newStart.getTime() === oldStart.getTime();
      if (sameRow && sameTime) return;
      rescheduleMut.mutate({
        id: orderId,
        mechanicId: sameRow ? undefined : mechanicId,
        start: newStart.toISOString(),
        end: newEnd.toISOString(),
      });
    }
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
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
            <Button variant="outline" size="sm" onClick={() => navigate(-1)} aria-label="previous">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={jumpToday}>
              {t("dispatch.today")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(1)} aria-label="next">
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
              <Button size="sm"><Plus className="h-4 w-4 mr-1" />New Order</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>New Order</DialogTitle></DialogHeader>
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

      <main className="flex-1 min-h-0 min-w-0 p-3 grid gap-3 grid-cols-[minmax(0,1fr)_320px]">
        <section className="border border-[var(--color-hairline)] rounded-[var(--radius-md)] flex flex-col min-h-0 min-w-0 overflow-hidden">
          <DispatchGantt
            mechanics={mechanicsQ.data ?? []}
            orders={filteredOrders}
            absences={absencesQ.data ?? []}
            selectedMechanicId={selectedMechanicId}
            view={view}
            date={date}
            winStart={winStart}
            winEnd={winEnd}
            onSelectOrder={setSelectedOrderId}
            registerRow={registerRow}
          />
        </section>

        <aside className="bg-[var(--color-surface-panel)] border border-[var(--color-hairline)] rounded-[var(--radius-md)] flex flex-col min-h-0 overflow-hidden">
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
              const isCritical = o.state === "REQUESTED";
              const label = `${o.vmrsCode}, ${o.title ?? o.vmrsDescription ?? ""}, ${badge.label}, ${o.clientName ?? ""}`;
              return (
                <PoolCard
                  key={o.id}
                  order={o}
                  isSelected={o.id === selectedOrderId}
                  isCritical={isCritical}
                  badge={badge}
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
    </div>
    <DragOverlay>{null}</DragOverlay>
    </DndContext>
  );
}

function PoolCard({
  order, isSelected, isCritical, badge, onSelect, label
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
    data: {
      kind: "pool",
      orderId: order.id,
      orderState: order.state,
    },
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
        isDragging && "opacity-40"
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
          {order.clientName ?? `${order.siteLocation.lat.toFixed(3)}, ${order.siteLocation.lng.toFixed(3)}`}
        </span>
      </div>
    </li>
  );
}
