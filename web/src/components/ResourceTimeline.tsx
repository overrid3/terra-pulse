import { useMemo } from "react";
import { Calendar, dateFnsLocalizer, Event as RBCEvent, View } from "react-big-calendar";
import withDragAndDrop, {
  EventInteractionArgs,
  DragFromOutsideItemArgs
} from "react-big-calendar/lib/addons/dragAndDrop";
import { format, parse, startOfWeek, getDay, addMinutes, startOfDay } from "date-fns";
import { useTranslation } from "react-i18next";
import { Mechanic, MechanicAbsence, ServiceOrder } from "../types";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";

const locales = { "en-US": undefined };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales: locales as any
});

type Resource = { resourceId: string; resourceTitle: string };
type EventKind = "order" | "absence";

export type CalEvent = RBCEvent & {
  resourceId: string;
  kind: EventKind;
  soId?: string;
  orderState?: string;
  absenceType?: string;
};

const DnDCalendar = withDragAndDrop<CalEvent, Resource>(Calendar as any);

type Props = {
  mechanics: Mechanic[];
  orders: ServiceOrder[];
  absences: MechanicAbsence[];
  selectedMechanicId: string | null;
  view: View;
  onView: (v: View) => void;
  date: Date;
  onNavigate: (d: Date) => void;
  onSelectOrder: (id: string) => void;
  onEventMoved: (args: EventInteractionArgs<CalEvent>) => void;
  onDropFromOutside: (args: DragFromOutsideItemArgs) => void;
  dragFromOutsideItem: (() => CalEvent) | undefined;
};

export function ResourceTimeline({
  mechanics, orders, absences, selectedMechanicId,
  view, onView, date, onNavigate,
  onSelectOrder, onEventMoved, onDropFromOutside, dragFromOutsideItem
}: Props) {
  const { t } = useTranslation();

  const visible = selectedMechanicId
    ? mechanics.filter((m) => m.id === selectedMechanicId)
    : mechanics;

  // Resources only meaningful in day view (RBC limitation).
  const useResources = view === "day";

  const resources: Resource[] | undefined = useResources
    ? visible.map((m) => ({ resourceId: m.id, resourceTitle: m.fullName }))
    : undefined;

  const orderEvents: CalEvent[] = useMemo(() => orders
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
    }), [orders]);

  const absenceEvents: CalEvent[] = useMemo(() => absences.map((a) => ({
    title: `${t(`absenceType.${a.type}`)}${a.reason ? ` · ${a.reason}` : ""}`,
    start: new Date(a.startAt),
    end: new Date(a.endAt),
    resourceId: a.mechanicId,
    kind: "absence",
    absenceType: a.type
  })), [absences, t]);

  const events: CalEvent[] = [...absenceEvents, ...orderEvents];

  return (
    <div className="flex-1 min-h-[400px] p-1 bg-[var(--color-surface-panel)] border border-[var(--color-hairline)] rounded-[var(--radius-md)] min-w-0 overflow-hidden">
      <DnDCalendar
        localizer={localizer}
        events={events}
        resources={resources}
        resourceIdAccessor={(r: any) => (r as Resource).resourceId}
        resourceTitleAccessor={(r: any) => (r as Resource).resourceTitle}
        view={view}
        onView={onView}
        views={["day", "week", "month"]}
        step={30}
        timeslots={2}
        date={date}
        onNavigate={onNavigate}
        defaultDate={startOfDay(new Date())}
        draggableAccessor={(ev: any) => (ev as CalEvent).kind === "order"}
        resizable={false}
        onEventDrop={onEventMoved}
        onDropFromOutside={onDropFromOutside}
        dragFromOutsideItem={dragFromOutsideItem}
        onSelectEvent={(ev: any) => {
          if ((ev as CalEvent).kind === "order" && (ev as CalEvent).soId) {
            onSelectOrder((ev as CalEvent).soId!);
          }
        }}
        style={{ height: "100%" }}
        eventPropGetter={(ev: any) => {
          const e = ev as CalEvent;
          if (e.kind === "absence") {
            return { className: `rbc-event is-absence absence-${e.absenceType ?? "OTHER"}` };
          }
          return { className: `rbc-event state-${e.orderState ?? "DISPATCHED"}` };
        }}
      />
    </div>
  );
}
