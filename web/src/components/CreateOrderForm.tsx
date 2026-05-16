import { useState, useMemo, useEffect, FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
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

export function CreateOrderForm({ onSubmit, onCancel, submitting, initialMechanicId, initialStartAt }: Props) {
  const vehiclesQ  = useQuery({ queryKey: queryKeys.vehicles,    queryFn: vehiclesApi.list });
  const clientsQ   = useQuery({ queryKey: queryKeys.clients,     queryFn: clientsApi.list });
  const sitesQ     = useQuery({ queryKey: queryKeys.sitesAll,    queryFn: sitesApi.listAll });
  const vmrsQ      = useQuery({ queryKey: queryKeys.vmrs,        queryFn: vmrsApi.list });
  const mechanicsQ = useQuery({ queryKey: queryKeys.mechanics,   queryFn: mechanicsApi.list });

  const [vehicleId,      setVehicleId]      = useState<string>("");
  const [clientId,       setClientId]       = useState<string>("");
  const [siteId,         setSiteId]         = useState<string>("");
  const [vmrsCode,       setVmrsCode]       = useState<string>("");
  const [title,          setTitle]          = useState<string>("");
  const [notes,          setNotes]          = useState<string>("");
  const [estimation,     setEstimation]     = useState<string>("");
  const [mechanicId,     setMechanicId]     = useState<string>(initialMechanicId ?? "");
  const [startAt,        setStartAt]        = useState<string>(initialStartAt ?? "");
  const [endAtOverride,  setEndAtOverride]  = useState<string>("");

  useEffect(() => {
    const v = vmrsQ.data?.find((x) => x.code === vmrsCode);
    if (v && !estimation) {
      setEstimation(formatDuration(Math.round(v.srtMinutes * v.difficultyFactor)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vmrsCode, vmrsQ.data]);

  const filteredSites = useMemo(
    () => (sitesQ.data ?? []).filter((s) => !clientId || s.clientId === clientId),
    [sitesQ.data, clientId]
  );

  const parsedMinutes = useMemo(() => parseDuration(estimation), [estimation]);
  const estimationError = estimation && parsedMinutes === null;

  function computedEndAt(): string {
    if (endAtOverride) return endAtOverride;
    if (!startAt || !parsedMinutes) return "";
    const end = new Date(new Date(startAt).getTime() + parsedMinutes * 60_000);
    return end.toISOString();
  }

  const assignNow     = Boolean(mechanicId && startAt);
  const assignPartial = Boolean((mechanicId || startAt) && !(mechanicId && startAt));

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!vehicleId || !clientId || !siteId || !vmrsCode) {
      toast.error("Vehicle, client, site, VMRS required");
      return;
    }
    if (!parsedMinutes || parsedMinutes <= 0) {
      toast.error("Invalid estimation");
      return;
    }
    if (assignPartial) {
      toast.error("Set both mechanic + start time, or neither");
      return;
    }
    const body: CreateOrderBody = {
      vehicleId, clientId, siteId, vmrsCode,
      title: title.trim() || undefined,
      notes: notes.trim() || undefined,
      estimation,
    };
    if (assignNow) {
      body.mechanicId        = mechanicId;
      body.scheduledStartAt  = new Date(startAt).toISOString();
      body.scheduledEndAt    = computedEndAt();
    }
    onSubmit(body);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="grid gap-1.5">
        <Label>Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="optional" />
      </div>

      <div className="grid gap-1.5">
        <Label>Vehicle *</Label>
        <Select value={vehicleId} onValueChange={setVehicleId}>
          <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
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
        <Label>Client *</Label>
        <Select value={clientId} onValueChange={(val) => { setClientId(val); setSiteId(""); }}>
          <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
          <SelectContent>
            {(clientsQ.data ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label>Site *</Label>
        <Select value={siteId} onValueChange={setSiteId} disabled={!clientId}>
          <SelectTrigger>
            <SelectValue placeholder={clientId ? "Select site" : "Select client first"} />
          </SelectTrigger>
          <SelectContent>
            {filteredSites.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label>VMRS *</Label>
        <Select value={vmrsCode} onValueChange={setVmrsCode}>
          <SelectTrigger><SelectValue placeholder="Select VMRS code" /></SelectTrigger>
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
        <Label>Estimation *</Label>
        <Input
          value={estimation}
          onChange={(e) => setEstimation(e.target.value)}
          placeholder="1d, 2h30m, 90m"
          aria-invalid={!!estimationError}
        />
        <span className={`text-xs ${estimationError ? "text-[var(--color-danger-fg)]" : "text-[var(--color-text-muted)]"}`}>
          {estimationError
            ? "Invalid format"
            : parsedMinutes != null
              ? `= ${parsedMinutes} min`
              : "e.g. 1d, 2h30m, 90m, 1.5h"}
        </span>
      </div>

      <div className="border-t pt-3 mt-1">
        <div className="text-sm text-[var(--color-text-muted)] mb-2">Optional: Assign now</div>

        <div className="grid gap-1.5">
          <Label>Mechanic</Label>
          <Select value={mechanicId} onValueChange={setMechanicId}>
            <SelectTrigger><SelectValue placeholder="— none —" /></SelectTrigger>
            <SelectContent>
              {(mechanicsQ.data ?? []).map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.fullName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5 mt-2">
          <Label>Start (local)</Label>
          <Input
            type="datetime-local"
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
            step={3600}
          />
        </div>

        {assignNow && (
          <div className="grid gap-1.5 mt-2">
            <Label>End</Label>
            <Input
              type="datetime-local"
              value={
                endAtOverride
                  ? new Date(endAtOverride).toISOString().slice(0, 16)
                  : computedEndAt().slice(0, 16)
              }
              onChange={(e) => setEndAtOverride(new Date(e.target.value).toISOString())}
              step={3600}
            />
          </div>
        )}

        {assignPartial && (
          <p className="text-xs text-[var(--color-danger-fg)] mt-1">
            Set both mechanic + start, or neither
          </p>
        )}
      </div>

      <div className="grid gap-1.5">
        <Label>Notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </div>

      <div className="flex justify-end gap-2 mt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={submitting || !!estimationError || assignPartial}>
          {submitting ? "Creating…" : "Create"}
        </Button>
      </div>
    </form>
  );
}
