import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { mechanicsApi, MechanicUpsert } from "../api/mechanics";
import { skillsApi } from "../api/skills";
import { queryKeys } from "../api/client";
import { Mechanic, MechanicStatus } from "../types";
import { AddressLookup } from "../components/AddressLookup";
import { AbsencesPanel } from "../components/AbsencesPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const STATUSES: MechanicStatus[] = ["IDLE", "EN_ROUTE", "IN_PROGRESS", "OFF_DUTY"];

type Draft = {
  fullName: string;
  phone: string;
  skills: string[];
  status: MechanicStatus;
  lat: string;
  lng: string;
};

const EMPTY: Draft = { fullName: "", phone: "", skills: [], status: "IDLE", lat: "", lng: "" };

export function MechanicsPage() {
  const { t } = useTranslation();
  const qc = useQuery({ queryKey: queryKeys.mechanics, queryFn: mechanicsApi.list });
  const skillsQ = useQuery({ queryKey: queryKeys.skills, queryFn: skillsApi.list });
  const catalog = (skillsQ.data ?? []).map((s) => s.name);
  const [editing, setEditing] = useState<Mechanic | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.mechanics });

  const createMut = useMutation({
    mutationFn: (body: MechanicUpsert) => mechanicsApi.create(body),
    onSuccess: () => { invalidate(); reset(); },
    onError: (e: Error) => setError(e.message)
  });
  const patchMut = useMutation({
    mutationFn: (args: { id: string; body: Partial<MechanicUpsert> }) => mechanicsApi.patch(args.id, args.body),
    onSuccess: () => { invalidate(); reset(); },
    onError: (e: Error) => setError(e.message)
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => mechanicsApi.delete(id),
    onSuccess: invalidate,
    onError: (e: Error) => setError(e.message)
  });

  function reset() { setEditing(null); setDraft(EMPTY); setError(null); }

  function loadForEdit(m: Mechanic) {
    setEditing(m);
    setDraft({
      fullName: m.fullName,
      phone: m.phone ?? "",
      skills: m.skills,
      status: m.status,
      lat: m.location ? String(m.location.lat) : "",
      lng: m.location ? String(m.location.lng) : ""
    });
  }

  function toBody(): MechanicUpsert {
    const body: MechanicUpsert = {
      fullName: draft.fullName,
      phone: draft.phone || null,
      skills: draft.skills,
      status: draft.status
    };
    if (draft.lat && draft.lng) {
      body.location = { lat: Number(draft.lat), lng: Number(draft.lng) };
    }
    return body;
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const body = toBody();
    if (editing) patchMut.mutate({ id: editing.id, body });
    else         createMut.mutate(body);
  }

  function toggleSkill(skill: string) {
    setDraft((d) => ({
      ...d,
      skills: d.skills.includes(skill) ? d.skills.filter((s) => s !== skill) : [...d.skills, skill]
    }));
  }

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const total = qc.data?.length ?? 0;
  const available = qc.data?.filter((m) => m.status === "IDLE").length ?? 0;
  const inField = qc.data?.filter((m) => m.status === "EN_ROUTE" || m.status === "IN_PROGRESS").length ?? 0;
  const offDuty = qc.data?.filter((m) => m.status === "OFF_DUTY").length ?? 0;

  const statCardClass =
    "bg-[var(--color-surface-container-highest)] border-[var(--color-hairline)] rounded-[var(--radius-md)] p-3 gap-1.5";
  const statLabelClass =
    "text-[var(--text-xs)] font-semibold tracking-[0.04em] uppercase text-[var(--color-text-subtle)]";
  const statValueBase =
    "font-mono text-[1.4rem] font-medium leading-none text-[var(--color-text)]";

  const mainClass = editing
    ? "flex-1 min-h-0 p-3.5 grid gap-3.5"
    : "flex-1 min-h-0 p-3.5 grid gap-3.5 grid-cols-[1.6fr_1fr]";
  const mainStyle = editing
    ? {
        gridTemplateColumns: "1.6fr 1fr",
        gridTemplateAreas: "'list form' 'absences absences'"
      } as React.CSSProperties
    : undefined;

  return (
    <main className={mainClass} style={mainStyle}>
      <section
        className="bg-[var(--color-surface-panel)] border border-[var(--color-hairline)] rounded-[var(--radius-md)] p-3.5 overflow-auto min-h-0"
        style={editing ? { gridArea: "list" } : undefined}
      >
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="m-0 text-[var(--text-base)] font-semibold">
            {t("mechanics.pageTitle", { count: total })}
          </h2>
          <Button
            variant="default"
            type="button"
            onClick={() => { setEditing(null); setDraft(EMPTY); setError(null); }}
          >
            <Plus className="w-4 h-4" />
            {t("mechanics.newMechanic")}
          </Button>
        </div>

        <div className="grid grid-cols-4 gap-2.5 mb-3">
          <Card className={statCardClass}>
            <div className={statLabelClass}>Total Roster</div>
            <div className={statValueBase}>{total}</div>
          </Card>
          <Card className={statCardClass}>
            <div className={statLabelClass}>Available</div>
            <div className={statValueBase}>{available}</div>
          </Card>
          <Card className={statCardClass}>
            <div className={statLabelClass}>In Field</div>
            <div className={cn(statValueBase, "text-[var(--color-brand-strong)]")}>{inField}</div>
          </Card>
          <Card className={statCardClass}>
            <div className={statLabelClass}>Off Duty</div>
            <div className={statValueBase}>{offDuty}</div>
          </Card>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("mechanics.columnName")}</TableHead>
              <TableHead>{t("mechanics.columnStatus")}</TableHead>
              <TableHead>{t("mechanics.columnSkills")}</TableHead>
              <TableHead>{t("mechanics.columnLocation")}</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {qc.data?.map((m) => (
              <TableRow key={m.id} data-state={editing?.id === m.id ? "selected" : undefined}>
                <TableCell>
                  <span className="inline-flex items-baseline gap-2 min-w-0">
                    <span>{m.fullName}</span>
                    {m.phone && (
                      <span className="font-mono text-[var(--text-xs)] text-[var(--color-text-subtle)]">
                        {m.phone}
                      </span>
                    )}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className={`status-${m.status}`}>
                    {t(`mechanicStatus.${m.status}`)}
                  </Badge>
                </TableCell>
                <TableCell>
                  {m.skills.length > 0 ? (
                    <span className="flex flex-nowrap gap-1 max-w-full overflow-x-auto">
                      {m.skills.map((s) => (
                        <Badge key={s} variant="secondary" className="text-[var(--text-xs)]">
                          {s}
                        </Badge>
                      ))}
                    </span>
                  ) : (
                    <span className="text-[var(--color-text-subtle)]">{t("common.dash")}</span>
                  )}
                </TableCell>
                <TableCell className="font-mono">
                  {m.location
                    ? `${m.location.lat.toFixed(4)}, ${m.location.lng.toFixed(4)}`
                    : t("common.dash")}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 whitespace-nowrap justify-end">
                    <Button variant="outline" size="sm" onClick={() => loadForEdit(m)}>
                      {t("common.edit")}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => confirm(t("common.deleteConfirm", { label: m.fullName })) && deleteMut.mutate(m.id)}
                    >
                      {t("common.delete")}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {qc.data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-[var(--color-text-subtle)]">
                  {t("mechanics.noMechanics")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>

      <section
        className="bg-[var(--color-surface-panel)] border border-[var(--color-hairline)] rounded-[var(--radius-md)] p-3.5 overflow-auto min-h-0"
        style={editing ? { gridArea: "form" } : undefined}
      >
        <h2 className="m-0 mb-3 text-[var(--text-base)] font-semibold">
          {editing ? t("mechanics.editMechanic", { name: editing.fullName }) : t("mechanics.newMechanic")}
        </h2>
        <form onSubmit={submit} className="flex flex-col gap-2.5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mech-fullName">{t("mechanics.fieldFullName")} *</Label>
            <Input
              id="mech-fullName"
              required
              value={draft.fullName}
              onChange={(e) => set("fullName", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mech-phone">{t("mechanics.fieldPhone")}</Label>
            <Input
              id="mech-phone"
              value={draft.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mech-status">{t("mechanics.fieldStatus")}</Label>
            <Select
              value={draft.status}
              onValueChange={(v) => v && set("status", v as MechanicStatus)}
            >
              <SelectTrigger id="mech-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{t(`mechanicStatus.${s}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>
              {t("mechanics.fieldSkills")}{" "}
              <span className="text-[var(--color-text-subtle)] font-normal">
                {t("mechanics.skillsManagedAt", { link: "" })}
                <a href="/skills" className="underline">/skills</a>
              </span>
            </Label>
            {catalog.length === 0 ? (
              <p className="text-[var(--text-sm)] text-[var(--color-text-subtle)] m-0">
                {t("mechanics.skillsCatalogEmpty")}
              </p>
            ) : (
              <div className="flex gap-2.5 flex-wrap">
                {catalog.map((s) => (
                  <label
                    key={s}
                    className="inline-flex items-center gap-1.5 text-[var(--text-sm)]"
                  >
                    <input
                      type="checkbox"
                      checked={draft.skills.includes(s)}
                      onChange={() => toggleSkill(s)}
                    />
                    {s}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mech-address">{t("mechanics.fieldAddressLookup")}</Label>
            <AddressLookup
              onPick={(h) => setDraft((d) => ({ ...d, lat: String(h.lat), lng: String(h.lng) }))}
              placeholder={t("mechanics.addressPlaceholder")}
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mech-lat">{t("mechanics.fieldLat")}</Label>
              <Input
                id="mech-lat"
                type="number"
                step="any"
                value={draft.lat}
                onChange={(e) => set("lat", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mech-lng">{t("mechanics.fieldLng")}</Label>
              <Input
                id="mech-lng"
                type="number"
                step="any"
                value={draft.lng}
                onChange={(e) => set("lng", e.target.value)}
              />
            </div>
          </div>

          {error && <p className="text-[var(--color-danger-text)] text-[var(--text-sm)] m-0">{error}</p>}

          <div className="flex gap-2 mt-1.5">
            <Button
              type="submit"
              variant="default"
              disabled={createMut.isPending || patchMut.isPending}
            >
              {editing ? t("common.save") : t("common.create")}
            </Button>
            {editing && (
              <Button type="button" variant="ghost" onClick={reset}>
                {t("common.cancel")}
              </Button>
            )}
          </div>
        </form>
      </section>

      {editing && <AbsencesPanel mechanicId={editing.id} mechanicName={editing.fullName} />}
    </main>
  );
}
