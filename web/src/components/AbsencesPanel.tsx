import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { absencesApi } from "../api/absences";
import { queryKeys } from "../api/client";
import {
  AbsenceType, ABSENCE_TYPES, AbsenceUpsert, MechanicAbsence, UUID
} from "../types";

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
    if (!start || !end) { setErr("start and end required"); return; }
    const body: AbsenceUpsert = {
      mechanicId,
      startAt: isoLocalToInstant(start),
      endAt: isoLocalToInstant(end),
      type,
      reason: reason.trim() || null
    };
    if (new Date(body.endAt) <= new Date(body.startAt)) { setErr("end must be after start"); return; }
    const mut = editingId
      ? updateMut.mutate({ id: editingId, body })
      : createMut.mutate(body);
    void mut;
  }

  const rows = (q.data ?? []).slice().sort((a, b) => b.startAt.localeCompare(a.startAt));

  return (
    <section className="panel">
      <h2>Absences · {mechanicName}</h2>
      <p className="muted">
        Planned OOO windows (vacation / sick / training). The dispatch board will dim the mechanic's
        lane during these periods.
      </p>

      <table className="data-table absences-table">
        <thead>
          <tr><th>Type</th><th>Start</th><th>End</th><th>Reason</th><th></th></tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id} className={editingId === a.id ? "selected" : ""}>
              <td><span className={`badge absence-${a.type}`}>{a.type}</span></td>
              <td className="muted">{new Date(a.startAt).toLocaleString()}</td>
              <td className="muted">{new Date(a.endAt).toLocaleString()}</td>
              <td>{a.reason ?? "—"}</td>
              <td className="row-actions">
                <button onClick={() => loadForEdit(a)}>Edit</button>
                <button className="danger" onClick={() => confirm("Delete this absence?") && deleteMut.mutate(a.id)}>Delete</button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={5} className="muted">no absences scheduled</td></tr>}
        </tbody>
      </table>

      <form className="absence-form" onSubmit={submit}>
        <h3>{editingId ? "Edit absence" : "Add absence"}</h3>
        <div className="form-row">
          <label>Type
            <select value={type} onChange={(e) => setType(e.target.value as AbsenceType)}>
              {ABSENCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label>Reason
            <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={255} />
          </label>
        </div>
        <div className="form-row">
          <label>Start *
            <input required type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label>End *
            <input required type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
        </div>
        {err && <p className="error">{err}</p>}
        <div className="form-actions">
          <button type="submit" disabled={createMut.isPending || updateMut.isPending}>
            {editingId ? "Save" : "Add"}
          </button>
          {editingId && <button type="button" className="ghost" onClick={resetDraft}>Cancel</button>}
        </div>
      </form>
    </section>
  );
}
