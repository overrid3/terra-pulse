import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ServiceOrder } from "../types";
import { serviceOrdersApi } from "../api/serviceOrders";
import { queryKeys } from "../api/client";
import { DispatchModal } from "./DispatchModal";
import { fmtTime } from "../i18n/format";

type Props = {
  order: ServiceOrder;
  onClose: () => void;
};

export function ServiceOrderDrawer({ order, onClose }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [showDispatch, setShowDispatch] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: queryKeys.serviceOrders });
    qc.invalidateQueries({ queryKey: queryKeys.mechanics });
  };

  const quote    = useMutation({ mutationFn: () => serviceOrdersApi.quote(order.id),    onSuccess: invalidate });
  const approve  = useMutation({ mutationFn: () => serviceOrdersApi.approve(order.id),  onSuccess: invalidate });
  const start    = useMutation({ mutationFn: () => serviceOrdersApi.start(order.id),    onSuccess: invalidate });
  const complete = useMutation({
    mutationFn: (mins: number) => serviceOrdersApi.complete(order.id, mins),
    onSuccess: invalidate
  });
  const cancel   = useMutation({ mutationFn: () => serviceOrdersApi.cancel(order.id),   onSuccess: invalidate });

  const canQuote    = order.state === "REQUESTED";
  const canApprove  = order.state === "QUOTED";
  const canDispatch = order.state === "APPROVED";
  const canStart    = order.state === "DISPATCHED";
  const canComplete = order.state === "IN_PROGRESS";
  const canCancel   = !["COMPLETED", "CANCELLED"].includes(order.state);

  const [actualMin, setActualMin] = useState<number>(order.estimatedMinutes);

  return (
    <aside className="panel drawer">
      <div className="drawer-header">
        <h2>{order.title ?? t("dispatch.orderHeading")}</h2>
        <button className="ghost" onClick={onClose} aria-label={t("common.close")}>×</button>
      </div>
      <dl>
        <dt>{t("orders.columnState")}</dt><dd><span className={`badge state-${order.state}`}>{t(`state.${order.state}`)}</span></dd>
        <dt>{t("orders.columnVmrs")}</dt><dd className="mono">{order.vmrsCode}</dd>
        <dt>{t("orders.fieldEstimated")}</dt><dd>{t("common.minutes", { count: order.estimatedMinutes })}</dd>
        {order.actualMinutes != null && (<><dt>{t("orders.fieldActual")}</dt><dd>{t("common.minutes", { count: order.actualMinutes })}</dd></>)}
        <dt>{t("orders.fieldSite")}</dt><dd className="mono">{order.siteLocation.lat.toFixed(4)}, {order.siteLocation.lng.toFixed(4)}</dd>
        {order.mechanicId && (<><dt>{t("orders.fieldMechanic")}</dt><dd className="muted mono">{order.mechanicId.slice(0, 8)}…</dd></>)}
        {order.dispatchedAt && (<><dt>{t("orders.fieldDispatched")}</dt><dd className="muted">{fmtTime(order.dispatchedAt)}</dd></>)}
        {order.startedAt && (<><dt>{t("orders.fieldStarted")}</dt><dd className="muted">{fmtTime(order.startedAt)}</dd></>)}
      </dl>
      <div className="actions">
        {canQuote &&    <button onClick={() => quote.mutate()}    disabled={quote.isPending}>{t("dispatch.actionQuote")}</button>}
        {canApprove &&  <button onClick={() => approve.mutate()}  disabled={approve.isPending}>{t("dispatch.actionApprove")}</button>}
        {canDispatch && <button onClick={() => setShowDispatch(true)}>{t("dispatch.actionDispatchEllipsis")}</button>}
        {canStart &&    <button onClick={() => start.mutate()}    disabled={start.isPending}>{t("dispatch.actionStart")}</button>}
        {canComplete && (
          <span className="complete-row">
            <input
              type="number" min={1} value={actualMin}
              onChange={(e) => setActualMin(Number(e.target.value))}
              style={{ width: 80 }}
              aria-label={t("orders.fieldActual")}
            />
            <button onClick={() => complete.mutate(actualMin)} disabled={complete.isPending}>{t("dispatch.actionComplete")}</button>
          </span>
        )}
        {canCancel && <button className="danger" onClick={() => cancel.mutate()} disabled={cancel.isPending}>{t("common.cancel")}</button>}
      </div>
      {showDispatch && (
        <DispatchModal order={order} onClose={() => setShowDispatch(false)} />
      )}
    </aside>
  );
}
