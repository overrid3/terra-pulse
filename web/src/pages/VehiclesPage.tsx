import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { vehiclesApi } from "../api/vehicles";
import { serviceOrdersApi } from "../api/serviceOrders";
import { queryKeys } from "../api/client";
import {
  Vehicle, VehicleUpsert,
  VEHICLE_CLASSES, VEHICLE_STATUSES,
  ServiceOrder, UUID
} from "../types";
import { fmtDateTime } from "../i18n/format";

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
  const qc = useQuery({ queryKey: queryKeys.vehicles, queryFn: vehiclesApi.list });
  const [mode, setMode] = useState<PanelMode>({ kind: "create" });
  const [draft, setDraft] = useState<VehicleUpsert>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const client = useQueryClient();

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

  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const selectedId = mode.kind === "create" ? null : mode.vehicle.id;
  const vehicles = (qc.data ?? []).filter(v => statusFilter === "ALL" || v.status === statusFilter);

  return (
    <main className="page-grid two-col">
      <section className="panel">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <h2 style={{ margin: 0 }}>{t("vehicles.pageTitle", { count: vehicles.length })}</h2>
          <button className="primary" type="button" onClick={reset}>
            + {t("vehicles.newVehicle")}
          </button>
        </div>
        <div className="toolbar" style={{ marginBottom: '10px' }}>
          <div className="seg-control">
            {["ALL", "AVAILABLE", "RESERVED", "IN_SERVICE", "OUT_OF_ORDER"].map(s => (
              <button
                key={s}
                type="button"
                className={statusFilter === s ? "active" : ""}
                onClick={() => setStatusFilter(s)}
              >
                {s === "ALL" ? t("common.all") : t(`vehicleStatus.${s}`)}
              </button>
            ))}
          </div>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("vehicles.columnMakeModel")}</th>
              <th>{t("vehicles.columnSerial")}</th>
              <th>{t("vehicles.columnClass")}</th>
              <th>{t("vehicles.columnHours")}</th>
              <th>{t("vehicles.columnStatus")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((v) => (
              <tr key={v.id} className={selectedId === v.id ? "selected" : ""}>
                <td>{v.make} {v.model}</td>
                <td className="mono">{v.serialNumber}</td>
                <td>{t(`vehicleClass.${v.vehicleClass}`)}</td>
                <td className="mono">{Number(v.engineHours).toFixed(1)}</td>
                <td><span className={`badge status-${v.status}`}>{t(`vehicleStatus.${v.status}`)}</span></td>
                <td className="row-actions">
                  <button onClick={() => loadForEdit(v)}>{t("common.edit")}</button>
                  <button onClick={() => loadHistory(v)}>{t("common.history")}</button>
                  <button className="danger" onClick={() => confirm(t("common.deleteConfirm", { label: `${v.make} ${v.model}` })) && deleteMut.mutate(v.id)}>{t("common.delete")}</button>
                </td>
              </tr>
            ))}
            {vehicles.length === 0 && <tr><td colSpan={6} className="muted">{t("vehicles.noVehicles")}</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="panel form-panel">
        {mode.kind === "history" ? (
          <VehicleHistory vehicle={mode.vehicle} onClose={reset} />
        ) : (
          <>
            <h2>{mode.kind === "edit" ? t("vehicles.editVehicle", { make: mode.vehicle.make, model: mode.vehicle.model }) : t("vehicles.newVehicle")}</h2>
            <form onSubmit={submit}>
              <div className="form-row">
                <label>{t("vehicles.fieldMake")} *<input required value={draft.make} onChange={(e) => set("make", e.target.value)} /></label>
                <label>{t("vehicles.fieldModel")} *<input required value={draft.model} onChange={(e) => set("model", e.target.value)} /></label>
              </div>
              <label>{t("vehicles.fieldSerial")} *<input required value={draft.serialNumber} onChange={(e) => set("serialNumber", e.target.value)} /></label>
              <div className="form-row">
                <label>{t("vehicles.fieldClass")}
                  <select value={draft.vehicleClass} onChange={(e) => set("vehicleClass", e.target.value as VehicleUpsert["vehicleClass"])}>
                    {VEHICLE_CLASSES.map((c) => <option key={c} value={c}>{t(`vehicleClass.${c}`)}</option>)}
                  </select>
                </label>
                <label>{t("vehicles.fieldHours")}
                  <input type="number" step="0.1" min="0" value={draft.engineHours}
                         onChange={(e) => set("engineHours", Number(e.target.value))} />
                </label>
              </div>
              <label>{t("vehicles.fieldStatus")}
                <select value={draft.status} onChange={(e) => set("status", e.target.value as VehicleUpsert["status"])}>
                  {VEHICLE_STATUSES.map((s) => <option key={s} value={s}>{t(`vehicleStatus.${s}`)}</option>)}
                </select>
              </label>
              {error && <p className="error">{error}</p>}
              <div className="form-actions">
                <button type="submit" disabled={createMut.isPending || updateMut.isPending}>
                  {mode.kind === "edit" ? t("common.save") : t("common.create")}
                </button>
                {mode.kind === "edit" && <button type="button" className="ghost" onClick={reset}>{t("common.cancel")}</button>}
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
      <div className="drawer-header">
        <h2>{t("vehicles.historyTitle", { make: vehicle.make, model: vehicle.model })}</h2>
        <button className="ghost" onClick={onClose} aria-label={t("common.close")}>×</button>
      </div>
      <p className="muted">{t("vehicles.historyHelp")}</p>

      {q.isLoading && <p className="muted">{t("common.loading")}</p>}
      {q.error && <p className="error">{(q.error as Error).message}</p>}
      {!q.isLoading && orders.length === 0 && <p className="muted">{t("vehicles.noIssues")}</p>}

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
            <span className={`badge state-${o.state}`}>{t(`state.${o.state}`)}</span>
            <span className="mono">{o.vmrsCode}</span>
            <span className="history-desc">{o.title ?? o.vmrsDescription ?? ""}</span>
          </div>
          <div className="history-meta muted">
            {t("vehicles.historyMeta", {
              requested: fmtDateTime(o.requestedAt),
              estimated: o.estimatedMinutes,
              actualLine: o.actualMinutes != null ? t("vehicles.historyActualSuffix", { actual: o.actualMinutes }) : "",
              completedLine: o.completedAt ? t("vehicles.historyCompletedSuffix", { completed: fmtDateTime(o.completedAt) }) : ""
            })}
          </div>
          {o.notes && <pre className="notes">{o.notes}</pre>}
        </li>
      ))}
    </ul>
  );
}
