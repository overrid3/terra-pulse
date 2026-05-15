import { useTranslation } from "react-i18next";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  return (
    <Select value={i18n.language} onValueChange={(v) => i18n.changeLanguage(v)}>
      <SelectTrigger className="h-7 px-2 text-[var(--text-xs)] w-auto gap-1">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="en">EN</SelectItem>
        <SelectItem value="it">IT</SelectItem>
      </SelectContent>
    </Select>
  );
}
