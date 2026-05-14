import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { serviceOrdersApi } from "../api/serviceOrders";
import { vehiclesApi } from "../api/vehicles";
import { clientsApi } from "../api/clients";
import { queryKeys } from "../api/client";
import { ServiceOrder, ServiceOrderState, SERVICE_ORDER_STATES } from "../types";
import { AddressLookup } from "../components/AddressLookup";
import { fmtDateTime } from "../i18n/format";

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
  const { t } = useTranslation();
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
  const renameMut = useMutation({
    mutationFn: (args: { id: string; title: string }) => serviceOrdersApi.renameTitle(args.id, args.title),
    onSuccess: (updated) => {
      invalidate();
      setSelected(updated);
    }
  });

  return (
    <main className="page-grid two-col">
      <section className="panel">
        <div className="filters">
          <h2>{t("orders.pageTitle")}</h2>
          <label><input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} /> {t("orders.showClosed")}</label>
          <label>{t("orders.filterState")}
            <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value as any)}>
              <option value="ALL">{t("common.all")}</option>
              {SERVICE_ORDER_STATES.map((s) => <option key={s} value={s}>{t(`state.${s}`)}</option>)}
            </select>
          </label>
          <span className="muted">{t("common.rows", { count: orders.length })}</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("orders.columnState")}</th>
              <th>{t("orders.columnTitle")}</th>
              <th>{t("orders.columnVmrs")}</th>
              <th>{t("orders.columnClient")}</th>
              <th>{t("orders.columnEstimated")}</th>
              <th>{t("orders.columnActual")}</th>
              <th>{t("orders.columnRequested")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className={selected?.id === o.id ? "selected" : ""} onClick={() => setSelected(o)}>
                <td><span className={`badge state-${o.state}`}>{t(`state.${o.state}`)}</span></td>
                <td>{o.title ?? <span className="muted">{t("common.dash")}</span>}</td>
                <td className="mono">{o.vmrsCode}</td>
                <td>{o.clientName ?? <span className="muted">{t("common.dash")}</span>}</td>
                <td>{t("common.minutesShort", { count: o.estimatedMinutes })}</td>
                <td>{o.actualMinutes ?? t("common.dash")}</td>
                <td className="muted">{fmtDateTime(o.requestedAt)}</td>
                <td className="row-actions">
                  <button onClick={(e) => { e.stopPropagation(); setSelected(o); }}>{t("common.inspect")}</button>
                </td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={8} className="muted">{t("orders.noOrders")}</td></tr>}
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
  onOverride: (state: "CANCELLED" | "REQUESTED", reason: string) => void;
  overriding: boolean;
  onRename: (title: string) => void;
  renaming: boolean;
}) {
  const { t } = useTranslation();
  const [overrideState, setOverrideState] = useState<"CANCELLED" | "REQUESTED">("CANCELLED");
  const [reason, setReason] = useState("");
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [titleErr, setTitleErr] = useState<string | null>(null);

  const editingTitle = titleDraft !== null;

  function commitTitle() {
    if (titleDraft === null) return;
    const trimmed = titleDraft.trim();
    if (!trimmed) { setTitleErr(t("errors.titleRequired")); return; }
    if (trimmed.length > 120) { setTitleErr(t("errors.titleTooLong")); return; }
    setTitleErr(null);
    onRename(trimmed);
    setTitleDraft(null);
  }

  return (
    <div>
      <div className="drawer-header">
        <h2>{t("orders.orderDetail")}</h2>
        <button className="ghost" onClick={onClose} aria-label={t("common.close")}>×</button>
      </div>
      <dl>
        <dt>{t("orders.columnTitle")}</dt>
        <dd>
          {editingTitle ? (
            <span className="complete-row">
              <input
                value={titleDraft ?? ""}
                onChange={(e) => setTitleDraft(e.target.value)}
                maxLength={120}
                autoFocus
              />
              <button onClick={commitTitle} disabled={renaming}>{t("orders.actionTitleSave")}</button>
              <button className="ghost" onClick={() => { setTitleDraft(null); setTitleErr(null); }}>{t("common.cancel")}</button>
            </span>
          ) : (
            <span className="title-row">
              <span>{order.title ?? t("common.dash")}</span>
              <button className="ghost" onClick={() => setTitleDraft(order.title ?? "")} aria-label={t("orders.actionTitleEdit")}>✎</button>
            </span>
          )}
          {titleErr && <p className="error">{titleErr}</p>}
        </dd>
        <dt>{t("orders.columnState")}</dt><dd><span className={`badge state-${order.state}`}>{t(`state.${order.state}`)}</span></dd>
        <dt>{t("orders.columnVmrs")}</dt><dd className="mono">{order.vmrsCode}</dd>
        <dt>{t("orders.fieldClient")}</dt><dd>{order.clientName ?? t("common.dash")}</dd>
        <dt>{t("orders.fieldEstimated")}</dt><dd>{t("common.minutes", { count: order.estimatedMinutes })}</dd>
        {order.actualMinutes != null && (<><dt>{t("orders.fieldActual")}</dt><dd>{t("common.minutes", { count: order.actualMinutes })}</dd></>)}
        <dt>{t("orders.fieldSite")}</dt><dd className="mono">{order.siteLocation.lat.toFixed(4)}, {order.siteLocation.lng.toFixed(4)}</dd>
        <dt>{t("orders.fieldMechanic")}</dt><dd className="muted mono">{order.mechanicId ? order.mechanicId.slice(0, 8) + "…" : t("common.dash")}</dd>
        <dt>{t("orders.fieldRequested")}</dt><dd className="muted">{fmtDateTime(order.requestedAt)}</dd>
        {order.completedAt && <><dt>{t("orders.fieldCompleted")}</dt><dd className="muted">{fmtDateTime(order.completedAt)}</dd></>}
        {order.notes && <><dt>{t("orders.fieldNotesHistory")}</dt><dd><pre className="notes">{order.notes}</pre></dd></>}
      </dl>

      <h3 className="section-heading override-heading">{t("orders.overrideHeading")}</h3>
      <p className="muted">{t("orders.overrideHelp")}</p>
      <div className="form-row">
        <label>{t("orders.overrideTarget")}
          <select value={overrideState} onChange={(e) => setOverrideState(e.target.value as any)}>
            <option value="CANCELLED">{t("orders.overrideCancelled")}</option>
            <option value="REQUESTED">{t("orders.overrideReopen")}</option>
          </select>
        </label>
        <label>{t("orders.overrideReason")}
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("orders.overrideReasonPlaceholder")} />
        </label>
      </div>
      <button className="danger" disabled={overriding} onClick={() => onOverride(overrideState, reason)}>
        {t("orders.overrideApply")}
      </button>
    </div>
  );
}

function NewOrderForm({
  vehicles, clients, onSubmit, submitting
}: {
  vehicles: { id: string; make: string; model: string; serialNumber: string }[];
  clients: { id: string; name: string }[];
  onSubmit: (body: { vehicleId: string; clientId: string; vmrsCode: string; title?: string; siteLocation: { lat: number; lng: number }; notes?: string }) => void;
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

  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      vehicleId, clientId, vmrsCode,
      title: title.trim() || undefined,
      siteLocation: { lat: Number(lat), lng: Number(lng) },
      notes: notes || undefined
    });
  }

  return (
    <>
      <h2>{t("orders.newOrder")}</h2>
      <form onSubmit={submit}>
        <label>{t("orders.fieldVehicle")} *
          <select required value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
            <option value="">{t("orders.selectPlaceholder")}</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {t("orders.vehicleOption", { make: v.make, model: v.model, serial: v.serialNumber })}
              </option>
            ))}
          </select>
        </label>
        <label>{t("orders.fieldClient")} *
          <select required value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">{t("orders.selectPlaceholder")}</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>{t("orders.fieldVmrs")}
          <select value={vmrsCode} onChange={(e) => setVmrsCode(e.target.value)}>
            {VMRS_OPTIONS.map((v) => <option key={v.code} value={v.code}>{v.label}</option>)}
          </select>
        </label>
        <label>{t("orders.fieldTitle")}
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        </label>
        <label>{t("orders.fieldAddressLookup")}
          <AddressLookup
            onPick={(h) => { setLat(String(h.lat)); setLng(String(h.lng)); }}
            placeholder={t("orders.addressPlaceholder")}
          />
        </label>
        <div className="form-row">
          <label>{t("orders.fieldLat")} *<input required type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)} /></label>
          <label>{t("orders.fieldLng")} *<input required type="number" step="any" value={lng} onChange={(e) => setLng(e.target.value)} /></label>
        </div>
        <label>{t("orders.fieldNotes")}<textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        <div className="form-actions">
          <button type="submit" disabled={submitting || !vehicleId || !clientId}>{t("orders.newOrder")}</button>
        </div>
      </form>
    </>
  );
}
