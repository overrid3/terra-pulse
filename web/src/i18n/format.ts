import i18n from "./index";

export function fmtDateTime(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat(i18n.resolvedLanguage ?? "it", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(d);
}

export function fmtTime(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat(i18n.resolvedLanguage ?? "it", {
    timeStyle: "short"
  }).format(d);
}
