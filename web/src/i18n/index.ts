import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import it from "./locales/it/common.json";
import en from "./locales/en/common.json";

export const SUPPORTED_LANGS = ["it", "en"] as const;
export type Lang = (typeof SUPPORTED_LANGS)[number];

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      it: { common: it },
      en: { common: en }
    },
    fallbackLng: "it",
    supportedLngs: SUPPORTED_LANGS,
    defaultNS: "common",
    ns: ["common"],
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "terrapulse.lang"
    }
  });

export default i18n;
