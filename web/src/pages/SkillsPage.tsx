import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { skillsApi } from "../api/skills";
import { queryKeys } from "../api/client";
import { Skill } from "../types";
import { fmtDateTime } from "../i18n/format";
import { SearchInput } from "../components/SearchInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export function SkillsPage() {
  const { t } = useTranslation();
  const qc = useQuery({ queryKey: queryKeys.skills, queryFn: skillsApi.list });
  const [editing, setEditing] = useState<Skill | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const client = useQueryClient();

  const q = search.trim().toLowerCase();
  const filtered = (qc.data ?? []).filter((s) => !q || s.name.toLowerCase().includes(q));

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
    <main className="flex-1 min-h-0 p-3.5 grid gap-3.5 grid-cols-[1.6fr_1fr]">
      <section className="bg-[var(--color-surface-panel)] border border-[var(--color-hairline)] rounded-[var(--radius-md)] p-3.5 overflow-auto min-h-0">
        <div className="flex items-center justify-between gap-3 mb-2.5 flex-wrap">
          <h2 className="m-0">{t("skills.pageTitle", { count: qc.data?.length ?? 0 })}</h2>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t("skills.searchPlaceholder")}
            className="w-full sm:w-64"
          />
        </div>
        <p className="text-[var(--color-text-muted)]">{t("skills.help")}</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("skills.columnName")}</TableHead>
              <TableHead>{t("skills.columnCreated")}</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((s) => {
              const isSelected = editing?.id === s.id;
              return (
                <TableRow
                  key={s.id}
                  className={cn(isSelected && "bg-[var(--color-brand-soft)]")}
                >
                  <TableCell>{s.name}</TableCell>
                  <TableCell className="text-[var(--color-text-muted)]">
                    {s.createdAt ? fmtDateTime(s.createdAt) : t("common.dash")}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 whitespace-nowrap justify-end">
                      <Button variant="outline" size="sm" onClick={() => loadForEdit(s)}>
                        {t("common.rename")}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => confirm(t("common.deleteConfirm", { label: s.name })) && deleteMut.mutate(s.id)}
                      >
                        {t("common.delete")}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-[var(--color-text-muted)]">
                  {t("skills.noSkills")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>

      <section className="bg-[var(--color-surface-panel)] border border-[var(--color-hairline)] rounded-[var(--radius-md)] p-3.5 overflow-auto min-h-0">
        <h2>{editing ? t("skills.renameSkill", { name: editing.name }) : t("skills.newSkill")}</h2>
        <form onSubmit={submit} className="flex flex-col gap-2.5">
          <div className="flex flex-col gap-1">
            <Label htmlFor="skill-name">{t("skills.fieldName")} *</Label>
            <Input
              id="skill-name"
              required
              maxLength={64}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("skills.namePlaceholder")}
            />
          </div>
          {error && <p className="text-[var(--color-danger)]">{error}</p>}
          <div className="flex gap-2 mt-1.5">
            <Button type="submit" variant="default" disabled={createMut.isPending || renameMut.isPending}>
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
    </main>
  );
}
