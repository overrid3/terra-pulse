import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { ChevronDown, ChevronRight, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { Mechanic, ServiceOrder, Vehicle, UUID } from "../types";

type Props = {
  mechanics: Mechanic[];
  orders: ServiceOrder[];
  vehicles: Map<string, Vehicle>;
  onSelectOrder: (id: UUID) => void;
};

const PENDING_STATES = new Set(["REQUESTED", "QUOTED", "APPROVED"]);

function OrderRow({
  order,
  vehicles,
  onSelect,
}: {
  order: ServiceOrder;
  vehicles: Map<string, Vehicle>;
  onSelect: () => void;
}) {
  const vehicle = order.vehicleId ? vehicles.get(order.vehicleId) : undefined;
  const timeLabel = order.scheduledStartAt
    ? format(new Date(order.scheduledStartAt), "dd/MM HH:mm")
    : order.startedAt
    ? format(new Date(order.startedAt), "dd/MM HH:mm")
    : null;

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className="w-full text-left px-3 py-2.5 border-b border-[var(--color-hairline)] flex items-center gap-3 hover:bg-[var(--color-surface-container)] active:bg-[var(--color-surface-container-high)] transition-colors"
      >
        <span className={cn("px-1.5 py-0.5 rounded-[var(--radius-sm)] text-xs font-medium shrink-0", `state-${order.state}`)}>
          {order.state}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-[var(--color-text)] truncate">
            {order.title ?? order.vmrsDescription ?? order.vmrsCode}
          </div>
          <div className="text-xs text-[var(--color-text-subtle)] truncate">
            {vehicle ? `${vehicle.make} ${vehicle.model}` : order.vehicleId}
            {order.clientName ? ` · ${order.clientName}` : null}
          </div>
        </div>
        {timeLabel && (
          <span className="text-xs font-mono text-[var(--color-text-muted)] shrink-0">
            {timeLabel}
          </span>
        )}
      </button>
    </li>
  );
}

function MechanicSection({
  mechanic,
  orders,
  vehicles,
  onSelectOrder,
}: {
  mechanic: Mechanic;
  orders: ServiceOrder[];
  vehicles: Map<string, Vehicle>;
  onSelectOrder: (id: UUID) => void;
}) {
  const [open, setOpen] = useState(true);
  if (orders.length === 0) return null;

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-[var(--color-surface-sunken)] border-b border-[var(--color-hairline)] text-left"
      >
        {open ? (
          <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)]" />
        ) : (
          <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)]" />
        )}
        <span className="text-sm font-semibold text-[var(--color-text)]">
          {mechanic.fullName}
        </span>
        <span className="ml-auto text-xs font-mono bg-[var(--color-surface-container-highest)] px-1.5 py-0.5 rounded-[var(--radius-sm)]">
          {orders.length}
        </span>
      </button>
      {open && (
        <ul className="list-none m-0 p-0">
          {orders.map((o) => (
            <OrderRow
              key={o.id}
              order={o}
              vehicles={vehicles}
              onSelect={() => onSelectOrder(o.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

export function DispatchOrderList({ mechanics, orders, vehicles, onSelectOrder }: Props) {
  const { t } = useTranslation();

  const unassigned = useMemo(
    () => orders.filter((o) => o.mechanicId === null && PENDING_STATES.has(o.state)),
    [orders]
  );

  const byMechanic = useMemo(() => {
    const map = new Map<string, ServiceOrder[]>();
    for (const o of orders) {
      if (!o.mechanicId) continue;
      if (!map.has(o.mechanicId)) map.set(o.mechanicId, []);
      map.get(o.mechanicId)!.push(o);
    }
    return map;
  }, [orders]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      {/* Unassigned pool */}
      {unassigned.length > 0 && (
        <section>
          <div className="flex items-center gap-2 px-3 py-2 bg-[var(--color-surface-sunken)] border-b border-[var(--color-hairline)]">
            <Inbox className="w-4 h-4 text-[var(--color-text-muted)]" />
            <span className="text-sm font-semibold text-[var(--color-text)]">
              {t("dispatch.unassignedPool")}
            </span>
            <span className="ml-auto text-xs font-mono bg-[var(--color-surface-container-highest)] px-1.5 py-0.5 rounded-[var(--radius-sm)]">
              {unassigned.length}
            </span>
          </div>
          <ul className="list-none m-0 p-0">
            {unassigned.map((o) => (
              <OrderRow
                key={o.id}
                order={o}
                vehicles={vehicles}
                onSelect={() => onSelectOrder(o.id)}
              />
            ))}
          </ul>
        </section>
      )}

      {/* Per-mechanic sections */}
      {mechanics.map((m) => (
        <MechanicSection
          key={m.id}
          mechanic={m}
          orders={byMechanic.get(m.id) ?? []}
          vehicles={vehicles}
          onSelectOrder={onSelectOrder}
        />
      ))}

      {unassigned.length === 0 && mechanics.every((m) => (byMechanic.get(m.id) ?? []).length === 0) && (
        <p className="text-center text-[var(--color-text-muted)] text-sm py-10">
          {t("dispatch.pendingNone")}
        </p>
      )}
    </div>
  );
}
