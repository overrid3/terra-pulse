import { Calendar, dateFnsLocalizer, Event as RBCEvent } from "react-big-calendar";
import { format, parse, startOfWeek, getDay, addMinutes, startOfDay } from "date-fns";
import { Mechanic, MechanicAbsence, ServiceOrder } from "../types";

const locales = { "en-US": undefined };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales: locales as any
});

type Props = {
  mechanics: Mechanic[];
  orders: ServiceOrder[];
  absences: MechanicAbsence[];
  selectedMechanicId: string | null;
  onSelectOrder: (id: string) => void;
};

type Resource = { resourceId: string; resourceTitle: string };
type EventKind = "order" | "absence";

type CalEvent = RBCEvent & {
  resourceId: string;
  kind: EventKind;
  soId?: string;
  orderState?: string;
  absenceType?: string;
};

export function ResourceTimeline({
  mechanics, orders, absences, selectedMechanicId, onSelectOrder
}: Props) {
  const visible = selectedMechanicId
    ? mechanics.filter((m) => m.id === selectedMechanicId)
    : mechanics;

  const resources: Resource[] = visible.map((m) => ({
    resourceId: m.id,
    resourceTitle: m.fullName
  }));

  const orderEvents: CalEvent[] = orders
    .filter(
      (o) =>
        o.mechanicId &&
        (o.state === "DISPATCHED" || o.state === "IN_PROGRESS" || o.state === "COMPLETED")
    )
    .map((o) => {
      const start = new Date(o.startedAt ?? o.dispatchedAt ?? o.requestedAt);
      const minutes = o.actualMinutes ?? o.estimatedMinutes;
      const end = addMinutes(start, minutes);
      return {
        title: `${o.vmrsCode} · ${minutes}m`,
        start,
        end,
        resourceId: o.mechanicId!,
        kind: "order" as const,
        soId: o.id,
        orderState: o.state
      };
    });

  const absenceEvents: CalEvent[] = absences.map((a) => ({
    title: `${a.type}${a.reason ? ` · ${a.reason}` : ""}`,
    start: new Date(a.startAt),
    end: new Date(a.endAt),
    resourceId: a.mechanicId,
    kind: "absence",
    absenceType: a.type
  }));

  const events: CalEvent[] = [...absenceEvents, ...orderEvents];

  return (
    <div className="panel timeline">
      <Calendar
        localizer={localizer}
        events={events}
        resources={resources}
        resourceIdAccessor={(r: any) => (r as Resource).resourceId}
        resourceTitleAccessor={(r: any) => (r as Resource).resourceTitle}
        defaultView="day"
        views={["day", "week"]}
        step={30}
        timeslots={2}
        defaultDate={startOfDay(new Date())}
        onSelectEvent={(ev: any) => {
          if ((ev as CalEvent).kind === "order" && (ev as CalEvent).soId) {
            onSelectOrder((ev as CalEvent).soId!);
          }
        }}
        style={{ height: "100%" }}
        eventPropGetter={(ev: any) => {
          const e = ev as CalEvent;
          if (e.kind === "absence") {
            const absenceColors: Record<string, string> = {
              VACATION: "#94a3b8",
              SICK: "#fca5a5",
              TRAINING: "#fcd34d",
              OTHER: "#cbd5e1"
            };
            return {
              style: {
                backgroundColor: absenceColors[e.absenceType ?? "OTHER"],
                opacity: 0.55,
                border: "none",
                color: "#1e293b",
                fontStyle: "italic"
              }
            };
          }
          const stateColors: Record<string, string> = {
            DISPATCHED: "#2563eb",
            IN_PROGRESS: "#10b981",
            COMPLETED: "#6b7280"
          };
          return {
            style: {
              backgroundColor: stateColors[e.orderState ?? ""] ?? "#475569",
              border: "none"
            }
          };
        }}
      />
    </div>
  );
}
