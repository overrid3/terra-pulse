import { FormEvent, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ServiceOrder } from "../types";
import { vehiclesApi } from "../api/vehicles";
import { clientsApi } from "../api/clients";
import { sitesApi } from "../api/sites";
import { vmrsApi } from "../api/vmrs";
import { queryKeys } from "../api/client";
import { ServiceOrderPatchBody } from "../api/serviceOrders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

type Props = {
  order: ServiceOrder;
  onCancel: () => void;
  onSubmit: (body: ServiceOrderPatchBody) => void;
  submitting?: boolean;
};

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

  const [title, setTitle] = useState(order.title ?? "");
  const [vehicleId, setVehicleId] = useState(order.vehicleId);
  const [clientId, setClientId] = useState<string>(order.clientId ?? "");
  const [siteId, setSiteId] = useState(order.siteId);
  const [vmrsCode, setVmrsCode] = useState(order.vmrsCode);
  const [estimatedMinutes, setEstimatedMinutes] = useState<number>(order.estimatedMinutes);
  const [notes, setNotes] = useState(order.notes ?? "");
  const [startAt, setStartAt] = useState<string>(toLocalInput(order.scheduledStartAt));
  const [endAt, setEndAt] = useState<string>(toLocalInput(order.scheduledEndAt));
  const [endManual, setEndManual] = useState<boolean>(!!order.scheduledEndAt);

  useEffect(() => {
    if (!startAt) { setEndAt(""); setEndManual(false); return; }
    if (endManual) return;
    if (!estimatedMinutes || estimatedMinutes <= 0) return;
    const d = new Date(new Date(startAt).getTime() + estimatedMinutes * 60_000);
    const pad = (n: number) => String(n).padStart(2, "0");
    setEndAt(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
  }, [startAt, estimatedMinutes, endManual]);

  const filteredSites = useMemo(
    () => (sitesQ.data ?? []).filter((s) => !clientId || s.clientId === clientId),
    [sitesQ.data, clientId]
  );

  function submit(e: FormEvent) {
    e.preventDefault();
    const body: ServiceOrderPatchBody = {};
    const trimmedTitle = title.trim();
    if (trimmedTitle && trimmedTitle !== (order.title ?? "")) body.title = trimmedTitle;
    if (vehicleId !== order.vehicleId) body.vehicleId = vehicleId;
    if ((clientId || null) !== (order.clientId ?? null) && clientId) body.clientId = clientId;
    if (siteId !== order.siteId) body.siteId = siteId;
    if (vmrsCode !== order.vmrsCode) body.vmrsCode = vmrsCode;
    if (notes !== (order.notes ?? "")) body.notes = notes;
    if (estimatedMinutes !== order.estimatedMinutes) body.estimatedMinutes = estimatedMinutes;
    const newStart = fromLocalInput(startAt);
    const newEnd = fromLocalInput(endAt);
    if (newStart !== (order.scheduledStartAt ?? null)) body.scheduledStartAt = newStart ?? undefined;
    if (newEnd !== (order.scheduledEndAt ?? null)) body.scheduledEndAt = newEnd ?? undefined;
    onSubmit(body);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 border-t border-[var(--color-hairline)] pt-3 mt-3">
      <div className="grid gap-1.5">
        <Label>{t("orders.columnTitle")}</Label>
        <Input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="grid gap-1.5">
        <Label>{t("createOrder.vehicleLabel")}</Label>
        <Select value={vehicleId} onValueChange={setVehicleId}>
          <SelectTrigger><SelectValue /></SelectTrigger>
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
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {(clientsQ.data ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label>{t("createOrder.siteLabel")}</Label>
        <Select value={siteId} onValueChange={setSiteId}>
          <SelectTrigger><SelectValue /></SelectTrigger>
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
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {(vmrsQ.data ?? []).map((c) => (
              <SelectItem key={c.code} value={c.code}>{c.code} — {c.description}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label>{t("orders.fieldEstimated")} ({t("common.minutesUnit", { defaultValue: "min" })})</Label>
        <Input
          type="number"
          min={1}
          value={estimatedMinutes}
          onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
        />
      </div>

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
          <Label>{t("createOrder.endLabel", { defaultValue: "End" })}</Label>
          <Input
            type="datetime-local"
            value={endAt}
            onChange={(e) => { setEndAt(e.target.value); setEndManual(!!e.target.value); }}
            step={3600}
            disabled={!startAt}
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label>{t("createOrder.notesLabel")}</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </div>

      <div className="flex justify-end gap-2 mt-1">
        <Button type="button" variant="ghost" onClick={onCancel}>{t("common.cancel")}</Button>
        <Button type="submit" variant="default" disabled={submitting}>{t("common.save")}</Button>
      </div>
    </form>
  );
}
