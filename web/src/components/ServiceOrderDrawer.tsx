import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ServiceOrder } from "../types";
import { serviceOrdersApi } from "../api/serviceOrders";
import { queryKeys } from "../api/client";
import { DispatchModal } from "./DispatchModal";

type Props = {
  order: ServiceOrder;
  onClose: () => void;
};

export function ServiceOrderDrawer({ order, onClose }: Props) {
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
        <h2>Order</h2>
        <button className="ghost" onClick={onClose}>×</button>
      </div>
      <dl>
        <dt>State</dt><dd><span className={`badge state-${order.state}`}>{order.state}</span></dd>
        <dt>VMRS</dt><dd>{order.vmrsCode}</dd>
        <dt>Estimated</dt><dd>{order.estimatedMinutes} min</dd>
        {order.actualMinutes != null && (<><dt>Actual</dt><dd>{order.actualMinutes} min</dd></>)}
        <dt>Site</dt><dd>{order.siteLocation.lat.toFixed(4)}, {order.siteLocation.lng.toFixed(4)}</dd>
        {order.mechanicId && (<><dt>Mechanic</dt><dd className="muted">{order.mechanicId.slice(0, 8)}…</dd></>)}
        {order.dispatchedAt && (<><dt>Dispatched</dt><dd className="muted">{new Date(order.dispatchedAt).toLocaleTimeString()}</dd></>)}
        {order.startedAt && (<><dt>Started</dt><dd className="muted">{new Date(order.startedAt).toLocaleTimeString()}</dd></>)}
      </dl>
      <div className="actions">
        {canQuote &&    <button onClick={() => quote.mutate()}    disabled={quote.isPending}>Quote</button>}
        {canApprove &&  <button onClick={() => approve.mutate()}  disabled={approve.isPending}>Approve</button>}
        {canDispatch && <button onClick={() => setShowDispatch(true)}>Dispatch…</button>}
        {canStart &&    <button onClick={() => start.mutate()}    disabled={start.isPending}>Start</button>}
        {canComplete && (
          <span className="complete-row">
            <input
              type="number" min={1} value={actualMin}
              onChange={(e) => setActualMin(Number(e.target.value))}
              style={{ width: 80 }}
            />
            <button onClick={() => complete.mutate(actualMin)} disabled={complete.isPending}>Complete</button>
          </span>
        )}
        {canCancel && <button className="danger" onClick={() => cancel.mutate()} disabled={cancel.isPending}>Cancel</button>}
      </div>
      {showDispatch && (
        <DispatchModal order={order} onClose={() => setShowDispatch(false)} />
      )}
    </aside>
  );
}
