import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { absencesApi } from "../api/absences";
import { queryKeys } from "../api/client";
import { AbsenceUpsert, MechanicAbsence, UUID } from "../types";
import { fmtDateTime } from "../i18n/format";
import { AbsenceCalendarPicker, AbsenceDraft } from "./AbsenceCalendarPicker";

type Props = { mechanicId: UUID; mechanicName: string };

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

  const [editing, setEditing] = useState<MechanicAbsence | null>(null);
  const [adding, setAdding] = useState(false);

  function reset() {
    setEditing(null);
    setAdding(false);
  }

  const createMut = useMutation({
    mutationFn: (body: AbsenceUpsert) => absencesApi.create(body),
    onSuccess: () => { invalidate(); reset(); }
  });
  const updateMut = useMutation({
    mutationFn: (args: { id: UUID; body: AbsenceUpsert }) => absencesApi.update(args.id, args.body),
    onSuccess: () => { invalidate(); reset(); }
  });
  const deleteMut = useMutation({
    mutationFn: (id: UUID) => absencesApi.delete(id),
    onSuccess: invalidate
  });

  const rows = (q.data ?? []).slice().sort((a, b) => b.startAt.localeCompare(a.startAt));
  const pickerOpen = adding || editing !== null;

  function submitDraft(draft: AbsenceDraft) {
    const body: AbsenceUpsert = {
      mechanicId,
      startAt: draft.startAt,
      endAt: draft.endAt,
      type: draft.type,
      reason: draft.reason.trim() || null
    };
    if (editing) updateMut.mutate({ id: editing.id, body });
    else         createMut.mutate(body);
  }

  return (
    <section className="panel">
      <div className="filters">
        <h2>{t("absences.panelTitle", { name: mechanicName })}</h2>
        {!pickerOpen && (
          <button onClick={() => setAdding(true)}>{t("absences.add")}</button>
        )}
      </div>
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
            <tr key={a.id} className={editing?.id === a.id ? "selected" : ""}>
              <td><span className={`badge absence-${a.type}`}>{t(`absenceType.${a.type}`)}</span></td>
              <td className="muted">{fmtDateTime(a.startAt)}</td>
              <td className="muted">{fmtDateTime(a.endAt)}</td>
              <td>{a.reason ?? t("common.dash")}</td>
              <td className="row-actions">
                <button onClick={() => { setEditing(a); setAdding(false); }}>{t("common.edit")}</button>
                <button
                  className="danger"
                  onClick={() => confirm(t("common.deleteConfirm", { label: t(`absenceType.${a.type}`) })) && deleteMut.mutate(a.id)}
                >{t("common.delete")}</button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={5} className="muted">{t("absences.noneScheduled")}</td></tr>}
        </tbody>
      </table>

      {pickerOpen && (
        <AbsenceCalendarPicker
          mechanicId={mechanicId}
          existing={q.data ?? []}
          initialDraft={editing ? {
            startAt: editing.startAt,
            endAt: editing.endAt,
            type: editing.type,
            reason: editing.reason ?? ""
          } : null}
          editingId={editing?.id ?? null}
          submitting={createMut.isPending || updateMut.isPending}
          onSubmit={submitDraft}
          onCancel={reset}
        />
      )}
    </section>
  );
}
