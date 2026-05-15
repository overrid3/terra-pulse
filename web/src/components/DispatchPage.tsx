import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Filter, RefreshCw, Inbox, MapPin, ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, addMonths, addWeeks, startOfDay, format } from "date-fns";
import { mechanicsApi } from "../api/mechanics";
import { serviceOrdersApi } from "../api/serviceOrders";
import { absencesApi } from "../api/absences";
import { queryKeys } from "../api/client";
import { DispatchGantt, GanttView, DropPayload } from "./DispatchGantt";
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

  function lookupOrder(id: string): ServiceOrder | undefined {
    return allOrders.find((o) => o.id === id);
  }

  // Pool → mechanic row.
  function onDropFromPool(payload: DropPayload) {
    // The pool card sets payload data; we need the order id from it.
    // Pool drop handler in Gantt reads dataTransfer separately — we re-derive here via a single-shot ref.
    // To keep API simple, the Gantt passes only mechanicId+hint. The id is on dataTransfer; we retrieve via lastPoolDragId.
    const orderId = lastPoolDragId.current;
    lastPoolDragId.current = null;
    if (!orderId) return;
    const order = lookupOrder(orderId);
    if (!order) return;
    if (order.state !== "APPROVED") {
      toast.error(`Order must be APPROVED to dispatch (current: ${order.state})`);
      return;
    }
    dispatchMut.mutate({ id: order.id as UUID, mechanicId: payload.mechanicId });
    if (payload.hint?.hour != null) {
      showVisualSlotHint(payload.hint.hour);
    }
  }

  function onMoveEvent(orderId: UUID, payload: DropPayload) {
    const order = lookupOrder(orderId);
    if (!order) return;
    if (order.mechanicId === payload.mechanicId) {
      showVisualSlotHint(payload.hint?.hour);
      return;
    }
    reassignMut.mutate({ id: orderId, mechanicId: payload.mechanicId });
  }

  // Backend has no scheduled-time field; visual hint helps users understand the
  // limitation. Once per session is enough — repeated toasts on every drop are noise.
  const VISUAL_SLOT_HINT_KEY = "tp.dispatch.visualSlotHintShown";
  function showVisualSlotHint(hour: number | undefined) {
    try {
      if (sessionStorage.getItem(VISUAL_SLOT_HINT_KEY)) return;
      sessionStorage.setItem(VISUAL_SLOT_HINT_KEY, "1");
    } catch {
      /* sessionStorage may be unavailable (private mode) — fall through */
    }
    const slot = hour != null ? `~${String(hour).padStart(2, "0")}:00` : "";
    toast.info(`Time slots are visual only ${slot}— backend stores no scheduled time`);
  }

  // Pool drag bookkeeping: the Gantt onDrop receives mechanicId+hint but not the dragged
  // order id (DispatchPage owns the pool). Stash it here at dragstart and read at drop.
  const lastPoolDragId = useMemo(() => ({ current: null as string | null }), []);

  return (
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
            onSelectOrder={setSelectedOrderId}
            onMoveEvent={onMoveEvent}
            onDropFromPool={onDropFromPool}
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
                <li
                  key={o.id}
                  role="button"
                  tabIndex={0}
                  aria-label={label}
                  aria-pressed={o.id === selectedOrderId}
                  draggable
                  onDragStart={(e) => {
                    lastPoolDragId.current = o.id;
                    e.dataTransfer.setData("text/plain", `pool:${o.id}`);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={() => { /* keep ref until drop reads it; cleared in handler */ }}
                  className={cn(
                    "bg-[var(--color-surface-container)] border border-[var(--color-hairline)] rounded-[var(--radius-md)] p-2.5 cursor-grab active:cursor-grabbing transition-colors hover:bg-[var(--color-surface-container-high)]",
                    "border-l-4",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] focus-visible:ring-offset-1",
                    isCritical
                      ? "border-l-[var(--color-danger-fg)]"
                      : "border-l-[var(--color-warn-fg)]",
                    o.id === selectedOrderId && "ring-1 ring-[var(--color-brand)]"
                  )}
                  onClick={() => setSelectedOrderId(o.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedOrderId(o.id);
                    }
                  }}
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
                    <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
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
