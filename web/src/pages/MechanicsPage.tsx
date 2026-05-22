import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Plus, Pencil, Trash2, CalendarOff, MapPin, HardHat } from "lucide-react";
import { mechanicsApi, MechanicUpsert } from "../api/mechanics";
import { skillsApi } from "../api/skills";
import { serviceOrdersApi } from "../api/serviceOrders";
import { queryKeys } from "../api/client";
import { Mechanic, MechanicStatus } from "../types";
import { AddressLookup } from "../components/AddressLookup";
import { AbsencesPanel } from "../components/AbsencesPanel";
import { SearchInput } from "../components/SearchInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription
} from "@/components/ui/sheet";
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
import { useIsMobile, useResizableSplit } from "@/hooks/useResizableSplit";
import { ResizableSplitHandle } from "@/components/ResizableSplitHandle";

const STATUSES: MechanicStatus[] = ["IDLE", "EN_ROUTE", "IN_PROGRESS", "OFF_DUTY"];

type StatusFilter = "ALL" | "AVAILABLE" | "IN_FIELD" | "OFF_DUTY";

type Draft = {
  fullName: string;
  phone: string;
  skills: string[];
  status: MechanicStatus;
  lat: string;
  lng: string;
};

const EMPTY: Draft = { fullName: "", phone: "", skills: [], status: "IDLE", lat: "", lng: "" };

function matchStatusFilter(s: MechanicStatus, f: StatusFilter) {
  switch (f) {
    case "ALL":       return true;
    case "AVAILABLE": return s === "IDLE";
    case "IN_FIELD":  return s === "EN_ROUTE" || s === "IN_PROGRESS";
    case "OFF_DUTY":  return s === "OFF_DUTY";
  }
}

export function MechanicsPage() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { panelRef: listPanelRef, initialWidth: listInitialWidth, startDrag } = useResizableSplit({
    storageKey: "tp.mechanics.listWidth",
    defaultWidth: 760,
    minWidth: 480,
    maxWidth: 1100,
  });
  const qc = useQuery({ queryKey: queryKeys.mechanics, queryFn: mechanicsApi.list });
  const skillsQ = useQuery({ queryKey: queryKeys.skills, queryFn: skillsApi.list });
  const ordersQ = useQuery({ queryKey: queryKeys.serviceOrders, queryFn: serviceOrdersApi.list });
  const catalog = (skillsQ.data ?? []).map((s) => s.name);
  const [panelMode, setPanelMode] = useState<"empty" | "form">("empty");
  const [editing, setEditing] = useState<Mechanic | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");
  const [oooFor, setOooFor] = useState<Mechanic | null>(null);
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

  function reset() { setPanelMode("empty"); setEditing(null); setDraft(EMPTY); setError(null); }

  function openCreate() { setPanelMode("form"); setEditing(null); setDraft(EMPTY); setError(null); }

  function loadForEdit(m: Mechanic) {
    setPanelMode("form");
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

  const q = search.trim().toLowerCase();
  const rows = useMemo(() => {
    return (qc.data ?? []).filter((m) =>
      matchStatusFilter(m.status, statusFilter) &&
      (!q ||
        m.fullName.toLowerCase().includes(q) ||
        m.skills.some((s) => s.toLowerCase().includes(q)) ||
        (m.phone ?? "").toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q))
    );
  }, [qc.data, statusFilter, q]);

  const assignmentById = useMemo(() => {
    const map = new Map<string, { code: string }>();
    (ordersQ.data ?? [])
      .filter((o) => o.mechanicId && (o.state === "SCHEDULED" || o.state === "IN_PROGRESS"))
      .forEach((o) => map.set(o.mechanicId!, { code: o.vmrsCode }));
    return map;
  }, [ordersQ.data]);

  const statCardClass =
    "bg-[var(--color-surface-container-highest)] border-[var(--color-hairline)] rounded-[var(--radius-md)] p-3 gap-1.5";
  const statLabelClass =
    "text-[var(--text-xs)] font-semibold tracking-[0.04em] uppercase text-[var(--color-text-subtle)]";
  const statValueBase =
    "font-mono text-[1.4rem] font-medium leading-none text-[var(--color-text)]";

  return (
    <main className="flex-1 min-h-0 p-3.5 flex flex-row gap-0">
      <section
        ref={listPanelRef}
        style={{ width: !isMobile ? listInitialWidth : undefined }}
        className="md:shrink-0 md:min-w-[480px] md:max-w-[1100px] bg-[var(--color-surface-panel)] border border-[var(--color-hairline)] rounded-[var(--radius-md)] p-3.5 overflow-auto min-h-0 flex flex-col gap-3"
      >
        <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-[var(--color-text)] m-0 mb-1">
              {t("mechanics.pageTitle2")}
            </h2>
            <p className="text-sm text-[var(--color-text-muted)] m-0">
              {t("mechanics.pageSubtitle")}
            </p>
          </div>
          <Button
            variant="default"
            type="button"
            onClick={openCreate}
            className="shrink-0"
          >
            <Plus className="w-4 h-4" />
            {t("mechanics.addMechanic")}
          </Button>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <Card className={statCardClass}>
            <div className={statLabelClass}>{t("mechanics.statTotal")}</div>
            <div className={statValueBase}>{total}</div>
          </Card>
          <Card className={statCardClass}>
            <div className={statLabelClass}>{t("mechanics.statInField")}</div>
            <div className={cn(statValueBase, "text-[var(--color-brand-strong)]")}>{inField}</div>
          </Card>
          <Card className={statCardClass}>
            <div className={statLabelClass}>{t("mechanics.statAvailable")}</div>
            <div className={statValueBase}>{available}</div>
          </Card>
          <Card className={statCardClass}>
            <div className={statLabelClass}>{t("mechanics.statOffDuty")}</div>
            <div className={statValueBase}>{offDuty}</div>
          </Card>
        </div>

        <div className="flex flex-wrap items-center gap-2 p-2 bg-[var(--color-surface-sunken)] border border-[var(--color-hairline)] rounded-[var(--radius-md)]">
          <ToggleGroup
            type="single"
            value={statusFilter}
            onValueChange={(v) => v && setStatusFilter(v as StatusFilter)}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="ALL">{t("mechanics.filterAll")}</ToggleGroupItem>
            <ToggleGroupItem value="AVAILABLE">{t("mechanics.filterAvailable")}</ToggleGroupItem>
            <ToggleGroupItem value="IN_FIELD">{t("mechanics.filterInField")}</ToggleGroupItem>
            <ToggleGroupItem value="OFF_DUTY">{t("mechanics.filterOffDuty")}</ToggleGroupItem>
          </ToggleGroup>

          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t("mechanics.searchPlaceholder")}
            className="ml-auto w-full sm:w-72"
          />

          <span className="text-xs text-[var(--color-text-muted)] font-mono">
            {t("common.rows", { count: rows.length })}
          </span>
        </div>

        <div className="border border-[var(--color-hairline)] rounded-[var(--radius-md)] overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-[var(--color-surface-sunken)] hover:bg-[var(--color-surface-sunken)]">
                <TableHead className="uppercase tracking-wider text-xs font-semibold text-[var(--color-text-muted)]">{t("mechanics.columnName")}</TableHead>
                <TableHead className="uppercase tracking-wider text-xs font-semibold text-[var(--color-text-muted)]">{t("mechanics.columnStatus")}</TableHead>
                <TableHead className="uppercase tracking-wider text-xs font-semibold text-[var(--color-text-muted)]">{t("mechanics.columnSkills")}</TableHead>
                <TableHead className="uppercase tracking-wider text-xs font-semibold text-[var(--color-text-muted)]">{t("mechanics.columnAssignment")}</TableHead>
                <TableHead className="uppercase tracking-wider text-xs font-semibold text-[var(--color-text-muted)]">{t("mechanics.columnLocation")}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((m) => {
                const initials = m.fullName.split(/\s+/).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join("");
                const assignment = assignmentById.get(m.id);
                return (
                  <TableRow
                    key={m.id}
                    className={cn(
                      "group",
                      editing?.id === m.id && "bg-[var(--color-brand-soft)] hover:bg-[var(--color-brand-soft)]"
                    )}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[var(--color-surface-container-highest)] border border-[var(--color-hairline)] flex items-center justify-center font-mono text-xs text-[var(--color-text)] shrink-0">
                          {initials || "??"}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium text-[var(--color-text)] truncate">{m.fullName}</span>
                          {m.phone && (
                            <span className="font-mono text-xs text-[var(--color-text-subtle)] truncate">{m.phone}</span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className={cn("status-dot", `dot-${m.status}`)} aria-hidden="true" />
                        <span className="font-mono text-xs text-[var(--color-text)]">{m.status}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {m.skills.length > 0 ? (
                        <span className="flex flex-nowrap gap-1 max-w-full overflow-x-auto">
                          {m.skills.map((s) => (
                            <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                          ))}
                        </span>
                      ) : (
                        <span className="text-[var(--color-text-subtle)] italic text-sm">{t("mechanics.noAssignment")}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {assignment ? (
                        <span className="font-mono text-xs text-[var(--color-text)] bg-[var(--color-surface-container)] px-1.5 py-0.5 rounded-[var(--radius-sm)] border border-[var(--color-hairline)] whitespace-nowrap">
                          {assignment.code}
                        </span>
                      ) : (
                        <span className="text-[var(--color-text-subtle)] italic text-sm">{t("mechanics.noAssignment")}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {m.location ? (
                        <span className="inline-flex items-center gap-1 text-sm">
                          <MapPin className="h-3.5 w-3.5 text-[var(--color-text-muted)] shrink-0" />
                          <span className="font-mono text-xs">{m.location.lat.toFixed(3)}, {m.location.lng.toFixed(3)}</span>
                        </span>
                      ) : (
                        <span className="text-[var(--color-text-subtle)] italic text-sm">{t("mechanics.noAssignment")}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div
                        className={cn(
                          "flex gap-1 whitespace-nowrap justify-end transition-opacity",
                          "opacity-0 group-hover:opacity-100 focus-within:opacity-100",
                          editing?.id === m.id && "opacity-100"
                        )}
                      >
                        <Button variant="ghost" size="sm" onClick={() => loadForEdit(m)} aria-label={t("common.edit")}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setOooFor(m)} aria-label={t("mechanics.manageOoo")}>
                          <CalendarOff className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => confirm(t("common.deleteConfirm", { label: m.fullName })) && deleteMut.mutate(m.id)}
                          aria-label={t("common.delete")}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-[var(--color-danger-fg)]" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-[var(--color-text-muted)] py-6">
                    {t("mechanics.noMechanics")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {!isMobile && <ResizableSplitHandle onStart={startDrag} />}

      <section className="flex-1 min-w-0 bg-[var(--color-surface-panel)] border border-[var(--color-hairline)] rounded-[var(--radius-md)] p-3.5 overflow-auto min-h-0 flex flex-col">
        {panelMode === "empty" ? (
          <div className="flex-1 flex flex-col items-center justify-center text-[var(--color-text-muted)] gap-2">
            <HardHat className="w-12 h-12 opacity-40" />
            <span>{t("mechanics.selectMechanic")}</span>
          </div>
        ) : (
          <>
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

          {error && <p className="text-[var(--color-danger-fg)] text-[var(--text-sm)] m-0">{error}</p>}

          <div className="flex gap-2 mt-1.5">
            <Button
              type="submit"
              variant="default"
              disabled={createMut.isPending || patchMut.isPending}
            >
              {editing ? t("common.save") : t("common.create")}
            </Button>
            <Button type="button" variant="ghost" onClick={reset}>
              {t("common.cancel")}
            </Button>
          </div>
        </form>
          </>
        )}
      </section>

      <Sheet open={oooFor !== null} onOpenChange={(open) => !open && setOooFor(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
          {oooFor && (
            <>
              <SheetHeader className="border-b border-[var(--color-hairline)]">
                <SheetTitle>{t("mechanics.oooSheetTitle", { name: oooFor.fullName })}</SheetTitle>
                <SheetDescription>{t("absences.panelHelp")}</SheetDescription>
              </SheetHeader>
              <div className="p-0">
                <AbsencesPanel mechanicId={oooFor.id} mechanicName={oooFor.fullName} />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </main>
  );
}
