import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGS, Lang } from "../i18n";

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const current = (SUPPORTED_LANGS as readonly string[]).includes(i18n.resolvedLanguage ?? "")
    ? (i18n.resolvedLanguage as Lang)
    : "it";

  return (
    <label className="lang-switcher" aria-label={t("nav.language")}>
      <select
        value={current}
        onChange={(e) => void i18n.changeLanguage(e.target.value)}
      >
        {SUPPORTED_LANGS.map((lng) => (
          <option key={lng} value={lng}>{lng.toUpperCase()}</option>
        ))}
      </select>
    </label>
  );
}
