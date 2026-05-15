import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Filter, RefreshCw, Inbox, MapPin, ChevronLeft, ChevronRight } from "lucide-react";
import { View } from "react-big-calendar";
import { addDays, addMonths, addWeeks, startOfDay } from "date-fns";
import { mechanicsApi } from "../api/mechanics";
import { serviceOrdersApi } from "../api/serviceOrders";
import { absencesApi } from "../api/absences";
import { queryKeys } from "../api/client";
import { ResourceTimeline, CalEvent } from "./ResourceTimeline";
import { ServiceOrderDrawer } from "./ServiceOrderDrawer";
import { SearchInput } from "./SearchInput";
import { ServiceOrder, UUID } from "../types";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type DayChoice = "TODAY" | "TOMORROW";

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
  const [day, setDay] = useState<DayChoice>("TODAY");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<View>("day");
  const [date, setDate] = useState<Date>(startOfDay(new Date()));

  // Order id being dragged from the pool (null = no external drag in progress).
  const draggingFromPool = useRef<ServiceOrder | null>(null);

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

  const dispatchMut = useMutation({
    mutationFn: (args: { id: UUID; mechanicId: UUID }) => serviceOrdersApi.dispatch(args.id, args.mechanicId),
    onSuccess: () => { invalidateOrders(); toast.success("Order dispatched"); },
    onError: (e: Error) => toast.error(e.message)
  });
  const reassignMut = useMutation({
    mutationFn: (args: { id: UUID; mechanicId: UUID }) => serviceOrdersApi.reassign(args.id, args.mechanicId),
    onSuccess: () => { invalidateOrders(); toast.success("Order reassigned"); },
    onError: (e: Error) => toast.error(e.message)
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

  function handleDayChoice(choice: DayChoice) {
    setDay(choice);
    const base = startOfDay(new Date());
    setDate(choice === "TODAY" ? base : addDays(base, 1));
    if (view !== "day") setView("day");
  }

  function navigate(delta: -1 | 1) {
    if (view === "day")        setDate((d) => addDays(d, delta));
    else if (view === "week")  setDate((d) => addWeeks(d, delta));
    else                       setDate((d) => addMonths(d, delta));
  }

  // External pool → calendar drop. RBC passes resource = mechanic id only in day view.
  function onDropFromOutside({ resource }: { resource?: string | number }) {
    const order = draggingFromPool.current;
    draggingFromPool.current = null;
    if (!order) return;
    if (!resource) {
      toast.error("Drop on a mechanic row (day view) to dispatch");
      return;
    }
    const mechanicId = String(resource);
    if (order.state !== "APPROVED") {
      toast.error(`Order must be APPROVED to dispatch (current: ${order.state})`);
      return;
    }
    dispatchMut.mutate({ id: order.id as UUID, mechanicId: mechanicId as UUID });
  }

  function dragFromOutsideItem(): CalEvent {
    const o = draggingFromPool.current;
    const now = new Date();
    return {
      title: o?.title ?? o?.vmrsCode ?? "",
      start: now,
      end: now,
      resourceId: "",
      kind: "order",
      soId: o?.id,
      orderState: o?.state
    };
  }

  // Existing calendar event moved. Time changes are not persisted (POC). Mechanic changes call reassign.
  function onEventMoved({ event, resourceId }: { event: CalEvent; resourceId?: string | number }) {
    if (!event.soId) return;
    const newMechanicId = resourceId ? String(resourceId) : event.resourceId;
    if (newMechanicId === event.resourceId) {
      toast.info("Time slots are visual only in this POC — backend stores no scheduled time");
      return;
    }
    reassignMut.mutate({ id: event.soId as UUID, mechanicId: newMechanicId as UUID });
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <header className="bg-[var(--color-surface-panel)] border-b border-[var(--color-hairline)] flex flex-wrap items-center justify-between gap-3 px-4 h-auto sm:h-14 py-2 shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="m-0 text-xl font-semibold tracking-tight text-[var(--color-text)]">
            {t("dispatch.pageTitle")}
          </h1>
          <ToggleGroup
            type="single"
            value={day}
            onValueChange={(v) => v && handleDayChoice(v as DayChoice)}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="TODAY">{t("dispatch.today")}</ToggleGroupItem>
            <ToggleGroupItem value="TOMORROW">{t("dispatch.tomorrow")}</ToggleGroupItem>
          </ToggleGroup>
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={(v) => v && setView(v as View)}
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
            <Button variant="outline" size="sm" onClick={() => navigate(1)} aria-label="next">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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

      {view !== "day" && (
        <div className="px-4 py-1.5 bg-[var(--color-warn-bg)] border-b border-[var(--color-hairline)] text-xs text-[var(--color-warn-fg)]">
          {t("dispatch.resourceOnlyDayHint")}
        </div>
      )}

      <main className="flex-1 min-h-0 min-w-0 p-3 grid gap-3 grid-cols-[minmax(0,1fr)_320px]">
        <section className="bg-[var(--color-surface-panel)] border border-[var(--color-hairline)] rounded-[var(--radius-md)] flex flex-col min-h-0 min-w-0 overflow-hidden">
          <ResourceTimeline
            mechanics={mechanicsQ.data ?? []}
            orders={filteredOrders}
            absences={absencesQ.data ?? []}
            selectedMechanicId={selectedMechanicId}
            view={view}
            onView={setView}
            date={date}
            onNavigate={setDate}
            onSelectOrder={setSelectedOrderId}
            onEventMoved={onEventMoved}
            onDropFromOutside={onDropFromOutside}
            dragFromOutsideItem={dragFromOutsideItem}
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
          <ul className="flex-1 overflow-y-auto p-2 flex flex-col gap-2 list-none m-0">
            {unassigned.length === 0 && (
              <li className="text-center text-[var(--color-text-muted)] text-sm py-6">
                {t("dispatch.pendingNone")}
              </li>
            )}
            {unassigned.map((o) => {
              const badge = priorityBadge(o);
              const isCritical = o.state === "REQUESTED";
              return (
                <li
                  key={o.id}
                  draggable
                  onDragStart={(e) => {
                    draggingFromPool.current = o;
                    // payload required for some browsers
                    e.dataTransfer.setData("text/plain", o.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={() => { draggingFromPool.current = null; }}
                  className={cn(
                    "bg-[var(--color-surface-container)] border border-[var(--color-hairline)] rounded-[var(--radius-md)] p-2.5 cursor-grab active:cursor-grabbing transition-colors hover:bg-[var(--color-surface-container-high)]",
                    "border-l-4",
                    isCritical
                      ? "border-l-[var(--color-danger-fg)]"
                      : "border-l-[var(--color-warn-fg)]",
                    o.id === selectedOrderId && "ring-1 ring-[var(--color-brand)]"
                  )}
                  onClick={() => setSelectedOrderId(o.id)}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="font-mono text-xs font-bold text-[var(--color-text)] tracking-wider">
                      {o.vmrsCode}
                    </span>
                    <Badge className={badge.cls} variant="secondary">{badge.label}</Badge>
                  </div>
                  <div className="text-sm font-medium text-[var(--color-text)] mb-1 truncate">
                    {o.title ?? o.vmrsDescription ?? o.vmrsCode}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                      {o.clientName ?? `${o.siteLocation.lat.toFixed(3)}, ${o.siteLocation.lng.toFixed(3)}`}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </aside>
      </main>

      {selectedOrder && (
        <ServiceOrderDrawer order={selectedOrder} onClose={() => setSelectedOrderId(null)} />
      )}
    </div>
  );
}
