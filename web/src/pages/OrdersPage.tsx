import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { X, Plus } from "lucide-react";
import { serviceOrdersApi } from "../api/serviceOrders";
import { sitesApi } from "../api/sites";
import { vehiclesApi } from "../api/vehicles";
import { clientsApi } from "../api/clients";
import { queryKeys } from "../api/client";
import { ServiceOrder, ServiceOrderState, Site, UUID } from "../types";
import { AddressLookup } from "../components/AddressLookup";
import { SearchInput } from "../components/SearchInput";
import { OrderDetailsCard } from "../components/OrderDetailsCard";
import { MechanicPicker } from "../components/MechanicPicker";
import { fmtDateTime } from "../i18n/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const VMRS_OPTIONS = [
  { code: "013001001", label: "Engine oil + filter (60m)" },
  { code: "013002005", label: "Coolant hose (120m)" },
  { code: "042001010", label: "Hydraulic hose (150m)" },
  { code: "042003002", label: "Hydraulic pump (360m)" },
  { code: "033004001", label: "Track tension (90m)" },
  { code: "033005007", label: "Track shoe (240m)" },
  { code: "060001003", label: "Alternator (120m)" },
  { code: "060002001", label: "Battery (30m)" }
];

const CLOSED = new Set<ServiceOrderState>(["COMPLETED", "CANCELLED"]);

const NONE = "__none";

type StatusFilter = "OPEN" | "ALL" | "REQUESTED" | "DISPATCHED" | "IN_PROGRESS" | "COMPLETED";

const STATUS_FILTERS: StatusFilter[] = ["OPEN", "ALL", "REQUESTED", "DISPATCHED", "IN_PROGRESS", "COMPLETED"];

function matchStatusFilter(state: ServiceOrderState, f: StatusFilter): boolean {
  switch (f) {
    case "ALL":         return true;
    case "OPEN":        return !CLOSED.has(state);
    case "REQUESTED":   return state === "REQUESTED" || state === "QUOTED" || state === "APPROVED";
    case "DISPATCHED":  return state === "DISPATCHED";
    case "IN_PROGRESS": return state === "IN_PROGRESS";
    case "COMPLETED":   return state === "COMPLETED" || state === "CANCELLED";
  }
}

export function OrdersPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const ordersQ   = useQuery({ queryKey: queryKeys.serviceOrders, queryFn: serviceOrdersApi.list });
  const vehiclesQ = useQuery({ queryKey: queryKeys.vehicles,      queryFn: vehiclesApi.list });
  const clientsQ  = useQuery({ queryKey: queryKeys.clients,       queryFn: clientsApi.list });

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("OPEN");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ServiceOrder | null>(null);

  const orders = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = ordersQ.data ?? [];
    return all
      .filter((o) => matchStatusFilter(o.state, statusFilter))
      .filter((o) => {
        if (!q) return true;
        return (
          (o.title ?? "").toLowerCase().includes(q) ||
          o.vmrsCode.toLowerCase().includes(q) ||
          (o.clientName ?? "").toLowerCase().includes(q) ||
          (o.vmrsDescription ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (b.requestedAt ?? "").localeCompare(a.requestedAt ?? ""));
  }, [ordersQ.data, statusFilter, search]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: queryKeys.serviceOrders });
    qc.invalidateQueries({ queryKey: queryKeys.mechanics });
  };

  const createMut   = useMutation({ mutationFn: serviceOrdersApi.create, onSuccess: invalidate });
  const overrideMut = useMutation({
    mutationFn: (args: {
      id: string;
      state: ServiceOrderState;
      reason: string;
      mechanicId?: string;
      actualMinutes?: number;
    }) => serviceOrdersApi.override(args.id, {
      state: args.state,
      reason: args.reason,
      mechanicId: args.mechanicId,
      actualMinutes: args.actualMinutes,
    }),
    onSuccess: invalidate
  });
  const renameMut = useMutation({
    mutationFn: (args: { id: string; title: string }) => serviceOrdersApi.renameTitle(args.id, args.title),
    onSuccess: (updated) => {
      invalidate();
      setSelected(updated);
    }
  });

  return (
    <main className="flex-1 min-h-0 p-3.5 grid gap-3.5 grid-cols-[1.6fr_1fr]">
      <section className="bg-[var(--color-surface-panel)] border border-[var(--color-hairline)] rounded-[var(--radius-md)] p-3.5 overflow-auto min-h-0 flex flex-col gap-3">
        <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-[var(--color-text)] m-0 mb-1">
              {t("orders.pageTitle")}
            </h2>
            <p className="text-sm text-[var(--color-text-muted)] m-0">
              {t("orders.pageSubtitle")}
            </p>
          </div>
          <Button variant="default" type="button" onClick={() => setSelected(null)} className="shrink-0">
            <Plus className="h-4 w-4" />
            {t("orders.newOrder")}
          </Button>
        </header>

        <div className="flex flex-wrap items-center gap-2 p-2 bg-[var(--color-surface-sunken)] border border-[var(--color-hairline)] rounded-[var(--radius-md)]">
          <ToggleGroup
            type="single"
            value={statusFilter}
            onValueChange={(v) => v && setStatusFilter(v as StatusFilter)}
            variant="outline"
            size="sm"
          >
            {STATUS_FILTERS.map((f) => (
              <ToggleGroupItem key={f} value={f}>
                {t(`orders.filter${f === "IN_PROGRESS" ? "InProgress" : f.charAt(0) + f.slice(1).toLowerCase()}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t("orders.searchPlaceholder")}
            className="ml-auto w-full sm:w-72"
          />

          <span className="text-xs text-[var(--color-text-muted)] font-mono">
            {t("common.rows", { count: orders.length })}
          </span>
        </div>

        <div className="border border-[var(--color-hairline)] rounded-[var(--radius-md)] overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-[var(--color-surface-sunken)] hover:bg-[var(--color-surface-sunken)]">
                <TableHead className="uppercase tracking-wider text-xs font-semibold text-[var(--color-text-muted)]">{t("orders.columnState")}</TableHead>
                <TableHead className="uppercase tracking-wider text-xs font-semibold text-[var(--color-text-muted)]">{t("orders.columnTitle")}</TableHead>
                <TableHead className="uppercase tracking-wider text-xs font-semibold text-[var(--color-text-muted)]">{t("orders.columnVmrs")}</TableHead>
                <TableHead className="uppercase tracking-wider text-xs font-semibold text-[var(--color-text-muted)]">{t("orders.columnClient")}</TableHead>
                <TableHead className="uppercase tracking-wider text-xs font-semibold text-[var(--color-text-muted)] text-right">{t("orders.columnEstimated")}</TableHead>
                <TableHead className="uppercase tracking-wider text-xs font-semibold text-[var(--color-text-muted)] text-right">{t("orders.columnActual")}</TableHead>
                <TableHead className="uppercase tracking-wider text-xs font-semibold text-[var(--color-text-muted)]">{t("orders.columnRequested")}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => (
                <TableRow
                  key={o.id}
                  onClick={() => setSelected(o)}
                  className={cn(
                    "group cursor-pointer",
                    selected?.id === o.id && "bg-[var(--color-brand-soft)] hover:bg-[var(--color-brand-soft)]"
                  )}
                >
                  <TableCell><Badge className={"state-" + o.state} variant="secondary">{t(`state.${o.state}`)}</Badge></TableCell>
                  <TableCell className="font-medium">{o.title ?? <span className="text-[var(--color-text-muted)] italic">{t("common.dash")}</span>}</TableCell>
                  <TableCell>
                    <span className="font-mono text-xs text-[var(--color-text)] bg-[var(--color-surface-container)] px-1.5 py-0.5 rounded-[var(--radius-sm)] border border-[var(--color-hairline)] whitespace-nowrap">
                      {o.vmrsCode}
                    </span>
                  </TableCell>
                  <TableCell>{o.clientName ?? <span className="text-[var(--color-text-muted)] italic">{t("common.dash")}</span>}</TableCell>
                  <TableCell className="font-mono text-sm text-right">{t("common.minutesShort", { count: o.estimatedMinutes })}</TableCell>
                  <TableCell className="font-mono text-sm text-right text-[var(--color-text-muted)]">{o.actualMinutes ?? t("common.dash")}</TableCell>
                  <TableCell className="text-[var(--color-text-muted)] text-xs">{fmtDateTime(o.requestedAt)}</TableCell>
                  <TableCell>
                    <div
                      className={cn(
                        "flex gap-1 whitespace-nowrap justify-end transition-opacity",
                        "opacity-0 group-hover:opacity-100 focus-within:opacity-100",
                        selected?.id === o.id && "opacity-100"
                      )}
                    >
                      <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setSelected(o); }}>{t("common.inspect")}</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {orders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-[var(--color-text-muted)] py-6">{t("orders.noOrders")}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="bg-[var(--color-surface-panel)] border border-[var(--color-hairline)] rounded-[var(--radius-md)] p-3.5 overflow-auto min-h-0">
        {selected ? (
          <OrderDetail
            order={selected}
            onClose={() => setSelected(null)}
            onOverride={(state, reason, mechanicId, actualMinutes) =>
              overrideMut.mutate({ id: selected.id, state, reason, mechanicId, actualMinutes })}
            overriding={overrideMut.isPending}
            onRename={(title) => renameMut.mutate({ id: selected.id, title })}
            renaming={renameMut.isPending}
          />
        ) : (
          <NewOrderForm
            vehicles={vehiclesQ.data ?? []}
            clients={clientsQ.data ?? []}
            onSubmit={(body) => createMut.mutate(body)}
            submitting={createMut.isPending}
          />
        )}
      </section>
    </main>
  );
}

function OrderDetail({
  order, onClose, onOverride, overriding, onRename, renaming
}: {
  order: ServiceOrder;
  onClose: () => void;
  onOverride: (state: ServiceOrderState, reason: string, mechanicId?: string, actualMinutes?: number) => void;
  overriding: boolean;
  onRename: (title: string) => void;
  renaming: boolean;
}) {
  const { t } = useTranslation();
  const ALL_STATES: ServiceOrderState[] = ["REQUESTED", "QUOTED", "APPROVED", "DISPATCHED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
  const [overrideState, setOverrideState] = useState<ServiceOrderState>("CANCELLED");
  const [reason, setReason] = useState("");
  const [mechanicId, setMechanicId] = useState<string | undefined>(order.mechanicId ?? undefined);
  const [actualMinutes, setActualMinutes] = useState<number>(order.actualMinutes ?? order.estimatedMinutes);

  const needsMechanic =
    (overrideState === "DISPATCHED" || overrideState === "IN_PROGRESS" || overrideState === "COMPLETED")
    && !order.mechanicId;
  const needsMinutes = overrideState === "COMPLETED" && order.actualMinutes == null;

  const canSubmit =
    overrideState !== order.state
    && (!needsMechanic || !!mechanicId)
    && (!needsMinutes || (actualMinutes > 0));

  function submit() {
    onOverride(
      overrideState,
      reason,
      needsMechanic ? mechanicId : undefined,
      needsMinutes ? actualMinutes : undefined,
    );
  }

  const overrideSlot = (
    <div className="mt-4 border-t border-[var(--color-hairline)] pt-3">
      <h3 className="mt-0 mb-1.5 text-[var(--text-base)] font-semibold text-[var(--color-text)]">
        {t("orders.overrideHeading")}
      </h3>
      <p className="text-[var(--text-sm)] text-[var(--color-text-muted)] m-0 mb-2">
        {t("orders.overrideHelp")}
      </p>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="flex flex-col gap-1">
          <Label htmlFor="override-target">{t("orders.overrideTarget")}</Label>
          <Select value={overrideState} onValueChange={(v) => setOverrideState(v as ServiceOrderState)}>
            <SelectTrigger id="override-target"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ALL_STATES.map((s) => (
                <SelectItem key={s} value={s}>{t(`state.${s}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="override-reason">{t("orders.overrideReason")}</Label>
          <Input id="override-reason" value={reason} onChange={(e) => setReason(e.target.value)}
                 placeholder={t("orders.overrideReasonPlaceholder")} />
        </div>
        {needsMechanic && (
          <div className="flex flex-col gap-1 col-span-2">
            <Label htmlFor="override-mechanic">{t("orders.fieldMechanic")}</Label>
            <MechanicPicker id="override-mechanic" value={mechanicId} onChange={setMechanicId} />
          </div>
        )}
        {needsMinutes && (
          <div className="flex flex-col gap-1 col-span-2">
            <Label htmlFor="override-minutes">{t("orders.fieldActual")}</Label>
            <Input id="override-minutes" type="number" min={1} value={actualMinutes}
                   onChange={(e) => setActualMinutes(Number(e.target.value))} />
          </div>
        )}
      </div>
      <div className="flex justify-end mt-2.5">
        <Button variant="default" disabled={!canSubmit || overriding} onClick={submit}>
          {t("orders.actionOverrideApply")}
        </Button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="m-0 text-[var(--text-lg)] font-semibold">{t("orders.orderDetail")}</h2>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label={t("common.close")}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <OrderDetailsCard
        order={order}
        onRename={onRename}
        renaming={renaming}
        showNotes
        overrideSlot={overrideSlot}
      />
    </div>
  );
}

function NewOrderForm({
  vehicles, clients, onSubmit, submitting
}: {
  vehicles: { id: string; make: string; model: string; serialNumber: string }[];
  clients: { id: string; name: string }[];
  onSubmit: (body: { vehicleId: string; clientId: string; siteId: string; vmrsCode: string; title?: string; siteLocation?: { lat: number; lng: number }; notes?: string }) => void;
  submitting: boolean;
}) {
  const { t } = useTranslation();
  const [vehicleId, setVehicleId] = useState("");
  const [clientId,  setClientId]  = useState("");
  const [vmrsCode,  setVmrsCode]  = useState(VMRS_OPTIONS[0].code);
  const [title,     setTitle]     = useState("");
  const [lat, setLat] = useState("45.46");
  const [lng, setLng] = useState("9.19");
  const [notes, setNotes] = useState("");
  const [siteId, setSiteId] = useState("");

  const sitesQ = useQuery({
    queryKey: ["sites", clientId],
    queryFn: () => sitesApi.list(clientId),
    enabled: !!clientId
  });

  const handleClientChange = (newClientId: string) => {
    setClientId(newClientId);
    setSiteId("");
  };

  const selectedSite: Site | undefined = sitesQ.data?.find(s => s.id === siteId);
  const siteHasCoords = selectedSite && selectedSite.lat != null && selectedSite.lng != null;

  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      vehicleId, clientId, siteId, vmrsCode,
      title: title.trim() || undefined,
      siteLocation: siteHasCoords ? undefined : { lat: Number(lat), lng: Number(lng) },
      notes: notes || undefined
    });
  }

  return (
    <>
      <h2 className="m-0 mb-2.5 text-[var(--text-lg)] font-semibold">{t("orders.newOrder")}</h2>
      <form onSubmit={submit} className="flex flex-col gap-2.5">
        <div className="flex flex-col gap-1">
          <Label htmlFor="vehicle">{t("orders.fieldVehicle")} *</Label>
          <Select value={vehicleId || NONE} onValueChange={(v) => setVehicleId(v === NONE ? "" : v)}>
            <SelectTrigger id="vehicle">
              <SelectValue placeholder={t("orders.selectPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{t("orders.selectPlaceholder")}</SelectItem>
              {vehicles.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {t("orders.vehicleOption", { make: v.make, model: v.model, serial: v.serialNumber })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="client">{t("orders.fieldClient")} *</Label>
          <Select value={clientId || NONE} onValueChange={(v) => handleClientChange(v === NONE ? "" : v)}>
            <SelectTrigger id="client">
              <SelectValue placeholder={t("orders.selectPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{t("orders.selectPlaceholder")}</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {clientId && (
          <div className="flex flex-col gap-1">
            <Label htmlFor="site">{t("sites.selectSite")} *</Label>
            <Select value={siteId || NONE} onValueChange={(v) => setSiteId(v === NONE ? "" : v)}>
              <SelectTrigger id="site">
                <SelectValue placeholder={t("sites.selectSitePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("sites.selectSitePlaceholder")}</SelectItem>
                {(sitesQ.data ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}{s.locationLabel ? ` — ${s.locationLabel}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <Label htmlFor="vmrs">{t("orders.fieldVmrs")}</Label>
          <Select value={vmrsCode} onValueChange={setVmrsCode}>
            <SelectTrigger id="vmrs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VMRS_OPTIONS.map((v) => (
                <SelectItem key={v.code} value={v.code}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="title">{t("orders.fieldTitle")}</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        </div>

        {!siteHasCoords && (
          <>
            <div className="flex flex-col gap-1">
              <Label>{t("orders.fieldAddressLookup")}</Label>
              <AddressLookup
                onPick={(h) => { setLat(String(h.lat)); setLng(String(h.lng)); }}
                placeholder={t("orders.addressPlaceholder")}
              />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="flex flex-col gap-1">
                <Label htmlFor="lat">{t("orders.fieldLat")} *</Label>
                <Input id="lat" required type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="lng">{t("orders.fieldLng")} *</Label>
                <Input id="lng" required type="number" step="any" value={lng} onChange={(e) => setLng(e.target.value)} />
              </div>
            </div>
          </>
        )}

        {siteHasCoords && selectedSite && (
          <p className="text-[var(--color-text-muted)] m-0 text-[var(--text-sm)]">
            Location: {selectedSite.locationLabel ?? `${selectedSite.lat?.toFixed(4)}, ${selectedSite.lng?.toFixed(4)}`}
          </p>
        )}

        <div className="flex flex-col gap-1">
          <Label htmlFor="notes">{t("orders.fieldNotes")}</Label>
          <Textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="flex gap-2 mt-1.5">
          <Button variant="default" type="submit" disabled={submitting || !vehicleId || !clientId || !siteId}>
            {t("orders.newOrder")}
          </Button>
        </div>
      </form>
    </>
  );
}
