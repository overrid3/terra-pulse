import { ServiceOrder } from "../types";

type Props = {
  orders: ServiceOrder[];
  selectedOrderId: string | null;
  onSelect: (id: string) => void;
};

const PENDING_STATES = new Set(["REQUESTED", "QUOTED", "APPROVED"]);

export function PendingOrders({ orders, selectedOrderId, onSelect }: Props) {
  const pending = orders.filter((o) => PENDING_STATES.has(o.state));
  return (
    <div className="pending">
      <h3>Pending orders ({pending.length})</h3>
      <ul>
        {pending.length === 0 && <li className="muted">none</li>}
        {pending.map((o) => (
          <li
            key={o.id}
            className={o.id === selectedOrderId ? "selected" : ""}
            onClick={() => onSelect(o.id)}
          >
            <div className="po-state">{o.state}</div>
            <div className="po-code">{o.vmrsCode}</div>
            <div className="po-mins">{o.estimatedMinutes}m</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
