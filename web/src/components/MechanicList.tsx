import { useTranslation } from "react-i18next";
import { Mechanic } from "../types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Props = {
  mechanics: Mechanic[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

export function MechanicList({ mechanics, selectedId, onSelect }: Props) {
  const { t } = useTranslation();
  return (
    <aside className="bg-[var(--color-surface-panel)] border border-[var(--color-hairline)] rounded-[var(--radius-md)] p-3.5 overflow-auto min-h-0">
      <h2>{t("dispatch.mechanicsTitle", { count: mechanics.length })}</h2>
      <ul className="list-none p-0 m-0">
        {mechanics.map((m) => {
          const isSel = m.id === selectedId;
          return (
            <li
              key={m.id}
              className={cn(
                "flex gap-2.5 p-2 rounded-[var(--radius-sm)] cursor-pointer transition-colors hover:bg-[var(--color-surface-sunken)]",
                isSel && "bg-[var(--color-brand-soft)]"
              )}
              onClick={() => onSelect(isSel ? null : m.id)}
            >
              <span className={cn("status-dot", "dot-" + m.status)} aria-hidden="true" />
              <div className="m-info">
                <div className="font-medium">{m.fullName}</div>
                <div className="flex gap-2 text-[var(--text-xs)] text-[var(--color-text-muted)]">
                  <span>{t(`mechanicStatus.${m.status}`)}</span>
                  {m.location && (
                    <span className="muted">
                      {m.location.lat.toFixed(3)}, {m.location.lng.toFixed(3)}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex gap-1 flex-wrap">
                  {m.skills.map((s) => (
                    <Badge key={s} variant="secondary" className="text-[var(--text-xs)]">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
