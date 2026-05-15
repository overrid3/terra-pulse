import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Plus, Pencil, Trash2, X, Check, History as HistoryIcon, MapPin } from "lucide-react";
import { vehiclesApi } from "../api/vehicles";
import { sitesApi } from "../api/sites";
import { serviceOrdersApi } from "../api/serviceOrders";
import { queryKeys } from "../api/client";
import {
  Vehicle, VehicleUpsert,
  VEHICLE_CLASSES, VEHICLE_STATUSES,
  ServiceOrder, SiteRef, UUID
} from "../types";
import { fmtDateTime } from "../i18n/format";
import { SearchInput } from "../components/SearchInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem
} from "@/components/ui/select";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const EMPTY: VehicleUpsert = {
  make: "", model: "", serialNumber: "",
  vehicleClass: "EXCAVATOR", engineHours: 0, status: "AVAILABLE"
};

type PanelMode =
  | { kind: "create" }
  | { kind: "edit"; vehicle: Vehicle }
  | { kind: "history"; vehicle: Vehicle };

export function VehiclesPage() {
  const { t } = useTranslation();
  const client = useQueryClient();

  const vehiclesQ = useQuery({ queryKey: queryKeys.vehicles, queryFn: vehiclesApi.list });
  const sitesQ = useQuery({ queryKey: queryKeys.sitesAll, queryFn: sitesApi.listAll });

  const siteById = useMemo(() => {
    const map = new Map<UUID, SiteRef>();
    (sitesQ.data ?? []).forEach((s) => map.set(s.id, s));
    return map;
  }, [sitesQ.data]);

  const [mode, setMode] = useState<PanelMode>({ kind: "create" });
  const [draft, setDraft] = useState<VehicleUpsert>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [classFilter, setClassFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  const invalidate = () => client.invalidateQueries({ queryKey: queryKeys.vehicles });

  const createMut = useMutation({
    mutationFn: (body: VehicleUpsert) => vehiclesApi.create(body),
    onSuccess: () => { invalidate(); reset(); },
    onError: (e: Error) => setError(e.message)
  });
  const updateMut = useMutation({
    mutationFn: (args: { id: string; body: VehicleUpsert }) => vehiclesApi.update(args.id, args.body),
    onSuccess: () => { invalidate(); reset(); },
    onError: (e: Error) => setError(e.message)
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => vehiclesApi.delete(id),
    onSuccess: invalidate,
    onError: (e: Error) => setError(e.message)
  });

  function reset() {
    setMode({ kind: "create" });
    setDraft(EMPTY);
    setError(null);
  }

  function loadForEdit(v: Vehicle) {
    setMode({ kind: "edit", vehicle: v });
    setDraft({
      make: v.make, model: v.model, serialNumber: v.serialNumber,
      vehicleClass: v.vehicleClass, engineHours: v.engineHours, status: v.status
    });
    setError(null);
  }

  function loadHistory(v: Vehicle) {
    setMode({ kind: "history", vehicle: v });
    setError(null);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode.kind === "edit") updateMut.mutate({ id: mode.vehicle.id, body: draft });
    else                      createMut.mutate(draft);
  }

  const set = <K extends keyof VehicleUpsert>(k: K, v: VehicleUpsert[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const selectedId = mode.kind === "create" ? null : mode.vehicle.id;
  const q = search.trim().toLowerCase();
  const vehicles = (vehiclesQ.data ?? []).filter(v =>
    (statusFilter === "ALL" || v.status === statusFilter) &&
    (classFilter === "ALL" || v.vehicleClass === classFilter) &&
    (!q ||
      v.serialNumber.toLowerCase().includes(q) ||
      v.make.toLowerCase().includes(q) ||
      v.model.toLowerCase().includes(q))
  );

  return (
    <main className="flex-1 min-h-0 p-3.5 grid gap-3.5 grid-cols-[1.6fr_1fr]">
      <section className="bg-[var(--color-surface-panel)] border border-[var(--color-hairline)] rounded-[var(--radius-md)] p-3.5 overflow-auto min-h-0 flex flex-col gap-3">
        <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-[var(--color-text)] m-0 mb-1">
              {t("vehicles.pageTitle", { count: vehicles.length })}
            </h2>
            <p className="text-sm text-[var(--color-text-muted)] m-0">
              {t("vehicles.pageSubtitle")}
            </p>
          </div>
          <Button variant="default" type="button" onClick={reset} className="shrink-0">
            <Plus className="h-4 w-4" />
            {t("vehicles.registerUnit")}
          </Button>
        </header>

        <div className="flex flex-wrap items-center gap-2 p-2 bg-[var(--color-surface-sunken)] border border-[var(--color-hairline)] rounded-[var(--radius-md)]">
          <ToggleGroup
            type="single"
            value={statusFilter}
            onValueChange={(v) => v && setStatusFilter(v)}
            variant="outline"
            size="sm"
          >
            {["ALL", "AVAILABLE", "RESERVED", "IN_SERVICE", "OUT_OF_ORDER"].map(s => (
              <ToggleGroupItem key={s} value={s}>
                {s === "ALL" ? t("common.all") : t(`vehicleStatus.${s}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t("vehicles.searchPlaceholder")}
            className="ml-auto w-full sm:w-64"
          />

          <div className="flex items-center gap-1.5">
            <span className="text-sm text-[var(--color-text-muted)]">{t("vehicles.typeLabel")}</span>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger size="sm" className="min-w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("vehicles.allClasses")}</SelectItem>
                {VEHICLE_CLASSES.map((c) => (
                  <SelectItem key={c} value={c}>{t(`vehicleClass.${c}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="border border-[var(--color-hairline)] rounded-[var(--radius-md)] overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-[var(--color-surface-sunken)] hover:bg-[var(--color-surface-sunken)]">
                <TableHead className="uppercase tracking-wider text-xs font-semibold text-[var(--color-text-muted)]">
                  {t("vehicles.columnSerial")}
                </TableHead>
                <TableHead className="uppercase tracking-wider text-xs font-semibold text-[var(--color-text-muted)]">
                  {t("vehicles.columnMakeModel")}
                </TableHead>
                <TableHead className="uppercase tracking-wider text-xs font-semibold text-[var(--color-text-muted)]">
                  {t("vehicles.columnStatus")}
                </TableHead>
                <TableHead className="uppercase tracking-wider text-xs font-semibold text-[var(--color-text-muted)]">
                  {t("vehicles.columnLocation")}
                </TableHead>
                <TableHead className="uppercase tracking-wider text-xs font-semibold text-[var(--color-text-muted)] text-right">
                  {t("vehicles.columnHours")}
                </TableHead>
                <TableHead className="uppercase tracking-wider text-xs font-semibold text-[var(--color-text-muted)] text-right">
                  {t("vehicles.columnNextService")}
                </TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehicles.map((v) => {
                const site = v.siteId ? siteById.get(v.siteId) : undefined;
                return (
                  <TableRow
                    key={v.id}
                    className={cn(
                      "group",
                      selectedId === v.id && "bg-[var(--color-brand-soft)] hover:bg-[var(--color-brand-soft)]"
                    )}
                  >
                    <TableCell>
                      <span className="font-mono text-xs text-[var(--color-text)] bg-[var(--color-surface-container)] px-1.5 py-0.5 rounded-[var(--radius-sm)] border border-[var(--color-hairline)] whitespace-nowrap">
                        {v.serialNumber}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-[var(--color-text)]">{v.make} {v.model}</div>
                      <div className="text-xs text-[var(--color-text-muted)]">{t(`vehicleClass.${v.vehicleClass}`)}</div>
                    </TableCell>
                    <TableCell>
                      <Badge className={"status-" + v.status} variant="secondary">
                        {t(`vehicleStatus.${v.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {site ? (
                        <span className="inline-flex items-center gap-1 text-sm text-[var(--color-text)]">
                          <MapPin className="h-3.5 w-3.5 text-[var(--color-text-muted)] shrink-0" />
                          {site.name}
                        </span>
                      ) : (
                        <span className="text-sm text-[var(--color-text-subtle)] italic">
                          {t("vehicles.locationUnassigned")}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-right">
                      {Number(v.engineHours).toFixed(1)}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-right text-[var(--color-text-subtle)] italic">
                      {t("vehicles.nextServiceTbd")}
                    </TableCell>
                    <TableCell>
                      <div
                        className={cn(
                          "flex gap-1 whitespace-nowrap justify-end transition-opacity",
                          "opacity-0 group-hover:opacity-100 focus-within:opacity-100",
                          selectedId === v.id && "opacity-100"
                        )}
                      >
                        <Button variant="ghost" size="sm" onClick={() => loadForEdit(v)} aria-label={t("common.edit")}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => loadHistory(v)} aria-label={t("common.history")}>
                          <HistoryIcon className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => confirm(t("common.deleteConfirm", { label: `${v.make} ${v.model}` })) && deleteMut.mutate(v.id)}
                          aria-label={t("common.delete")}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-[var(--color-danger-fg)]" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {vehicles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-[var(--color-text-muted)] py-6">
                    {t("vehicles.noVehicles")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="bg-[var(--color-surface-panel)] border border-[var(--color-hairline)] rounded-[var(--radius-md)] p-3.5 overflow-auto min-h-0">
        {mode.kind === "history" ? (
          <VehicleHistory vehicle={mode.vehicle} onClose={reset} />
        ) : (
          <>
            <h2>{mode.kind === "edit" ? t("vehicles.editVehicle", { make: mode.vehicle.make, model: mode.vehicle.model }) : t("vehicles.newVehicle")}</h2>
            <form onSubmit={submit} className="flex flex-col gap-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <Label className="flex flex-col gap-1.5 items-stretch">
                  <span>{t("vehicles.fieldMake")} *</span>
                  <Input required value={draft.make} onChange={(e) => set("make", e.target.value)} />
                </Label>
                <Label className="flex flex-col gap-1.5 items-stretch">
                  <span>{t("vehicles.fieldModel")} *</span>
                  <Input required value={draft.model} onChange={(e) => set("model", e.target.value)} />
                </Label>
              </div>
              <Label className="flex flex-col gap-1.5 items-stretch">
                <span>{t("vehicles.fieldSerial")} *</span>
                <Input required value={draft.serialNumber} onChange={(e) => set("serialNumber", e.target.value)} />
              </Label>
              <div className="grid grid-cols-2 gap-2.5">
                <Label className="flex flex-col gap-1.5 items-stretch">
                  <span>{t("vehicles.fieldClass")}</span>
                  <Select
                    value={draft.vehicleClass}
                    onValueChange={(val) => set("vehicleClass", val as VehicleUpsert["vehicleClass"])}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VEHICLE_CLASSES.map((c) => (
                        <SelectItem key={c} value={c}>{t(`vehicleClass.${c}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Label>
                <Label className="flex flex-col gap-1.5 items-stretch">
                  <span>{t("vehicles.fieldHours")}</span>
                  <Input
                    type="number" step="0.1" min="0" value={draft.engineHours}
                    onChange={(e) => set("engineHours", Number(e.target.value))}
                  />
                </Label>
              </div>
              <Label className="flex flex-col gap-1.5 items-stretch">
                <span>{t("vehicles.fieldStatus")}</span>
                <Select
                  value={draft.status}
                  onValueChange={(val) => set("status", val as VehicleUpsert["status"])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VEHICLE_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{t(`vehicleStatus.${s}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Label>
              {error && <p className="text-[var(--color-danger)]">{error}</p>}
              <div className="flex gap-2 mt-1.5">
                <Button type="submit" variant="default" disabled={createMut.isPending || updateMut.isPending}>
                  <Check className="h-4 w-4" />
                  {mode.kind === "edit" ? t("common.save") : t("common.create")}
                </Button>
                {mode.kind === "edit" && (
                  <Button type="button" variant="ghost" onClick={reset}>
                    {t("common.cancel")}
                  </Button>
                )}
              </div>
            </form>
          </>
        )}
      </section>
    </main>
  );
}

function VehicleHistory({ vehicle, onClose }: { vehicle: Vehicle; onClose: () => void }) {
  const { t } = useTranslation();
  const q = useQuery({
    queryKey: ["serviceOrders", "byVehicle", vehicle.id] as const,
    queryFn: () => serviceOrdersApi.listByVehicle(vehicle.id as UUID)
  });

  const orders: ServiceOrder[] = (q.data ?? [])
    .slice()
    .sort((a, b) => (b.requestedAt ?? "").localeCompare(a.requestedAt ?? ""));

  const open = orders.filter((o) => o.state !== "COMPLETED" && o.state !== "CANCELLED");
  const closed = orders.filter((o) => o.state === "COMPLETED" || o.state === "CANCELLED");

  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="m-0">{t("vehicles.historyTitle", { make: vehicle.make, model: vehicle.model })}</h2>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label={t("common.close")}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-[var(--color-text-muted)]">{t("vehicles.historyHelp")}</p>

      {q.isLoading && <p className="text-[var(--color-text-muted)]">{t("common.loading")}</p>}
      {q.error && <p className="text-[var(--color-danger)]">{(q.error as Error).message}</p>}
      {!q.isLoading && orders.length === 0 && <p className="text-[var(--color-text-muted)]">{t("vehicles.noIssues")}</p>}

      {open.length > 0 && (
        <>
          <h3 className="section-heading">{t("vehicles.openSection", { count: open.length })}</h3>
          <HistoryList orders={open} />
        </>
      )}
      {closed.length > 0 && (
        <>
          <h3 className="section-heading">{t("vehicles.closedSection", { count: closed.length })}</h3>
          <HistoryList orders={closed} />
        </>
      )}
    </div>
  );
}

function HistoryList({ orders }: { orders: ServiceOrder[] }) {
  const { t } = useTranslation();
  return (
    <ul className="history-list">
      {orders.map((o) => (
        <li key={o.id}>
          <div className="history-row">
            <Badge className={"state-" + o.state} variant="secondary">{t(`state.${o.state}`)}</Badge>
            <span className="font-mono">{o.vmrsCode}</span>
            <span className="history-desc">{o.title ?? o.vmrsDescription ?? ""}</span>
          </div>
          <div className="history-meta text-[var(--color-text-muted)]">
            {t("vehicles.historyMeta", {
              requested: fmtDateTime(o.requestedAt),
              estimated: o.estimatedMinutes,
              actualLine: o.actualMinutes != null ? t("vehicles.historyActualSuffix", { actual: o.actualMinutes }) : "",
              completedLine: o.completedAt ? t("vehicles.historyCompletedSuffix", { completed: fmtDateTime(o.completedAt) }) : ""
            })}
          </div>
          {o.notes && (
            <pre className="font-mono text-[var(--text-xs)] bg-[var(--color-surface-sunken)] border border-[var(--color-hairline)] p-2 rounded-[var(--radius-sm)] whitespace-pre-wrap m-0 text-[var(--color-text)]">
              {o.notes}
            </pre>
          )}
        </li>
      ))}
    </ul>
  );
}
