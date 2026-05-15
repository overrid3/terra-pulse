import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Pencil, X } from "lucide-react";
import { serviceOrdersApi } from "../api/serviceOrders";
import { sitesApi } from "../api/sites";
import { vehiclesApi } from "../api/vehicles";
import { clientsApi } from "../api/clients";
import { queryKeys } from "../api/client";
import { ServiceOrder, ServiceOrderState, SERVICE_ORDER_STATES, Site } from "../types";
import { AddressLookup } from "../components/AddressLookup";
import { fmtDateTime } from "../i18n/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
    <main className="flex-1 min-h-0 p-3.5 grid gap-3.5 grid-cols-[1.6fr_1fr]">
      <Card className="overflow-auto">
        <CardContent className="p-3.5">
          <div className="flex items-center justify-between gap-2.5 mb-3 flex-wrap">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="m-0 text-[var(--text-lg)] font-semibold">{t("orders.pageTitle")}</h2>
              <Select value={stateFilter} onValueChange={(v) => setStateFilter(v as ServiceOrderState | "ALL")}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t("common.all")}</SelectItem>
                  {SERVICE_ORDER_STATES.map((s) => (
                    <SelectItem key={s} value={s}>{t(`state.${s}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <label className="flex items-center gap-1.5 text-[var(--text-sm)] text-[var(--color-text-muted)]">
                <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />
                {t("orders.showClosed")}
              </label>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[var(--text-sm)] text-[var(--color-text-muted)]">{t("common.rows", { count: orders.length })}</span>
              <Button variant="default" type="button" onClick={() => setSelected(null)}>
                + {t("common.create")}
              </Button>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("orders.columnState")}</TableHead>
                <TableHead>{t("orders.columnTitle")}</TableHead>
                <TableHead>{t("orders.columnVmrs")}</TableHead>
                <TableHead>{t("orders.columnClient")}</TableHead>
                <TableHead>{t("orders.columnEstimated")}</TableHead>
                <TableHead>{t("orders.columnActual")}</TableHead>
                <TableHead>{t("orders.columnRequested")}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => (
                <TableRow
                  key={o.id}
                  onClick={() => setSelected(o)}
                  className={cn("cursor-pointer", selected?.id === o.id && "bg-[var(--color-brand-soft)]")}
                >
                  <TableCell><Badge className={"state-" + o.state} variant="secondary">{t(`state.${o.state}`)}</Badge></TableCell>
                  <TableCell>{o.title ?? <span className="text-[var(--color-text-muted)]">{t("common.dash")}</span>}</TableCell>
                  <TableCell className="font-mono">{o.vmrsCode}</TableCell>
                  <TableCell>{o.clientName ?? <span className="text-[var(--color-text-muted)]">{t("common.dash")}</span>}</TableCell>
                  <TableCell>{t("common.minutesShort", { count: o.estimatedMinutes })}</TableCell>
                  <TableCell>{o.actualMinutes ?? t("common.dash")}</TableCell>
                  <TableCell className="text-[var(--color-text-muted)]">{fmtDateTime(o.requestedAt)}</TableCell>
                  <TableCell className="flex gap-1 whitespace-nowrap justify-end">
                    <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setSelected(o); }}>{t("common.inspect")}</Button>
                  </TableCell>
                </TableRow>
              ))}
              {orders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-[var(--color-text-muted)]">{t("orders.noOrders")}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="overflow-auto">
        <CardContent className="p-3.5">
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
        </CardContent>
      </Card>
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
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="m-0 text-[var(--text-lg)] font-semibold">{t("orders.orderDetail")}</h2>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label={t("common.close")}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <dl>
        <dt>{t("orders.columnTitle")}</dt>
        <dd>
          {editingTitle ? (
            <span className="flex items-center gap-2 flex-wrap">
              <Input
                value={titleDraft ?? ""}
                onChange={(e) => setTitleDraft(e.target.value)}
                maxLength={120}
                autoFocus
                className="flex-1 min-w-[140px]"
              />
              <Button variant="default" size="sm" onClick={commitTitle} disabled={renaming}>{t("orders.actionTitleSave")}</Button>
              <Button variant="ghost" size="sm" onClick={() => { setTitleDraft(null); setTitleErr(null); }}>{t("common.cancel")}</Button>
            </span>
          ) : (
            <span className="inline-flex items-center gap-2">
              <span>{order.title ?? t("common.dash")}</span>
              <Button variant="ghost" size="sm" onClick={() => setTitleDraft(order.title ?? "")} aria-label={t("orders.actionTitleEdit")}>
                <Pencil className="h-4 w-4" />
              </Button>
            </span>
          )}
          {titleErr && <p className="text-[var(--text-sm)] text-[var(--color-danger)] m-0">{titleErr}</p>}
        </dd>
        <dt>{t("orders.columnState")}</dt><dd><Badge className={"state-" + order.state} variant="secondary">{t(`state.${order.state}`)}</Badge></dd>
        <dt>{t("orders.columnVmrs")}</dt><dd className="font-mono">{order.vmrsCode}</dd>
        <dt>{t("orders.fieldClient")}</dt><dd>{order.clientName ?? t("common.dash")}</dd>
        <dt>{t("orders.fieldEstimated")}</dt><dd>{t("common.minutes", { count: order.estimatedMinutes })}</dd>
        {order.actualMinutes != null && (<><dt>{t("orders.fieldActual")}</dt><dd>{t("common.minutes", { count: order.actualMinutes })}</dd></>)}
        <dt>{t("orders.fieldSite")}</dt><dd className="font-mono">{order.siteLocation.lat.toFixed(4)}, {order.siteLocation.lng.toFixed(4)}</dd>
        <dt>{t("orders.fieldMechanic")}</dt><dd className="text-[var(--color-text-muted)] font-mono">{order.mechanicId ? order.mechanicId.slice(0, 8) + "…" : t("common.dash")}</dd>
        <dt>{t("orders.fieldRequested")}</dt><dd className="text-[var(--color-text-muted)]">{fmtDateTime(order.requestedAt)}</dd>
        {order.completedAt && <><dt>{t("orders.fieldCompleted")}</dt><dd className="text-[var(--color-text-muted)]">{fmtDateTime(order.completedAt)}</dd></>}
        {order.notes && <><dt>{t("orders.fieldNotesHistory")}</dt><dd><pre className="font-mono text-[var(--text-xs)] bg-[var(--color-surface-sunken)] border border-[var(--color-hairline)] p-2 rounded-[var(--radius-sm)] whitespace-pre-wrap m-0 text-[var(--color-text)]">{order.notes}</pre></dd></>}
      </dl>

      <h3 className="mt-3.5 mb-1.5 text-[var(--text-base)] font-semibold text-[var(--color-text)]">{t("orders.overrideHeading")}</h3>
      <p className="text-[var(--text-sm)] text-[var(--color-text-muted)] m-0 mb-2">{t("orders.overrideHelp")}</p>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="flex flex-col gap-1">
          <Label htmlFor="override-target">{t("orders.overrideTarget")}</Label>
          <Select value={overrideState} onValueChange={(v) => setOverrideState(v as "CANCELLED" | "REQUESTED")}>
            <SelectTrigger id="override-target">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CANCELLED">{t("orders.overrideCancelled")}</SelectItem>
              <SelectItem value="REQUESTED">{t("orders.overrideReopen")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="override-reason">{t("orders.overrideReason")}</Label>
          <Input id="override-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("orders.overrideReasonPlaceholder")} />
        </div>
      </div>
      <div className="flex gap-2 mt-2.5">
        <Button variant="destructive" disabled={overriding} onClick={() => onOverride(overrideState, reason)}>
          {t("orders.overrideApply")}
        </Button>
      </div>
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
