import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { absencesApi } from "../api/absences";
import { queryKeys } from "../api/client";
import { AbsenceUpsert, MechanicAbsence, UUID } from "../types";
import { fmtDateTime } from "../i18n/format";
import { AbsenceCalendarPicker, AbsenceDraft } from "./AbsenceCalendarPicker";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";

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
    <section
      className="bg-[var(--color-surface-panel)] border border-[var(--color-hairline)] rounded-[var(--radius-md)] p-3.5 overflow-auto min-h-0"
      style={{ gridArea: "absences" }}
    >
      <div className="flex items-center gap-3.5 mb-2.5 flex-wrap justify-between">
        <h2 className="text-[var(--text-base)] font-semibold m-0">
          {t("absences.panelTitle", { name: mechanicName })}
        </h2>
        {!pickerOpen && (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            {t("absences.add")}
          </Button>
        )}
      </div>
      <p className="text-[var(--text-sm)] text-[var(--color-text-subtle)] mb-2.5">
        {t("absences.panelHelp")}
      </p>

      <div className="mb-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("absences.columnType")}</TableHead>
              <TableHead>{t("absences.columnStart")}</TableHead>
              <TableHead>{t("absences.columnEnd")}</TableHead>
              <TableHead>{t("absences.columnReason")}</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((a) => (
              <TableRow
                key={a.id}
                data-state={editing?.id === a.id ? "selected" : undefined}
              >
                <TableCell>
                  <Badge variant="secondary" className={`absence-${a.type}`}>
                    {t(`absenceType.${a.type}`)}
                  </Badge>
                </TableCell>
                <TableCell className="text-[var(--color-text-subtle)]">
                  {fmtDateTime(a.startAt)}
                </TableCell>
                <TableCell className="text-[var(--color-text-subtle)]">
                  {fmtDateTime(a.endAt)}
                </TableCell>
                <TableCell>{a.reason ?? t("common.dash")}</TableCell>
                <TableCell>
                  <div className="flex gap-1 whitespace-nowrap justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setEditing(a); setAdding(false); }}
                    >
                      {t("common.edit")}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => confirm(t("common.deleteConfirm", { label: t(`absenceType.${a.type}`) })) && deleteMut.mutate(a.id)}
                    >
                      {t("common.delete")}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-[var(--color-text-subtle)]">
                  {t("absences.noneScheduled")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

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
