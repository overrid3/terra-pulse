import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { serviceOrdersApi } from "../api/serviceOrders";
import { vehiclesApi } from "../api/vehicles";
import { clientsApi } from "../api/clients";
import { queryKeys } from "../api/client";
import { ServiceOrder, ServiceOrderState, SERVICE_ORDER_STATES } from "../types";
import { AddressLookup } from "../components/AddressLookup";

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

export function OrdersPage() {
  const qc = useQueryClient();
  const ordersQ   = useQuery({ queryKey: queryKeys.serviceOrders, queryFn: serviceOrdersApi.list });
  const vehiclesQ = useQuery({ queryKey: queryKeys.vehicles,      queryFn: vehiclesApi.list });
  const clientsQ  = useQuery({ queryKey: queryKeys.clients,       queryFn: clientsApi.list });

  const [showClosed, setShowClosed] = useState(false);
  const [stateFilter, setStateFilter] = useState<ServiceOrderState | "ALL">("ALL");
  const [selected, setSelected] = useState<ServiceOrder | null>(null);

  const orders = useMemo(() => {
    const all = ordersQ.data ?? [];
    return all
      .filter((o) => (showClosed ? true : !CLOSED.has(o.state)))
      .filter((o) => (stateFilter === "ALL" ? true : o.state === stateFilter))
      .sort((a, b) => (b.requestedAt ?? "").localeCompare(a.requestedAt ?? ""));
  }, [ordersQ.data, showClosed, stateFilter]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: queryKeys.serviceOrders });
    qc.invalidateQueries({ queryKey: queryKeys.mechanics });
  };

  const createMut   = useMutation({ mutationFn: serviceOrdersApi.create, onSuccess: invalidate });
  const overrideMut = useMutation({
    mutationFn: (args: { id: string; state: "CANCELLED" | "REQUESTED"; reason: string }) =>
      serviceOrdersApi.override(args.id, args.state, args.reason),
    onSuccess: invalidate
  });

  return (
    <main className="page-grid two-col">
      <section className="panel">
        <div className="filters">
          <h2>Service orders</h2>
          <label><input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} /> show closed</label>
          <label>State
            <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value as any)}>
              <option value="ALL">all</option>
              {SERVICE_ORDER_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <span className="muted">{orders.length} rows</span>
        </div>
        <table className="data-table">
          <thead>
            <tr><th>State</th><th>VMRS</th><th>Client</th><th>Est.</th><th>Actual</th><th>Requested</th><th></th></tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className={selected?.id === o.id ? "selected" : ""} onClick={() => setSelected(o)}>
                <td><span className={`badge state-${o.state}`}>{o.state}</span></td>
                <td className="mono">{o.vmrsCode}</td>
                <td>{o.clientName ?? <span className="muted">—</span>}</td>
                <td>{o.estimatedMinutes}m</td>
                <td>{o.actualMinutes ?? "—"}</td>
                <td className="muted">{new Date(o.requestedAt).toLocaleString()}</td>
                <td className="row-actions">
                  <button onClick={(e) => { e.stopPropagation(); setSelected(o); }}>Inspect</button>
                </td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={7} className="muted">no orders match</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="panel form-panel">
        {selected ? (
          <OrderDetail
            order={selected}
            onClose={() => setSelected(null)}
            onOverride={(state, reason) => overrideMut.mutate({ id: selected.id, state, reason })}
            overriding={overrideMut.isPending}
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
  order, onClose, onOverride, overriding
}: {
  order: ServiceOrder;
  onClose: () => void;
  onOverride: (state: "CANCELLED" | "REQUESTED", reason: string) => void;
  overriding: boolean;
}) {
  const [overrideState, setOverrideState] = useState<"CANCELLED" | "REQUESTED">("CANCELLED");
  const [reason, setReason] = useState("");
  return (
    <div>
      <div className="drawer-header">
        <h2>Order detail</h2>
        <button className="ghost" onClick={onClose}>×</button>
      </div>
      <dl>
        <dt>State</dt><dd><span className={`badge state-${order.state}`}>{order.state}</span></dd>
        <dt>VMRS</dt><dd className="mono">{order.vmrsCode}</dd>
        <dt>Client</dt><dd>{order.clientName ?? "—"}</dd>
        <dt>Estimated</dt><dd>{order.estimatedMinutes} min</dd>
        {order.actualMinutes != null && (<><dt>Actual</dt><dd>{order.actualMinutes} min</dd></>)}
        <dt>Site</dt><dd className="mono">{order.siteLocation.lat.toFixed(4)}, {order.siteLocation.lng.toFixed(4)}</dd>
        <dt>Mechanic</dt><dd className="muted">{order.mechanicId ? order.mechanicId.slice(0, 8) + "…" : "—"}</dd>
        <dt>Requested</dt><dd className="muted">{new Date(order.requestedAt).toLocaleString()}</dd>
        {order.completedAt && <><dt>Completed</dt><dd className="muted">{new Date(order.completedAt).toLocaleString()}</dd></>}
        {order.notes && <><dt>Notes</dt><dd><pre className="notes">{order.notes}</pre></dd></>}
      </dl>

      <h3 style={{ marginTop: 18 }}>Override state</h3>
      <p className="muted">
        Admin override bypasses the normal workflow. Only <code>CANCELLED</code> and <code>REQUESTED</code> are allowed.
        Reopening to <code>REQUESTED</code> clears the assigned mechanic and lifecycle timestamps.
      </p>
      <div className="form-row">
        <label>Target
          <select value={overrideState} onChange={(e) => setOverrideState(e.target.value as any)}>
            <option value="CANCELLED">CANCELLED</option>
            <option value="REQUESTED">REQUESTED (reopen)</option>
          </select>
        </label>
        <label>Reason
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why?" />
        </label>
      </div>
      <button className="danger" disabled={overriding} onClick={() => onOverride(overrideState, reason)}>
        Apply override
      </button>
    </div>
  );
}

function NewOrderForm({
  vehicles, clients, onSubmit, submitting
}: {
  vehicles: { id: string; make: string; model: string; serialNumber: string }[];
  clients: { id: string; name: string }[];
  onSubmit: (body: { vehicleId: string; clientId: string; vmrsCode: string; siteLocation: { lat: number; lng: number }; notes?: string }) => void;
  submitting: boolean;
}) {
  const [vehicleId, setVehicleId] = useState("");
  const [clientId,  setClientId]  = useState("");
  const [vmrsCode,  setVmrsCode]  = useState(VMRS_OPTIONS[0].code);
  const [lat, setLat] = useState("45.46");
  const [lng, setLng] = useState("9.19");
  const [notes, setNotes] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      vehicleId, clientId, vmrsCode,
      siteLocation: { lat: Number(lat), lng: Number(lng) },
      notes: notes || undefined
    });
  }

  return (
    <>
      <h2>New order</h2>
      <form onSubmit={submit}>
        <label>Vehicle *
          <select required value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
            <option value="">— pick —</option>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.make} {v.model} · {v.serialNumber}</option>)}
          </select>
        </label>
        <label>Client *
          <select required value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">— pick —</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>VMRS task
          <select value={vmrsCode} onChange={(e) => setVmrsCode(e.target.value)}>
            {VMRS_OPTIONS.map((v) => <option key={v.code} value={v.code}>{v.label}</option>)}
          </select>
        </label>
        <label>Site address lookup
          <AddressLookup
            onPick={(h) => { setLat(String(h.lat)); setLng(String(h.lng)); }}
            placeholder="Search site address to auto-fill lat/lng"
          />
        </label>
        <div className="form-row">
          <label>Site lat *<input required type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)} /></label>
          <label>Site lng *<input required type="number" step="any" value={lng} onChange={(e) => setLng(e.target.value)} /></label>
        </div>
        <label>Notes<textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        <div className="form-actions">
          <button type="submit" disabled={submitting || !vehicleId || !clientId}>Create order</button>
        </div>
      </form>
    </>
  );
}
