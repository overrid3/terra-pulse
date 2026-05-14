import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { mechanicsApi, MechanicUpsert } from "../api/mechanics";
import { skillsApi } from "../api/skills";
import { queryKeys } from "../api/client";
import { Mechanic, MechanicStatus } from "../types";
import { AddressLookup } from "../components/AddressLookup";
import { AbsencesPanel } from "../components/AbsencesPanel";

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

  return (
    <main className={`page-grid ${editing ? "three-row" : "two-col"}`}>
      <section className="panel">
        <h2>Mechanics ({qc.data?.length ?? 0})</h2>
        <table className="data-table">
          <thead>
            <tr><th>Name</th><th>Status</th><th>Skills</th><th>Location</th><th></th></tr>
          </thead>
          <tbody>
            {qc.data?.map((m) => (
              <tr key={m.id} className={editing?.id === m.id ? "selected" : ""}>
                <td>{m.fullName}<div className="muted">{m.phone ?? ""}</div></td>
                <td><span className={`badge status-${m.status}`}>{m.status}</span></td>
                <td>{m.skills.map((s) => <span key={s} className="chip">{s}</span>)}</td>
                <td className="mono">{m.location ? `${m.location.lat.toFixed(4)}, ${m.location.lng.toFixed(4)}` : "—"}</td>
                <td className="row-actions">
                  <button onClick={() => loadForEdit(m)}>Edit</button>
                  <button className="danger" onClick={() => confirm(`Delete ${m.fullName}?`) && deleteMut.mutate(m.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {qc.data?.length === 0 && <tr><td colSpan={5} className="muted">no mechanics yet</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="panel form-panel">
        <h2>{editing ? `Edit ${editing.fullName}` : "New mechanic"}</h2>
        <form onSubmit={submit}>
          <label>Full name *<input required value={draft.fullName} onChange={(e) => set("fullName", e.target.value)} /></label>
          <label>Phone<input value={draft.phone} onChange={(e) => set("phone", e.target.value)} /></label>
          <label>Status
            <select value={draft.status} onChange={(e) => set("status", e.target.value as MechanicStatus)}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <div>
            <label>Skills <span className="muted">(managed under <a href="/skills">/skills</a>)</span></label>
            {catalog.length === 0 ? (
              <p className="muted">no skills in catalog — add some on the Skills page first</p>
            ) : (
              <div className="checkbox-row">
                {catalog.map((s) => (
                  <label key={s} className="checkbox">
                    <input type="checkbox" checked={draft.skills.includes(s)} onChange={() => toggleSkill(s)} /> {s}
                  </label>
                ))}
              </div>
            )}
          </div>
          <label>Address lookup
            <AddressLookup
              onPick={(h) => setDraft((d) => ({ ...d, lat: String(h.lat), lng: String(h.lng) }))}
              placeholder="Search to auto-fill lat/lng"
            />
          </label>
          <div className="form-row">
            <label>Latitude<input type="number" step="any" value={draft.lat} onChange={(e) => set("lat", e.target.value)} /></label>
            <label>Longitude<input type="number" step="any" value={draft.lng} onChange={(e) => set("lng", e.target.value)} /></label>
          </div>
          {error && <p className="error">{error}</p>}
          <div className="form-actions">
            <button type="submit" disabled={createMut.isPending || patchMut.isPending}>
              {editing ? "Save" : "Create"}
            </button>
            {editing && <button type="button" className="ghost" onClick={reset}>Cancel</button>}
          </div>
        </form>
      </section>

      {editing && <AbsencesPanel mechanicId={editing.id} mechanicName={editing.fullName} />}
    </main>
  );
}
