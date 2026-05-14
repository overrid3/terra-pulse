import { useTranslation } from "react-i18next";
import { ServiceOrder } from "../types";

type Props = {
  orders: ServiceOrder[];
  selectedOrderId: string | null;
  onSelect: (id: string) => void;
};

const PENDING_STATES = new Set(["REQUESTED", "QUOTED", "APPROVED"]);

export function PendingOrders({ orders, selectedOrderId, onSelect }: Props) {
  const { t } = useTranslation();
  const pending = orders.filter((o) => PENDING_STATES.has(o.state));
  return (
    <div className="pending">
      <h3>{t("dispatch.pendingTitle", { count: pending.length })}</h3>
      <ul>
        {pending.length === 0 && <li className="muted">{t("dispatch.pendingNone")}</li>}
        {pending.map((o) => (
          <li
            key={o.id}
            className={o.id === selectedOrderId ? "selected" : ""}
            onClick={() => onSelect(o.id)}
          >
            <div className="po-state">{t(`state.${o.state}`)}</div>
            <div className="po-code">{o.title ?? o.vmrsCode}</div>
            <div className="po-mins">{t("common.minutesShort", { count: o.estimatedMinutes })}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
