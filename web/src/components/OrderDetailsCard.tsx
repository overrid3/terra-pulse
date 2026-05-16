import { ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { Pencil } from "lucide-react";
import { ServiceOrder } from "../types";
import { fmtDateTime } from "../i18n/format";
import { formatDuration } from "../lib/duration";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  order: ServiceOrder;
  onRename?: (title: string) => void;
  renaming?: boolean;
  showNotes?: boolean;
  actions?: ReactNode;
  overrideSlot?: ReactNode;
};

export function OrderDetailsCard({
  order,
  onRename,
  renaming,
  showNotes = false,
  actions,
  overrideSlot,
}: Props) {
  const { t } = useTranslation();
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [titleErr, setTitleErr] = useState<string | null>(null);
  const editingTitle = titleDraft !== null;

  function commitTitle() {
    if (!onRename || titleDraft === null) return;
    const trimmed = titleDraft.trim();
    if (!trimmed) {
      setTitleErr(t("errors.titleRequired"));
      return;
    }
    if (trimmed.length > 120) {
      setTitleErr(t("errors.titleTooLong"));
      return;
    }
    setTitleErr(null);
    onRename(trimmed);
    setTitleDraft(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-1.5 m-0">
        <dt className="text-[var(--color-text-muted)]">{t("orders.columnTitle")}</dt>
        <dd className="m-0">
          {onRename ? (
            editingTitle ? (
              <span className="flex items-center gap-2 flex-wrap">
                <Input
                  value={titleDraft ?? ""}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  maxLength={120}
                  autoFocus
                  className="flex-1 min-w-[140px]"
                />
                <Button
                  variant="default"
                  size="sm"
                  onClick={commitTitle}
                  disabled={renaming}
                >
                  {t("orders.actionTitleSave")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setTitleDraft(null);
                    setTitleErr(null);
                  }}
                >
                  {t("common.cancel")}
                </Button>
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <span>{order.title ?? t("common.dash")}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setTitleDraft(order.title ?? "")}
                  aria-label={t("orders.actionTitleEdit")}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </span>
            )
          ) : (
            <span>{order.title ?? t("common.dash")}</span>
          )}
          {titleErr && (
            <p className="text-[var(--text-sm)] text-[var(--color-danger)] m-0">
              {titleErr}
            </p>
          )}
        </dd>

        <dt className="text-[var(--color-text-muted)]">{t("orders.columnState")}</dt>
        <dd className="m-0">
          <Badge className={"state-" + order.state} variant="secondary">
            {t(`state.${order.state}`)}
          </Badge>
        </dd>

        <dt className="text-[var(--color-text-muted)]">{t("orders.columnVmrs")}</dt>
        <dd className="m-0 font-mono">{order.vmrsCode}</dd>

        <dt className="text-[var(--color-text-muted)]">{t("orders.fieldClient")}</dt>
        <dd className="m-0">{order.clientName ?? t("common.dash")}</dd>

        <dt className="text-[var(--color-text-muted)]">{t("orders.fieldSite")}</dt>
        <dd className="m-0">
          {order.siteName ? <span>{order.siteName} · </span> : null}
          <span className="font-mono text-[var(--color-text-muted)]">
            {order.siteLocation.lat.toFixed(4)}, {order.siteLocation.lng.toFixed(4)}
          </span>
        </dd>

        <dt className="text-[var(--color-text-muted)]">{t("orders.fieldEstimated")}</dt>
        <dd className="m-0">{formatDuration(order.estimatedMinutes)} ({order.estimatedMinutes} min)</dd>

        {order.scheduledStartAt && order.scheduledEndAt && (
          <>
            <dt className="text-[var(--color-text-muted)]">Scheduled</dt>
            <dd className="m-0">
              {format(new Date(order.scheduledStartAt), "PP HH:mm")} → {format(new Date(order.scheduledEndAt), "PP HH:mm")}
            </dd>
          </>
        )}

        {order.actualMinutes != null && (
          <>
            <dt className="text-[var(--color-text-muted)]">{t("orders.fieldActual")}</dt>
            <dd className="m-0">{t("common.minutes", { count: order.actualMinutes })}</dd>
          </>
        )}

        <dt className="text-[var(--color-text-muted)]">{t("orders.fieldMechanic")}</dt>
        <dd className="m-0 font-mono text-[var(--color-text-muted)]">
          {order.mechanicId
            ? order.mechanicId.slice(0, 8) + "…"
            : t("common.dash")}
        </dd>

        <dt className="text-[var(--color-text-muted)]">{t("orders.fieldRequested")}</dt>
        <dd className="m-0 text-[var(--color-text-muted)]">
          {fmtDateTime(order.requestedAt)}
        </dd>

        {order.dispatchedAt && (
          <>
            <dt className="text-[var(--color-text-muted)]">{t("orders.fieldDispatched")}</dt>
            <dd className="m-0 text-[var(--color-text-muted)]">
              {fmtDateTime(order.dispatchedAt)}
            </dd>
          </>
        )}
        {order.startedAt && (
          <>
            <dt className="text-[var(--color-text-muted)]">{t("orders.fieldStarted")}</dt>
            <dd className="m-0 text-[var(--color-text-muted)]">
              {fmtDateTime(order.startedAt)}
            </dd>
          </>
        )}
        {order.completedAt && (
          <>
            <dt className="text-[var(--color-text-muted)]">{t("orders.fieldCompleted")}</dt>
            <dd className="m-0 text-[var(--color-text-muted)]">
              {fmtDateTime(order.completedAt)}
            </dd>
          </>
        )}

        {showNotes && order.notes && (
          <>
            <dt className="text-[var(--color-text-muted)]">{t("orders.fieldNotesHistory")}</dt>
            <dd className="m-0">
              <pre className="font-mono text-[var(--text-xs)] bg-[var(--color-surface-sunken)] border border-[var(--color-hairline)] p-2 rounded-[var(--radius-sm)] whitespace-pre-wrap m-0 text-[var(--color-text)]">
                {order.notes}
              </pre>
            </dd>
          </>
        )}
      </dl>

      {actions && <div className="flex flex-col gap-1.5">{actions}</div>}
      {overrideSlot}
    </div>
  );
}
