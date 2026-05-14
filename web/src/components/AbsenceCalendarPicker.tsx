import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  dateFnsLocalizer,
  Event as RBCEvent,
  SlotInfo,
  View
} from "react-big-calendar";
import {
  format,
  parse,
  startOfWeek,
  getDay,
  endOfDay,
  startOfDay,
  differenceInCalendarDays
} from "date-fns";
import {
  AbsenceType,
  ABSENCE_TYPES,
  MechanicAbsence,
  UUID
} from "../types";

const locales = { "en-US": undefined };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales: locales as any
});

type Draft = {
  startAt: string;
  endAt: string;
  type: AbsenceType;
  reason: string;
};

type Props = {
  mechanicId: UUID;
  mechanicName: string;
  existing: MechanicAbsence[];
  initialDraft?: Partial<Draft> | null;
  editingId?: UUID | null;
  submitting?: boolean;
  onSubmit: (draft: Draft) => void;
  onCancel: () => void;
};

type CalEvent = RBCEvent & {
  absenceId?: UUID;
  absenceType?: AbsenceType;
  editing?: boolean;
};

function instantToIsoLocal(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}

function isoLocalToInstant(s: string): string {
  return s ? new Date(s).toISOString() : "";
}

export function AbsenceCalendarPicker({
  mechanicId,
  mechanicName,
  existing,
  initialDraft,
  editingId,
  submitting,
  onSubmit,
  onCancel
}: Props) {
  const [view, setView] = useState<View>("month");
  const [start, setStart] = useState<string>(instantToIsoLocal(initialDraft?.startAt ?? ""));
  const [end, setEnd] = useState<string>(instantToIsoLocal(initialDraft?.endAt ?? ""));
  const [type, setType] = useState<AbsenceType>(initialDraft?.type ?? "VACATION");
  const [reason, setReason] = useState<string>(initialDraft?.reason ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);

  useEffect(() => {
    setStart(instantToIsoLocal(initialDraft?.startAt ?? ""));
    setEnd(instantToIsoLocal(initialDraft?.endAt ?? ""));
    setType(initialDraft?.type ?? "VACATION");
    setReason(initialDraft?.reason ?? "");
    setErr(null);
    setWarn(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId, initialDraft?.startAt, initialDraft?.endAt, initialDraft?.type, initialDraft?.reason]);

  const events: CalEvent[] = useMemo(
    () =>
      existing
        .filter((a) => a.mechanicId === mechanicId)
        .map((a) => ({
          title: `${a.type}${a.reason ? ` · ${a.reason}` : ""}`,
          start: new Date(a.startAt),
          end: new Date(a.endAt),
          absenceId: a.id,
          absenceType: a.type,
          editing: editingId != null && a.id === editingId
        })),
    [existing, mechanicId, editingId]
  );

  function handleSelectSlot(slot: SlotInfo) {
    const s = slot.start as Date;
    const e = slot.end as Date;
    // react-big-calendar month-view slots are all-day; the end is exclusive (next day at 00:00).
    // Snap to 00:00 local start and 23:59:59 local end of the last selected day for all-day picks.
    const allDay =
      slot.slots && slot.slots.length > 0 &&
      s.getHours() === 0 && s.getMinutes() === 0 &&
      e.getHours() === 0 && e.getMinutes() === 0 &&
      differenceInCalendarDays(e, s) >= 1;

    const startDate = allDay ? startOfDay(s) : s;
    const endDate = allDay
      ? endOfDay(new Date(e.getTime() - 1)) // last day in the range
      : e;

    setStart(instantToIsoLocal(startDate.toISOString()));
    setEnd(instantToIsoLocal(endDate.toISOString()));
    setErr(null);
    softWarn(startDate);
  }

  function softWarn(d: Date) {
    const now = new Date();
    const daysAgo = differenceInCalendarDays(now, d);
    if (daysAgo > 30) {
      setWarn("start is more than 30 days in the past");
    } else {
      setWarn(null);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!start || !end) {
      setErr("start and end required");
      return;
    }
    const startIso = isoLocalToInstant(start);
    const endIso = isoLocalToInstant(end);
    if (new Date(endIso) <= new Date(startIso)) {
      setErr("end must be after start");
      return;
    }
    onSubmit({
      startAt: startIso,
      endAt: endIso,
      type,
      reason: reason.trim()
    });
  }

  const invalidRange = Boolean(
    start && end && new Date(isoLocalToInstant(end)) <= new Date(isoLocalToInstant(start))
  );

  return (
    <section className="panel">
      <style>{`
        .ds-cal-event-editing {
          outline: 1.5px solid #1d4ed8;
          outline-offset: -1px;
        }
        @media (prefers-reduced-motion: reduce) {
          .ds-cal-event-editing { transition: none !important; animation: none !important; }
        }
        .ds-cal-wrap { height: 420px; }
        .ds-cal-toolbar {
          display: flex; gap: 6px; align-items: center;
          margin-bottom: 8px;
        }
        .ds-cal-toolbar .spacer { flex: 1; }
      `}</style>

      <h2>{editingId ? "Edit absence" : "Add absence"} · {mechanicName}</h2>
      <p className="muted">
        Click and drag on the calendar to pick a range. Use the time inputs below for precision.
      </p>

      <div className="ds-cal-toolbar">
        <button
          type="button"
          className={view === "month" ? "" : "ghost"}
          onClick={() => setView("month")}
        >
          Month
        </button>
        <button
          type="button"
          className={view === "week" ? "" : "ghost"}
          onClick={() => setView("week")}
        >
          Week
        </button>
        <span className="spacer" />
        {start && end && !invalidRange && (
          <span className="muted">
            {new Date(isoLocalToInstant(start)).toLocaleString()} to {new Date(isoLocalToInstant(end)).toLocaleString()}
          </span>
        )}
      </div>

      <div className="ds-cal-wrap">
        <Calendar
          localizer={localizer}
          events={events}
          view={view}
          onView={(v) => setView(v)}
          views={["month", "week"]}
          defaultDate={new Date()}
          selectable
          onSelectSlot={handleSelectSlot}
          longPressThreshold={50}
          style={{ height: "100%" }}
          eventPropGetter={(ev: any) => {
            const e = ev as CalEvent;
            const cls = [
              "rbc-event",
              e.absenceType ? `absence-${e.absenceType}` : "",
              e.editing ? "ds-cal-event-editing" : ""
            ]
              .filter(Boolean)
              .join(" ");
            return { className: cls };
          }}
        />
      </div>

      <form className="absence-form form-panel" onSubmit={submit}>
        <div className="form-row">
          <label>Type
            <select value={type} onChange={(e) => setType(e.target.value as AbsenceType)}>
              {ABSENCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label>Reason
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={255}
            />
          </label>
        </div>
        <div className="form-row">
          <label>Start *
            <input
              required
              type="datetime-local"
              value={start}
              onChange={(e) => {
                setStart(e.target.value);
                if (e.target.value) softWarn(new Date(isoLocalToInstant(e.target.value)));
              }}
            />
          </label>
          <label>End *
            <input
              required
              type="datetime-local"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
        </div>
        {err && <p className="error">{err}</p>}
        {!err && warn && <p className="muted">{warn}</p>}
        <div className="form-actions">
          <button
            type="submit"
            disabled={Boolean(submitting) || invalidRange || !start || !end}
          >
            Save
          </button>
          <button type="button" className="ghost" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
