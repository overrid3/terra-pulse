import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { skillsApi } from "../api/skills";
import { queryKeys } from "../api/client";
import { Skill } from "../types";

export function SkillsPage() {
  const qc = useQuery({ queryKey: queryKeys.skills, queryFn: skillsApi.list });
  const [editing, setEditing] = useState<Skill | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const client = useQueryClient();

  const invalidate = () => {
    client.invalidateQueries({ queryKey: queryKeys.skills });
    client.invalidateQueries({ queryKey: queryKeys.mechanics });
  };

  const createMut = useMutation({
    mutationFn: (n: string) => skillsApi.create(n),
    onSuccess: () => { invalidate(); reset(); },
    onError: (e: Error) => setError(e.message)
  });
  const renameMut = useMutation({
    mutationFn: (args: { id: string; name: string }) => skillsApi.rename(args.id, args.name),
    onSuccess: () => { invalidate(); reset(); },
    onError: (e: Error) => setError(e.message)
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => skillsApi.delete(id),
    onSuccess: invalidate,
    onError: (e: Error) => setError(e.message)
  });

  function reset() { setEditing(null); setName(""); setError(null); }

  function loadForEdit(s: Skill) { setEditing(s); setName(s.name); setError(null); }

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) return;
    if (editing) renameMut.mutate({ id: editing.id, name: trimmed });
    else         createMut.mutate(trimmed);
  }

  return (
    <main className="page-grid two-col">
      <section className="panel">
        <h2>Skills ({qc.data?.length ?? 0})</h2>
        <p className="muted">
          Skills are referenced by mechanics. Deleting a skill removes it from every mechanic that has it.
        </p>
        <table className="data-table">
          <thead><tr><th>Name</th><th>Created</th><th></th></tr></thead>
          <tbody>
            {qc.data?.map((s) => (
              <tr key={s.id} className={editing?.id === s.id ? "selected" : ""}>
                <td>{s.name}</td>
                <td className="muted">{s.createdAt ? new Date(s.createdAt).toLocaleString() : "—"}</td>
                <td className="row-actions">
                  <button onClick={() => loadForEdit(s)}>Rename</button>
                  <button className="danger" onClick={() => confirm(`Delete skill "${s.name}"?`) && deleteMut.mutate(s.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {qc.data?.length === 0 && <tr><td colSpan={3} className="muted">no skills yet</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="panel form-panel">
        <h2>{editing ? `Rename ${editing.name}` : "New skill"}</h2>
        <form onSubmit={submit}>
          <label>Name *
            <input required maxLength={64} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. HYDRAULICS" />
          </label>
          {error && <p className="error">{error}</p>}
          <div className="form-actions">
            <button type="submit" disabled={createMut.isPending || renameMut.isPending}>
              {editing ? "Save" : "Create"}
            </button>
            {editing && <button type="button" className="ghost" onClick={reset}>Cancel</button>}
          </div>
        </form>
      </section>
    </main>
  );
}
