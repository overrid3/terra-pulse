import { useTranslation } from "react-i18next";
import { Mechanic, MechanicStatus } from "../types";

const STATUS_COLOR: Record<MechanicStatus, string> = {
  IDLE: "var(--color-state-info-fg, #3b82f6)",
  EN_ROUTE: "var(--color-state-warn-fg, #f59e0b)",
  IN_PROGRESS: "var(--color-state-success-fg, #10b981)",
  OFF_DUTY: "var(--color-state-neutral-fg, #6b7280)"
};

type Props = {
  mechanics: Mechanic[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

export function MechanicList({ mechanics, selectedId, onSelect }: Props) {
  const { t } = useTranslation();
  return (
    <aside className="panel mechanic-list">
      <h2>{t("dispatch.mechanicsTitle", { count: mechanics.length })}</h2>
      <ul>
        {mechanics.map((m) => {
          const isSel = m.id === selectedId;
          return (
            <li
              key={m.id}
              className={isSel ? "selected" : ""}
              onClick={() => onSelect(isSel ? null : m.id)}
            >
              <span className="dot" style={{ background: STATUS_COLOR[m.status] }} />
              <div className="m-info">
                <div className="m-name">{m.fullName}</div>
                <div className="m-meta">
                  <span>{t(`mechanicStatus.${m.status}`)}</span>
                  {m.location && (
                    <span className="muted">
                      {m.location.lat.toFixed(3)}, {m.location.lng.toFixed(3)}
                    </span>
                  )}
                </div>
                <div className="m-skills">
                  {m.skills.map((s) => (
                    <span key={s} className="chip">{s}</span>
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
