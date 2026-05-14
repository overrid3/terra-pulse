import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  dateFnsLocalizer,
  Event as RBCEvent,
  SlotInfo
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
import { useTranslation } from "react-i18next";
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

export type AbsenceDraft = {
  startAt: string;
  endAt: string;
  type: AbsenceType;
  reason: string;
};

type Props = {
  mechanicId: UUID;
  existing: MechanicAbsence[];
  initialDraft?: Partial<AbsenceDraft> | null;
  editingId?: UUID | null;
  submitting?: boolean;
  onSubmit: (draft: AbsenceDraft) => void;
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
  existing,
  initialDraft,
  editingId,
  submitting,
  onSubmit,
  onCancel
}: Props) {
  const { t } = useTranslation();
  const [showCalendar, setShowCalendar] = useState(false);
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
          title: `${t(`absenceType.${a.type}`)}${a.reason ? ` · ${a.reason}` : ""}`,
          start: new Date(a.startAt),
          end: new Date(a.endAt),
          absenceId: a.id,
          absenceType: a.type,
          editing: editingId != null && a.id === editingId
        })),
    [existing, mechanicId, editingId, t]
  );

  function handleSelectSlot(slot: SlotInfo) {
    const s = slot.start as Date;
    const e = slot.end as Date;
    const allDay =
      slot.slots && slot.slots.length > 0 &&
      s.getHours() === 0 && s.getMinutes() === 0 &&
      e.getHours() === 0 && e.getMinutes() === 0 &&
      differenceInCalendarDays(e, s) >= 1;

    const startDate = allDay ? startOfDay(s) : s;
    const endDate = allDay ? endOfDay(new Date(e.getTime() - 1)) : e;

    setStart(instantToIsoLocal(startDate.toISOString()));
    setEnd(instantToIsoLocal(endDate.toISOString()));
    setErr(null);
    softWarn(startDate);
  }

  function softWarn(d: Date) {
    const now = new Date();
    const daysAgo = differenceInCalendarDays(now, d);
    if (daysAgo > 30) setWarn(t("absences.softWarnPast"));
    else              setWarn(null);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!start || !end) {
      setErr(t("errors.startEndRequired"));
      return;
    }
    const startIso = isoLocalToInstant(start);
    const endIso = isoLocalToInstant(end);
    if (new Date(endIso) <= new Date(startIso)) {
      setErr(t("errors.endAfterStart"));
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

  const days =
    start && end && !invalidRange
      ? Math.max(
          1,
          differenceInCalendarDays(
            new Date(isoLocalToInstant(end)),
            new Date(isoLocalToInstant(start))
          ) + 1
        )
      : null;

  return (
    <form className="absence-picker" onSubmit={submit}>
      <header className="absence-picker-head">
        <h3 className="picker-heading">
          {editingId ? t("absences.edit") : t("absences.add")}
        </h3>
        {days != null && (
          <span className="absence-picker-summary muted">
            {t("absences.daysSummary", {
              count: days,
              defaultValue: "{{count}} day(s)"
            })}
          </span>
        )}
      </header>

      <div className="absence-picker-grid">
        <label>
          {t("absences.fieldStart")} *
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
        <label>
          {t("absences.fieldEnd")} *
          <input
            required
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
        <label>
          {t("absences.fieldType")}
          <select value={type} onChange={(e) => setType(e.target.value as AbsenceType)}>
            {ABSENCE_TYPES.map((tt) => (
              <option key={tt} value={tt}>{t(`absenceType.${tt}`)}</option>
            ))}
          </select>
        </label>
        <label>
          {t("absences.fieldReason")}
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={255}
          />
        </label>
      </div>

      <button
        type="button"
        className="ghost absence-picker-toggle"
        aria-expanded={showCalendar}
        onClick={() => setShowCalendar((v) => !v)}
      >
        {showCalendar
          ? t("absences.hideCalendar", { defaultValue: "Hide calendar" })
          : t("absences.pickVisually", { defaultValue: "Pick on calendar" })}
      </button>

      {showCalendar && (
        <div className="absence-picker-cal">
          <p className="muted" style={{ margin: "0 0 6px" }}>
            {t("absences.calendarHint")}
          </p>
          <Calendar
            localizer={localizer}
            events={events}
            view="week"
            views={["week"]}
            onView={() => { /* locked to week */ }}
            defaultDate={new Date()}
            selectable
            onSelectSlot={handleSelectSlot}
            longPressThreshold={50}
            step={60}
            timeslots={1}
            min={new Date(new Date().setHours(6, 0, 0, 0))}
            max={new Date(new Date().setHours(20, 0, 0, 0))}
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
      )}

      {err && <p className="error">{err}</p>}
      {!err && warn && <p className="muted">{warn}</p>}

      <div className="form-actions">
        <button
          type="submit"
          disabled={Boolean(submitting) || invalidRange || !start || !end}
        >
          {t("common.save")}
        </button>
        <button type="button" className="ghost" onClick={onCancel}>
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}
