import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { MechanicAbsence } from "../../../types";

type Props = {
  absence: MechanicAbsence;
  leftPct: number;
  rightPct: number;
};

export function GanttAbsenceBand({ absence: a, leftPct, rightPct }: Props) {
  const { t } = useTranslation();
  return (
    <div
      role="img"
      aria-label={`${t(`absenceType.${a.type}`)}${a.reason ? `: ${a.reason}` : ""}`}
      className={cn(
        "absolute top-1 bottom-1 rounded-[var(--radius-sm)] border border-dashed flex items-center px-2 text-xs pointer-events-none",
        `absence-${a.type}`,
      )}
      style={{ left: `${leftPct}%`, right: `${rightPct}%`, opacity: 0.7 }}
      title={`${t(`absenceType.${a.type}`)}${a.reason ? ` · ${a.reason}` : ""}`}
    >
      <span className="truncate font-mono uppercase tracking-wider">
        {t(`absenceType.${a.type}`)}
      </span>
    </div>
  );
}
