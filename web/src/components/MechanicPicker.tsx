import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { mechanicsApi } from "../api/mechanics";
import { queryKeys } from "../api/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = {
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  id?: string;
};

export function MechanicPicker({ value, onChange, id }: Props) {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: queryKeys.mechanics, queryFn: mechanicsApi.list });
  const list = q.data ?? [];
  return (
    <Select value={value ?? ""} onValueChange={(v) => onChange(v || undefined)}>
      <SelectTrigger id={id}>
        <SelectValue placeholder={t("dispatch.selectMechanic")} />
      </SelectTrigger>
      <SelectContent>
        {list.map((m) => (
          <SelectItem key={m.id} value={m.id}>{m.fullName}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
