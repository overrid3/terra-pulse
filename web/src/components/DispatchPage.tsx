import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { mechanicsApi } from "../api/mechanics";
import { serviceOrdersApi } from "../api/serviceOrders";
import { absencesApi } from "../api/absences";
import { queryKeys } from "../api/client";
import { MechanicList } from "./MechanicList";
import { ResourceTimeline } from "./ResourceTimeline";
import { PendingOrders } from "./PendingOrders";
import { ServiceOrderDrawer } from "./ServiceOrderDrawer";

export function DispatchPage() {
  const [selectedMechanicId, setSelectedMechanicId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const mechanicsQ = useQuery({ queryKey: queryKeys.mechanics,     queryFn: mechanicsApi.list });
  const ordersQ    = useQuery({ queryKey: queryKeys.serviceOrders, queryFn: serviceOrdersApi.list });

  // Fetch absences overlapping the current ±3-day window (board is day/week view).
  const windowRange = useMemo(() => {
    const now = new Date();
    const from = new Date(now.getTime() - 3 * 86400_000).toISOString();
    const to   = new Date(now.getTime() + 14 * 86400_000).toISOString();
    return { from, to };
  }, []);
  const absencesQ = useQuery({
    queryKey: [...queryKeys.absences, "range", windowRange.from, windowRange.to] as const,
    queryFn: () => absencesApi.listInRange(windowRange.from, windowRange.to)
  });

  const selectedOrder = useMemo(
    () => ordersQ.data?.find((o) => o.id === selectedOrderId) ?? null,
    [ordersQ.data, selectedOrderId]
  );

  return (
    <main className="dispatch">
      <MechanicList
        mechanics={mechanicsQ.data ?? []}
        selectedId={selectedMechanicId}
        onSelect={setSelectedMechanicId}
      />
      <section className="center">
        <PendingOrders
          orders={ordersQ.data ?? []}
          selectedOrderId={selectedOrderId}
          onSelect={setSelectedOrderId}
        />
        <ResourceTimeline
          mechanics={mechanicsQ.data ?? []}
          orders={ordersQ.data ?? []}
          absences={absencesQ.data ?? []}
          selectedMechanicId={selectedMechanicId}
          onSelectOrder={setSelectedOrderId}
        />
      </section>
      {selectedOrder && (
        <ServiceOrderDrawer order={selectedOrder} onClose={() => setSelectedOrderId(null)} />
      )}
    </main>
  );
}
