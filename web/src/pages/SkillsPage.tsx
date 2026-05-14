import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { skillsApi } from "../api/skills";
import { queryKeys } from "../api/client";
import { Skill } from "../types";
import { fmtDateTime } from "../i18n/format";

export function SkillsPage() {
  const { t } = useTranslation();
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
        <h2>{t("skills.pageTitle", { count: qc.data?.length ?? 0 })}</h2>
        <p className="muted">{t("skills.help")}</p>
        <table className="data-table">
          <thead><tr><th>{t("skills.columnName")}</th><th>{t("skills.columnCreated")}</th><th></th></tr></thead>
          <tbody>
            {qc.data?.map((s) => (
              <tr key={s.id} className={editing?.id === s.id ? "selected" : ""}>
                <td>{s.name}</td>
                <td className="muted">{s.createdAt ? fmtDateTime(s.createdAt) : t("common.dash")}</td>
                <td className="row-actions">
                  <button onClick={() => loadForEdit(s)}>{t("common.rename")}</button>
                  <button className="danger" onClick={() => confirm(t("common.deleteConfirm", { label: s.name })) && deleteMut.mutate(s.id)}>{t("common.delete")}</button>
                </td>
              </tr>
            ))}
            {qc.data?.length === 0 && <tr><td colSpan={3} className="muted">{t("skills.noSkills")}</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="panel form-panel">
        <h2>{editing ? t("skills.renameSkill", { name: editing.name }) : t("skills.newSkill")}</h2>
        <form onSubmit={submit}>
          <label>{t("skills.fieldName")} *
            <input required maxLength={64} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("skills.namePlaceholder")} />
          </label>
          {error && <p className="error">{error}</p>}
          <div className="form-actions">
            <button type="submit" disabled={createMut.isPending || renameMut.isPending}>
              {editing ? t("common.save") : t("common.create")}
            </button>
            {editing && <button type="button" className="ghost" onClick={reset}>{t("common.cancel")}</button>}
          </div>
        </form>
      </section>
    </main>
  );
}
