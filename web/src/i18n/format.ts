import type { Locale } from "date-fns";
import { it as itLocale } from "date-fns/locale/it";
import { enUS as enLocale } from "date-fns/locale/en-US";
import { useTranslation } from "react-i18next";
import i18n from "./index";

function localeFor(lang: string | undefined): Locale {
  return (lang ?? "it").startsWith("it") ? itLocale : enLocale;
}

export function dateLocale(): Locale {
  return localeFor(i18n.resolvedLanguage);
}

export function useDateLocale(): Locale {
  const { i18n: hookI18n } = useTranslation();
  return localeFor(hookI18n.resolvedLanguage);
}

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
