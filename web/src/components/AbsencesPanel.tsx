import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { absencesApi } from "../api/absences";
import { queryKeys } from "../api/client";
import {
  AbsenceType, ABSENCE_TYPES, AbsenceUpsert, MechanicAbsence, UUID
} from "../types";
import { fmtDateTime } from "../i18n/format";

type Props = { mechanicId: UUID; mechanicName: string };

function isoLocalToInstant(s: string): string {
  return s ? new Date(s).toISOString() : "";
}
function instantToIsoLocal(iso: string): string {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}

export function AbsencesPanel({ mechanicId, mechanicName }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: [...queryKeys.absences, "byMechanic", mechanicId] as const,
    queryFn: () => absencesApi.listByMechanic(mechanicId)
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [...queryKeys.absences, "byMechanic", mechanicId] });
    qc.invalidateQueries({ queryKey: queryKeys.absences });
  };

  const createMut = useMutation({
    mutationFn: (body: AbsenceUpsert) => absencesApi.create(body),
    onSuccess: () => { invalidate(); resetDraft(); }
  });
  const updateMut = useMutation({
    mutationFn: (args: { id: UUID; body: AbsenceUpsert }) => absencesApi.update(args.id, args.body),
    onSuccess: () => { invalidate(); resetDraft(); }
  });
  const deleteMut = useMutation({
    mutationFn: (id: UUID) => absencesApi.delete(id),
    onSuccess: invalidate
  });

  const [editingId, setEditingId] = useState<UUID | null>(null);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [type, setType] = useState<AbsenceType>("VACATION");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function resetDraft() {
    setEditingId(null); setStart(""); setEnd(""); setType("VACATION"); setReason(""); setErr(null);
  }

  function loadForEdit(a: MechanicAbsence) {
    setEditingId(a.id);
    setStart(instantToIsoLocal(a.startAt));
    setEnd(instantToIsoLocal(a.endAt));
    setType(a.type);
    setReason(a.reason ?? "");
    setErr(null);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!start || !end) { setErr(t("errors.startEndRequired")); return; }
    const body: AbsenceUpsert = {
      mechanicId,
      startAt: isoLocalToInstant(start),
      endAt: isoLocalToInstant(end),
      type,
      reason: reason.trim() || null
    };
    if (new Date(body.endAt) <= new Date(body.startAt)) { setErr(t("errors.endAfterStart")); return; }
    const mut = editingId
      ? updateMut.mutate({ id: editingId, body })
      : createMut.mutate(body);
    void mut;
  }

  const rows = (q.data ?? []).slice().sort((a, b) => b.startAt.localeCompare(a.startAt));

  return (
    <section className="panel">
      <h2>{t("absences.panelTitle", { name: mechanicName })}</h2>
      <p className="muted">{t("absences.panelHelp")}</p>

      <table className="data-table absences-table">
        <thead>
          <tr>
            <th>{t("absences.columnType")}</th>
            <th>{t("absences.columnStart")}</th>
            <th>{t("absences.columnEnd")}</th>
            <th>{t("absences.columnReason")}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id} className={editingId === a.id ? "selected" : ""}>
              <td><span className={`badge absence-${a.type}`}>{t(`absenceType.${a.type}`)}</span></td>
              <td className="muted">{fmtDateTime(a.startAt)}</td>
              <td className="muted">{fmtDateTime(a.endAt)}</td>
              <td>{a.reason ?? t("common.dash")}</td>
              <td className="row-actions">
                <button onClick={() => loadForEdit(a)}>{t("common.edit")}</button>
                <button className="danger" onClick={() => confirm(t("common.deleteConfirm", { label: t(`absenceType.${a.type}`) })) && deleteMut.mutate(a.id)}>{t("common.delete")}</button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={5} className="muted">{t("absences.noneScheduled")}</td></tr>}
        </tbody>
      </table>

      <form className="absence-form" onSubmit={submit}>
        <h3>{editingId ? t("absences.edit") : t("absences.add")}</h3>
        <div className="form-row">
          <label>{t("absences.fieldType")}
            <select value={type} onChange={(e) => setType(e.target.value as AbsenceType)}>
              {ABSENCE_TYPES.map((tt) => <option key={tt} value={tt}>{t(`absenceType.${tt}`)}</option>)}
            </select>
          </label>
          <label>{t("absences.fieldReason")}
            <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={255} />
          </label>
        </div>
        <div className="form-row">
          <label>{t("absences.fieldStart")} *
            <input required type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label>{t("absences.fieldEnd")} *
            <input required type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
        </div>
        {err && <p className="error">{err}</p>}
        <div className="form-actions">
          <button type="submit" disabled={createMut.isPending || updateMut.isPending}>
            {editingId ? t("common.save") : t("common.create")}
          </button>
          {editingId && <button type="button" className="ghost" onClick={resetDraft}>{t("common.cancel")}</button>}
        </div>
      </form>
    </section>
  );
}
