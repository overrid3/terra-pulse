import { Calendar, dateFnsLocalizer, Event as RBCEvent } from "react-big-calendar";
import { format, parse, startOfWeek, getDay, addMinutes, startOfDay } from "date-fns";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
        title: `${o.title ?? o.vmrsCode} · ${minutes}m`,
        start,
        end,
        resourceId: o.mechanicId!,
        kind: "order" as const,
        soId: o.id,
        orderState: o.state
      };
    });

  const absenceEvents: CalEvent[] = absences.map((a) => ({
    title: `${t(`absenceType.${a.type}`)}${a.reason ? ` · ${a.reason}` : ""}`,
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
            return {
              className: `rbc-event absence-${e.absenceType ?? "OTHER"}`,
              style: { opacity: 0.75, border: "none", fontStyle: "italic" }
            };
          }
          return {
            className: `rbc-event state-${e.orderState ?? "DISPATCHED"}`,
            style: { border: "none" }
          };
        }}
      />
    </div>
  );
}
