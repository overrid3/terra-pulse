import { useTranslation } from "react-i18next";
import { ServiceOrder } from "../types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
    <div className="bg-[var(--color-surface-panel)] border border-[var(--color-hairline)] rounded-[var(--radius-md)] px-3 py-2">
      <h3>{t("dispatch.pendingTitle", { count: pending.length })}</h3>
      <ul className="list-none p-0 m-0">
        {pending.length === 0 && (
          <li className="text-[var(--color-text-muted)] text-[var(--text-xs)] py-1">
            {t("dispatch.pendingNone")}
          </li>
        )}
        {pending.map((o) => (
          <li
            key={o.id}
            className={cn(
              "flex items-center gap-2 p-1.5 rounded-[var(--radius-sm)] cursor-pointer transition-colors hover:bg-[var(--color-surface-sunken)]",
              o.id === selectedOrderId && "bg-[var(--color-brand-soft)]"
            )}
            onClick={() => onSelect(o.id)}
          >
            <Badge className={"state-" + o.state} variant="secondary">
              {t(`state.${o.state}`)}
            </Badge>
            <div className="flex-1 min-w-0 truncate">{o.title ?? o.vmrsCode}</div>
            <div className="text-[var(--text-xs)] text-[var(--color-text-muted)]">
              {t("common.minutesShort", { count: o.estimatedMinutes })}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
