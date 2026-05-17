import { useState, useMemo, useEffect, FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { vehiclesApi } from "../api/vehicles";
import { clientsApi } from "../api/clients";
import { sitesApi } from "../api/sites";
import { vmrsApi } from "../api/vmrs";
import { mechanicsApi } from "../api/mechanics";
import { queryKeys } from "../api/client";
import { CreateOrderBody } from "../api/serviceOrders";
import { parseDuration, formatDuration } from "../lib/duration";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { UUID } from "../types";

type Props = {
  onSubmit: (body: CreateOrderBody) => Promise<void> | void;
  onCancel: () => void;
  submitting: boolean;
  initialMechanicId?: UUID;
  initialStartAt?: string;
};

// Convert an ISO/UTC string to the `YYYY-MM-DDTHH:mm` shape expected by
// <input type="datetime-local">. We deliberately use local-time components
// because the input itself surfaces the value in the user's local zone.
function toLocalInputValue(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CreateOrderForm({ onSubmit, onCancel, submitting, initialMechanicId, initialStartAt }: Props) {
  const { t } = useTranslation();
  const vehiclesQ  = useQuery({ queryKey: queryKeys.vehicles,    queryFn: vehiclesApi.list });
  const clientsQ   = useQuery({ queryKey: queryKeys.clients,     queryFn: clientsApi.list });
  const sitesQ     = useQuery({ queryKey: queryKeys.sitesAll,    queryFn: sitesApi.listAll });
  const vmrsQ      = useQuery({ queryKey: queryKeys.vmrs,        queryFn: vmrsApi.list });
  const mechanicsQ = useQuery({ queryKey: queryKeys.mechanics,   queryFn: mechanicsApi.list });

  const [vehicleId,        setVehicleId]        = useState<string>("");
  const [clientId,         setClientId]         = useState<string>("");
  const [siteId,           setSiteId]           = useState<string>("");
  const [vmrsCode,         setVmrsCode]         = useState<string>("");
  const [title,            setTitle]            = useState<string>("");
  const [notes,            setNotes]            = useState<string>("");
  const [estimation,       setEstimation]       = useState<string>("");
  const [mechanicId,       setMechanicId]       = useState<string>(initialMechanicId ?? "");
  const [startAt,          setStartAt]          = useState<string>(initialStartAt ?? "");
  const [endAt,            setEndAt]            = useState<string>("");
  const [endManuallySet,   setEndManuallySet]   = useState<boolean>(false);

  // Auto-fill estimation from VMRS srt * difficulty when picking a code.
  useEffect(() => {
    const v = vmrsQ.data?.find((x) => x.code === vmrsCode);
    if (v && !estimation) {
      setEstimation(formatDuration(Math.round(v.srtMinutes * v.difficultyFactor)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vmrsCode, vmrsQ.data]);

  const parsedMinutes = useMemo(() => parseDuration(estimation), [estimation]);
  const estimationError = estimation && parsedMinutes === null;

  const filteredSites = useMemo(
    () => (sitesQ.data ?? []).filter((s) => !clientId || s.clientId === clientId),
    [sitesQ.data, clientId]
  );

  // Auto-derive endAt from startAt + parsedMinutes whenever the user hasn't
  // manually overridden the end. Re-enabling auto-shift happens when the user
  // clears the end (handled in onChange) or clears the start.
  useEffect(() => {
    if (endManuallySet) return;
    if (!startAt || !parsedMinutes) return;
    const startMs = new Date(startAt).getTime();
    if (Number.isNaN(startMs)) return;
    const end = new Date(startMs + parsedMinutes * 60_000);
    setEndAt(end.toISOString());
  }, [startAt, parsedMinutes, endManuallySet]);

  // Clearing the start re-enables auto-shift and clears the derived end.
  useEffect(() => {
    if (!startAt) {
      setEndManuallySet(false);
      setEndAt("");
    }
  }, [startAt]);

  function handleEndChange(localValue: string) {
    if (!localValue) {
      // User cleared end -> resume auto-shift on next start/estimation change.
      setEndManuallySet(false);
      setEndAt("");
      return;
    }
    setEndManuallySet(true);
    setEndAt(new Date(localValue).toISOString());
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!vehicleId || !clientId || !siteId || !vmrsCode) {
      toast.error(t("createOrder.errorRequiredFields"));
      return;
    }
    if (!parsedMinutes || parsedMinutes <= 0) {
      toast.error(t("createOrder.errorInvalidEstimation"));
      return;
    }

    const body: CreateOrderBody = {
      vehicleId, clientId, siteId, vmrsCode,
      title: title.trim() || undefined,
      notes: notes.trim() || undefined,
      estimation,
    };

    // Backend currently requires all three (mechanicId + start + end) together.
    // Send the schedule tuple only when all three are present; otherwise omit
    // mechanicId / dates to avoid a partial-schedule rejection.
    const hasStart = Boolean(startAt);
    const hasEnd   = Boolean(endAt);
    if (mechanicId && hasStart && hasEnd) {
      body.mechanicId       = mechanicId;
      body.scheduledStartAt = new Date(startAt).toISOString();
      body.scheduledEndAt   = endAt;
    }

    onSubmit(body);
  }

  // Show end picker whenever the user has a start date (so they can preview /
  // override the derived end). Without a start there is nothing to anchor to.
  const showEndField = Boolean(startAt);
  // Hint about mechanic-without-start being a no-op for assignment.
  const showMechanicHint = Boolean(mechanicId && !startAt);
  // Hint about start-without-mechanic dropping the schedule from the payload.
  const showDatesPendingMechanicHint = Boolean(startAt && !mechanicId);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="grid gap-1.5">
        <Label>{t("createOrder.title")}</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("createOrder.titlePlaceholder")} />
      </div>

      <div className="grid gap-1.5">
        <Label>{t("createOrder.vehicleLabel")}</Label>
        <Select value={vehicleId} onValueChange={setVehicleId}>
          <SelectTrigger><SelectValue placeholder={t("createOrder.vehiclePlaceholder")} /></SelectTrigger>
          <SelectContent>
            {(vehiclesQ.data ?? []).map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.make} {v.model} ({v.serialNumber})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label>{t("createOrder.clientLabel")}</Label>
        <Select value={clientId} onValueChange={(val) => { setClientId(val); setSiteId(""); }}>
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
              <SelectItem key={c.code} value={c.code}>
                {c.code} — {c.description}
              </SelectItem>
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

        <div className="grid gap-1.5">
          <Label>{t("createOrder.mechanicLabel")}</Label>
          <Select value={mechanicId} onValueChange={setMechanicId}>
            <SelectTrigger><SelectValue placeholder={t("createOrder.mechanicPlaceholder")} /></SelectTrigger>
            <SelectContent>
              {(mechanicsQ.data ?? []).map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.fullName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {showMechanicHint && (
            <span className="text-xs text-[var(--color-text-muted)]">
              {t("createOrder.mechanicHint")}
            </span>
          )}
        </div>

        <div className="grid gap-1.5 mt-2">
          <Label>{t("createOrder.startLabel")}</Label>
          <Input
            type="datetime-local"
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
            step={3600}
          />
        </div>

        {showEndField && (
          <div className="grid gap-1.5 mt-2">
            <Label>{t("createOrder.endLabel")}</Label>
            <Input
              type="datetime-local"
              value={toLocalInputValue(endAt)}
              onChange={(e) => handleEndChange(e.target.value)}
              step={3600}
            />
          </div>
        )}

        {showDatesPendingMechanicHint && (
          <p className="text-xs text-[var(--color-text-muted)] mt-2">
            {t("createOrder.datesPendingMechanicHint")}
          </p>
        )}
      </div>

      <div className="grid gap-1.5">
        <Label>{t("createOrder.notesLabel")}</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </div>

      <div className="flex justify-end gap-2 mt-2">
        <Button type="button" variant="outline" onClick={onCancel}>{t("createOrder.cancel")}</Button>
        <Button type="submit" disabled={submitting || !!estimationError}>
          {submitting ? t("createOrder.creating") : t("createOrder.create")}
        </Button>
      </div>
    </form>
  );
}
