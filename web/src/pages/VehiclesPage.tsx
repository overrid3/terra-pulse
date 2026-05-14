import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { vehiclesApi } from "../api/vehicles";
import { serviceOrdersApi } from "../api/serviceOrders";
import { queryKeys } from "../api/client";
import {
  Vehicle, VehicleUpsert,
  VEHICLE_CLASSES, VEHICLE_STATUSES,
  ServiceOrder, UUID
} from "../types";

const EMPTY: VehicleUpsert = {
  make: "", model: "", serialNumber: "",
  vehicleClass: "EXCAVATOR", engineHours: 0, status: "AVAILABLE"
};

type PanelMode =
  | { kind: "create" }
  | { kind: "edit"; vehicle: Vehicle }
  | { kind: "history"; vehicle: Vehicle };

export function VehiclesPage() {
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

  const selectedId = mode.kind === "create" ? null : mode.vehicle.id;

  return (
    <main className="page-grid two-col">
      <section className="panel">
        <h2>Vehicles ({qc.data?.length ?? 0})</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Make / Model</th><th>Serial</th><th>Class</th>
              <th>Hours</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {qc.data?.map((v) => (
              <tr key={v.id} className={selectedId === v.id ? "selected" : ""}>
                <td>{v.make} {v.model}</td>
                <td className="mono">{v.serialNumber}</td>
                <td>{v.vehicleClass}</td>
                <td className="mono">{Number(v.engineHours).toFixed(1)}</td>
                <td><span className={`badge status-${v.status}`}>{v.status}</span></td>
                <td className="row-actions">
                  <button onClick={() => loadForEdit(v)}>Edit</button>
                  <button onClick={() => loadHistory(v)}>History</button>
                  <button className="danger" onClick={() => confirm(`Delete ${v.make} ${v.model}?`) && deleteMut.mutate(v.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {qc.data?.length === 0 && <tr><td colSpan={6} className="muted">no vehicles yet</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="panel form-panel">
        {mode.kind === "history" ? (
          <VehicleHistory vehicle={mode.vehicle} onClose={reset} />
        ) : (
          <>
            <h2>{mode.kind === "edit" ? `Edit ${mode.vehicle.make} ${mode.vehicle.model}` : "New vehicle"}</h2>
            <form onSubmit={submit}>
              <div className="form-row">
                <label>Make *<input required value={draft.make} onChange={(e) => set("make", e.target.value)} /></label>
                <label>Model *<input required value={draft.model} onChange={(e) => set("model", e.target.value)} /></label>
              </div>
              <label>Serial number *<input required value={draft.serialNumber} onChange={(e) => set("serialNumber", e.target.value)} /></label>
              <div className="form-row">
                <label>Class
                  <select value={draft.vehicleClass} onChange={(e) => set("vehicleClass", e.target.value as VehicleUpsert["vehicleClass"])}>
                    {VEHICLE_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <label>Engine hours
                  <input type="number" step="0.1" min="0" value={draft.engineHours}
                         onChange={(e) => set("engineHours", Number(e.target.value))} />
                </label>
              </div>
              <label>Status
                <select value={draft.status} onChange={(e) => set("status", e.target.value as VehicleUpsert["status"])}>
                  {VEHICLE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              {error && <p className="error">{error}</p>}
              <div className="form-actions">
                <button type="submit" disabled={createMut.isPending || updateMut.isPending}>
                  {mode.kind === "edit" ? "Save" : "Create"}
                </button>
                {mode.kind === "edit" && <button type="button" className="ghost" onClick={reset}>Cancel</button>}
              </div>
            </form>
          </>
        )}
      </section>
    </main>
  );
}

function VehicleHistory({ vehicle, onClose }: { vehicle: Vehicle; onClose: () => void }) {
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
        <h2>History · {vehicle.make} {vehicle.model}</h2>
        <button className="ghost" onClick={onClose}>×</button>
      </div>
      <p className="muted">
        Issues for this vehicle. Each row is a service order tied to a VMRS code.
        Open = workflow in progress. Closed = COMPLETED or CANCELLED.
      </p>

      {q.isLoading && <p className="muted">loading…</p>}
      {q.error && <p className="error">{(q.error as Error).message}</p>}
      {!q.isLoading && orders.length === 0 && <p className="muted">no issues recorded</p>}

      {open.length > 0 && (
        <>
          <h3 style={{ marginTop: 14 }}>Open ({open.length})</h3>
          <HistoryList orders={open} />
        </>
      )}
      {closed.length > 0 && (
        <>
          <h3 style={{ marginTop: 14 }}>Closed ({closed.length})</h3>
          <HistoryList orders={closed} />
        </>
      )}
    </div>
  );
}

function HistoryList({ orders }: { orders: ServiceOrder[] }) {
  return (
    <ul className="history-list">
      {orders.map((o) => (
        <li key={o.id}>
          <div className="history-row">
            <span className={`badge state-${o.state}`}>{o.state}</span>
            <span className="mono">{o.vmrsCode}</span>
            <span className="history-desc">{o.vmrsDescription ?? ""}</span>
          </div>
          <div className="history-meta muted">
            requested {new Date(o.requestedAt).toLocaleString()} ·
            est {o.estimatedMinutes}m{o.actualMinutes != null ? ` · actual ${o.actualMinutes}m` : ""}
            {o.completedAt && ` · completed ${new Date(o.completedAt).toLocaleString()}`}
          </div>
          {o.notes && <pre className="notes">{o.notes}</pre>}
        </li>
      ))}
    </ul>
  );
}
