import { useTranslation } from "react-i18next";
import { Mechanic } from "../types";

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
              <span className={`dot status-${m.status}`} aria-hidden="true" />
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
