import { FormEvent, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ServiceOrder, ServiceOrderState } from "../types";
import { vehiclesApi } from "../api/vehicles";
import { clientsApi } from "../api/clients";
import { sitesApi } from "../api/sites";
import { vmrsApi } from "../api/vmrs";
import { queryKeys } from "../api/client";
import { ServiceOrderPatchBody } from "../api/serviceOrders";
import { parseDuration, formatDuration } from "../lib/duration";
import { MechanicPicker } from "./MechanicPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

export type OrderSaveBody = {
  patch?: ServiceOrderPatchBody;
  override?: {
    state: ServiceOrderState;
    reason: string;
    mechanicId?: string;
    actualMinutes?: number;
  };
};

type Props = {
  order: ServiceOrder;
  onCancel: () => void;
  onSubmit: (body: OrderSaveBody) => void;
  submitting?: boolean;
};

const ALL_STATES: ServiceOrderState[] = [
  "REQUESTED", "QUOTED", "APPROVED", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED",
];

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(v: string): string | null {
  if (!v) return null;
  return new Date(v).toISOString();
}

export function OrderEditForm({ order, onCancel, onSubmit, submitting }: Props) {
  const { t } = useTranslation();
  const vehiclesQ = useQuery({ queryKey: queryKeys.vehicles, queryFn: vehiclesApi.list });
  const clientsQ  = useQuery({ queryKey: queryKeys.clients,  queryFn: clientsApi.list });
  const sitesQ    = useQuery({ queryKey: queryKeys.sitesAll, queryFn: sitesApi.listAll });
  const vmrsQ     = useQuery({ queryKey: queryKeys.vmrs,     queryFn: vmrsApi.list });

  const [title, setTitle]           = useState(order.title ?? "");
  const [vehicleId, setVehicleId]   = useState(order.vehicleId);
  const [clientId, setClientId]     = useState<string>(order.clientId ?? "");
  const [siteId, setSiteId]         = useState(order.siteId);
  const [vmrsCode, setVmrsCode]     = useState(order.vmrsCode);
  const [estimation, setEstimation] = useState<string>(formatDuration(order.estimatedMinutes));
  const [notes, setNotes]           = useState(order.notes ?? "");
  const [startAt, setStartAt]       = useState<string>(toLocalInput(order.scheduledStartAt));
  const [endAt, setEndAt]           = useState<string>(toLocalInput(order.scheduledEndAt));
  const [endManual, setEndManual]   = useState<boolean>(!!order.scheduledEndAt);

  const [stateVal, setStateVal] = useState<ServiceOrderState>(order.state);
  const [reason, setReason] = useState("");
  const [mechanicId, setMechanicId] = useState<string | undefined>(order.mechanicId ?? undefined);
  const [actualMinutes, setActualMinutes] = useState<number>(order.actualMinutes ?? order.estimatedMinutes);

  const parsedMinutes   = useMemo(() => parseDuration(estimation), [estimation]);
  const estimationError = estimation !== "" && parsedMinutes === null;

  useEffect(() => {
    if (!startAt) { setEndAt(""); setEndManual(false); return; }
    if (endManual) return;
    if (!parsedMinutes || parsedMinutes <= 0) return;
    const d = new Date(new Date(startAt).getTime() + parsedMinutes * 60_000);
    const pad = (n: number) => String(n).padStart(2, "0");
    setEndAt(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
  }, [startAt, parsedMinutes, endManual]);

  const filteredSites = useMemo(
    () => (sitesQ.data ?? []).filter((s) => !clientId || s.clientId === clientId),
    [sitesQ.data, clientId]
  );

  const stateChanged = stateVal !== order.state;
  const needsMechanic =
    stateChanged
    && (stateVal === "SCHEDULED" || stateVal === "IN_PROGRESS" || stateVal === "COMPLETED")
    && !order.mechanicId;
  const needsMinutes = stateChanged && stateVal === "COMPLETED" && order.actualMinutes == null;

  const canSubmit =
    !estimationError
    && (!stateChanged || ((!needsMechanic || !!mechanicId) && (!needsMinutes || actualMinutes > 0)));

  function submit(e: FormEvent) {
    e.preventDefault();
    const patch: ServiceOrderPatchBody = {};
    const trimmedTitle = title.trim();
    if (trimmedTitle && trimmedTitle !== (order.title ?? "")) patch.title = trimmedTitle;
    if (vehicleId !== order.vehicleId) patch.vehicleId = vehicleId;
    if ((clientId || null) !== (order.clientId ?? null) && clientId) patch.clientId = clientId;
    if (siteId !== order.siteId) patch.siteId = siteId;
    if (vmrsCode !== order.vmrsCode) patch.vmrsCode = vmrsCode;
    if (notes !== (order.notes ?? "")) patch.notes = notes;
    if (parsedMinutes != null && parsedMinutes !== order.estimatedMinutes) patch.estimatedMinutes = parsedMinutes;
    const newStart = fromLocalInput(startAt);
    const newEnd = fromLocalInput(endAt);
    if (newStart !== (order.scheduledStartAt ?? null)) patch.scheduledStartAt = newStart ?? undefined;
    if (newEnd !== (order.scheduledEndAt ?? null)) patch.scheduledEndAt = newEnd ?? undefined;

    const body: OrderSaveBody = {};
    if (Object.keys(patch).length > 0) body.patch = patch;
    if (stateChanged) {
      body.override = {
        state: stateVal,
        reason,
        mechanicId: needsMechanic ? mechanicId : undefined,
        actualMinutes: needsMinutes ? actualMinutes : undefined,
      };
    }
    onSubmit(body);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="grid gap-1.5">
        <Label>{t("orders.columnState")}</Label>
        <Select value={stateVal} onValueChange={(v) => setStateVal(v as ServiceOrderState)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {ALL_STATES.map((s) => (
              <SelectItem key={s} value={s}>{t(`state.${s}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {stateChanged && (
          <>
            <p className="text-[var(--text-sm)] text-[var(--color-text-muted)] m-0">
              {t("orders.overrideHelp")}
            </p>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("orders.overrideReasonPlaceholder")}
              aria-label={t("orders.overrideReason")}
            />
            {needsMechanic && (
              <div className="grid gap-1.5">
                <Label>{t("orders.fieldMechanic")}</Label>
                <MechanicPicker value={mechanicId} onChange={setMechanicId} />
              </div>
            )}
            {needsMinutes && (
              <div className="grid gap-1.5">
                <Label>{t("orders.fieldActual")}</Label>
                <Input
                  type="number"
                  min={1}
                  value={actualMinutes}
                  onChange={(e) => setActualMinutes(Number(e.target.value))}
                />
              </div>
            )}
          </>
        )}
      </div>

      <div className="grid gap-1.5">
        <Label>{t("createOrder.title")}</Label>
        <Input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder={t("createOrder.titlePlaceholder")} />
      </div>

      <div className="grid gap-1.5">
        <Label>{t("createOrder.vehicleLabel")}</Label>
        <Select value={vehicleId} onValueChange={setVehicleId}>
          <SelectTrigger><SelectValue placeholder={t("createOrder.vehiclePlaceholder")} /></SelectTrigger>
          <SelectContent>
            {(vehiclesQ.data ?? []).map((v) => (
              <SelectItem key={v.id} value={v.id}>{v.make} {v.model} ({v.serialNumber})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label>{t("createOrder.clientLabel")}</Label>
        <Select value={clientId} onValueChange={(v) => { setClientId(v); setSiteId(""); }}>
          <SelectTrigger><SelectValue placeholder={t("createOrder.clientPlaceholder")} /></SelectTrigger>
          <SelectContent>
            {(clientsQ.data ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label>{t("createOrder.siteLabel")}</Label>
        <Select value={siteId} onValueChange={setSiteId} disabled={!clientId}>
          <SelectTrigger>
            <SelectValue placeholder={clientId ? t("createOrder.sitePlaceholder") : t("createOrder.siteDisabledPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {filteredSites.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label>{t("createOrder.vmrsLabel")}</Label>
        <Select value={vmrsCode} onValueChange={setVmrsCode}>
          <SelectTrigger><SelectValue placeholder={t("createOrder.vmrsPlaceholder")} /></SelectTrigger>
          <SelectContent>
            {(vmrsQ.data ?? []).map((c) => (
              <SelectItem key={c.code} value={c.code}>{c.code} — {c.description}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label>{t("createOrder.estimationLabel")}</Label>
        <Input
          value={estimation}
          onChange={(e) => setEstimation(e.target.value)}
          placeholder={t("createOrder.estimationPlaceholder")}
          aria-invalid={!!estimationError}
        />
        <span className={`text-xs ${estimationError ? "text-[var(--color-danger-fg)]" : "text-[var(--color-text-muted)]"}`}>
          {estimationError
            ? t("createOrder.estimationInvalid")
            : parsedMinutes != null
              ? t("createOrder.estimationParsed", { minutes: parsedMinutes })
              : t("createOrder.estimationHint")}
        </span>
      </div>

      <div className="border-t pt-3 mt-1">
        <div className="text-sm text-[var(--color-text-muted)] mb-2">{t("createOrder.scheduleSectionTitle")}</div>

        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1.5">
            <Label>{t("createOrder.startLabel")}</Label>
            <Input
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              step={3600}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>{t("createOrder.endLabel")}</Label>
            <Input
              type="datetime-local"
              value={endAt}
              onChange={(e) => { setEndAt(e.target.value); setEndManual(!!e.target.value); }}
              step={3600}
              disabled={!startAt}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label>{t("createOrder.notesLabel")}</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </div>

      <div className="flex justify-end gap-2 mt-1">
        <Button type="button" variant="ghost" onClick={onCancel}>{t("common.cancel")}</Button>
        <Button type="submit" variant="default" disabled={submitting || !canSubmit}>{t("common.save")}</Button>
      </div>
    </form>
  );
}
