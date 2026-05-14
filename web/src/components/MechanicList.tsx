import { Mechanic, MechanicStatus } from "../types";

const STATUS_COLOR: Record<MechanicStatus, string> = {
  IDLE: "#3b82f6",
  EN_ROUTE: "#f59e0b",
  IN_PROGRESS: "#10b981",
  OFF_DUTY: "#6b7280"
};

type Props = {
  mechanics: Mechanic[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

export function MechanicList({ mechanics, selectedId, onSelect }: Props) {
  return (
    <aside className="panel mechanic-list">
      <h2>Mechanics ({mechanics.length})</h2>
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
                  <span>{m.status}</span>
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
