import { useMemo } from "react";
import {
  GanttProvider,
  GanttSidebar,
  GanttSidebarGroup,
  GanttSidebarItem,
  GanttTimeline,
  GanttHeader,
  GanttFeatureList,
  GanttFeatureListGroup,
  GanttFeatureRow,
  GanttToday,
  type GanttFeature,
  type Range,
} from "@/components/kibo-ui/gantt";
import type { Mechanic, ServiceOrder, UUID } from "../types";

const SCHEDULED_STATES = new Set(["SCHEDULED", "IN_PROGRESS", "COMPLETED"]);

const STATE_COLOR: Record<ServiceOrder["state"], string> = {
  REQUESTED:   "#ef4444",
  QUOTED:      "#f59e0b",
  APPROVED:    "#3b82f6",
  SCHEDULED:   "#8b5cf6",
  IN_PROGRESS: "#10b981",
  COMPLETED:   "#6b7280",
  CANCELLED:   "#9ca3af",
};

type DispatchGanttView = "day" | "week" | "month";

type Props = {
  mechanics: Mechanic[];
  orders: ServiceOrder[];
  selectedMechanicId: string | null;
  view: DispatchGanttView;
  onSelectOrder: (id: string) => void;
  onMove: (orderId: UUID, mechanicId: UUID, startAt: Date, endAt: Date | null) => void;
};

function viewToRange(view: DispatchGanttView): Range {
  if (view === "month") return "monthly";
  return "daily";
}

export function DispatchGantt({
  mechanics,
  orders,
  selectedMechanicId,
  view,
  onSelectOrder,
  onMove,
}: Props) {
  const visibleMechanics = useMemo(
    () => (selectedMechanicId ? mechanics.filter((m) => m.id === selectedMechanicId) : mechanics),
    [mechanics, selectedMechanicId],
  );

  const features = useMemo<(GanttFeature & { mechanicId: UUID; orderState: ServiceOrder["state"] })[]>(
    () =>
      orders
        .filter((o) => o.mechanicId && o.scheduledStartAt && o.scheduledEndAt && SCHEDULED_STATES.has(o.state))
        .map((o) => ({
          id: o.id,
          name: o.title ?? o.vmrsDescription ?? o.vmrsCode,
          startAt: new Date(o.scheduledStartAt!),
          endAt:   new Date(o.scheduledEndAt!),
          status:  { id: o.state, name: o.state, color: STATE_COLOR[o.state] },
          lane:    o.mechanicId!,
          mechanicId: o.mechanicId!,
          orderState: o.state,
        })),
    [orders],
  );

  const featuresByMechanic = useMemo(() => {
    const map = new Map<string, GanttFeature[]>();
    for (const m of visibleMechanics) map.set(m.id, []);
    for (const f of features) {
      const bucket = map.get(f.mechanicId);
      if (bucket) bucket.push(f);
    }
    return map;
  }, [features, visibleMechanics]);

  const range = viewToRange(view);

  return (
    <GanttProvider range={range} zoom={100} className="h-full">
      <GanttSidebar>
        {visibleMechanics.map((m) => (
          <GanttSidebarGroup key={m.id} name={m.fullName}>
            {(featuresByMechanic.get(m.id) ?? []).map((f) => (
              <GanttSidebarItem
                key={f.id}
                feature={f}
                onSelectItem={onSelectOrder}
              />
            ))}
          </GanttSidebarGroup>
        ))}
      </GanttSidebar>
      <GanttTimeline>
        <GanttHeader />
        <GanttFeatureList>
          {visibleMechanics.map((m) => (
            <GanttFeatureListGroup key={m.id}>
              <GanttFeatureRow
                features={featuresByMechanic.get(m.id) ?? []}
                onMove={(id, startAt, endAt) => onMove(id as UUID, m.id, startAt, endAt)}
              >
                {(feature) => (
                  <button
                    type="button"
                    onClick={() => onSelectOrder(feature.id)}
                    className="flex-1 truncate text-left text-xs"
                  >
                    {feature.name}
                  </button>
                )}
              </GanttFeatureRow>
            </GanttFeatureListGroup>
          ))}
        </GanttFeatureList>
        <GanttToday />
      </GanttTimeline>
    </GanttProvider>
  );
}
