import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clientsApi } from "../api/clients";
import { queryKeys } from "../api/client";
import { Client, ClientUpsert } from "../types";

const EMPTY: ClientUpsert = {
  name: "", email: "", phone: "", vatNumber: "",
  addressLine1: "", addressLine2: "", city: "", postalCode: "", country: ""
};

export function ClientsPage() {
  const qc = useQuery({ queryKey: queryKeys.clients, queryFn: clientsApi.list });
  const [editing, setEditing] = useState<Client | null>(null);
  const [draft, setDraft] = useState<ClientUpsert>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const client = useQueryClient();

  const invalidate = () => client.invalidateQueries({ queryKey: queryKeys.clients });

  const createMut = useMutation({
    mutationFn: (body: ClientUpsert) => clientsApi.create(body),
    onSuccess: () => { invalidate(); reset(); },
    onError: (e: Error) => setError(e.message)
  });
  const updateMut = useMutation({
    mutationFn: (args: { id: string; body: ClientUpsert }) => clientsApi.update(args.id, args.body),
    onSuccess: () => { invalidate(); reset(); },
    onError: (e: Error) => setError(e.message)
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => clientsApi.delete(id),
    onSuccess: invalidate,
    onError: (e: Error) => setError(e.message)
  });

  function reset() {
    setEditing(null);
    setDraft(EMPTY);
    setError(null);
  }

  function loadForEdit(c: Client) {
    setEditing(c);
    setDraft({
      name: c.name, email: c.email,
      phone: c.phone ?? "", vatNumber: c.vatNumber ?? "",
      addressLine1: c.addressLine1 ?? "", addressLine2: c.addressLine2 ?? "",
      city: c.city ?? "", postalCode: c.postalCode ?? "", country: c.country ?? ""
    });
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (editing) updateMut.mutate({ id: editing.id, body: draft });
    else         createMut.mutate(draft);
  }

  const set = <K extends keyof ClientUpsert>(k: K, v: ClientUpsert[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  return (
    <main className="page-grid two-col">
      <section className="panel">
        <h2>Clients ({qc.data?.length ?? 0})</h2>
        <table className="data-table">
          <thead>
            <tr><th>Name</th><th>Email</th><th>VAT</th><th>City</th><th></th></tr>
          </thead>
          <tbody>
            {qc.data?.map((c) => (
              <tr key={c.id} className={editing?.id === c.id ? "selected" : ""}>
                <td>{c.name}</td>
                <td className="mono">{c.email}</td>
                <td className="mono">{c.vatNumber ?? "—"}</td>
                <td>{c.city ?? "—"}</td>
                <td className="row-actions">
                  <button onClick={() => loadForEdit(c)}>Edit</button>
                  <button className="danger" onClick={() => confirm(`Delete ${c.name}?`) && deleteMut.mutate(c.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {qc.data?.length === 0 && <tr><td colSpan={5} className="muted">no clients yet</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="panel form-panel">
        <h2>{editing ? `Edit ${editing.name}` : "New client"}</h2>
        <form onSubmit={submit}>
          <label>Name *<input required value={draft.name}        onChange={(e) => set("name",  e.target.value)} /></label>
          <label>Email *<input required type="email" value={draft.email} onChange={(e) => set("email", e.target.value)} /></label>
          <label>Phone<input value={draft.phone ?? ""}            onChange={(e) => set("phone", e.target.value)} /></label>
          <label>VAT number<input value={draft.vatNumber ?? ""}   onChange={(e) => set("vatNumber", e.target.value)} /></label>
          <label>Address line 1<input value={draft.addressLine1 ?? ""} onChange={(e) => set("addressLine1", e.target.value)} /></label>
          <label>Address line 2<input value={draft.addressLine2 ?? ""} onChange={(e) => set("addressLine2", e.target.value)} /></label>
          <div className="form-row">
            <label>City<input value={draft.city ?? ""} onChange={(e) => set("city", e.target.value)} /></label>
            <label>Postal code<input value={draft.postalCode ?? ""} onChange={(e) => set("postalCode", e.target.value)} /></label>
          </div>
          <label>Country<input value={draft.country ?? ""} onChange={(e) => set("country", e.target.value)} /></label>
          {error && <p className="error">{error}</p>}
          <div className="form-actions">
            <button type="submit" disabled={createMut.isPending || updateMut.isPending}>
              {editing ? "Save" : "Create"}
            </button>
            {editing && <button type="button" className="ghost" onClick={reset}>Cancel</button>}
          </div>
        </form>
      </section>
    </main>
  );
}
