import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ServiceOrder } from "../types";
import { serviceOrdersApi } from "../api/serviceOrders";
import { queryKeys } from "../api/client";
import { DispatchModal } from "./DispatchModal";
import { OrderDetailsCard } from "./OrderDetailsCard";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

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

  const [actualMin, setActualMin] = useState<number>(order.estimatedMinutes);

  const canQuote    = order.state === "REQUESTED";
  const canApprove  = order.state === "QUOTED";
  const canDispatch = order.state === "APPROVED";
  const canStart    = order.state === "DISPATCHED";
  const canComplete = order.state === "IN_PROGRESS";
  const canCancel   = !["COMPLETED", "CANCELLED"].includes(order.state);

  const actions = (
    <>
      {canQuote &&    <Button variant="outline" onClick={() => quote.mutate()}   disabled={quote.isPending}>{t("dispatch.actionQuote")}</Button>}
      {canApprove &&  <Button variant="outline" onClick={() => approve.mutate()} disabled={approve.isPending}>{t("dispatch.actionApprove")}</Button>}
      {canDispatch && <Button variant="default" onClick={() => setShowDispatch(true)}>{t("dispatch.actionDispatchEllipsis")}</Button>}
      {canStart &&    <Button variant="outline" onClick={() => start.mutate()}   disabled={start.isPending}>{t("dispatch.actionStart")}</Button>}
      {canComplete && (
        <span className="flex gap-1.5">
          <input
            type="number" min={1} value={actualMin}
            onChange={(e) => setActualMin(Number(e.target.value))}
            aria-label={t("orders.fieldActual")}
            className="w-20 px-2 py-1 bg-[var(--color-surface-panel)] border border-[var(--color-hairline)] rounded-[var(--radius-sm)] text-[var(--color-text)]"
          />
          <Button variant="outline" onClick={() => complete.mutate(actualMin)} disabled={complete.isPending}>
            {t("dispatch.actionComplete")}
          </Button>
        </span>
      )}
      {canCancel && <Button variant="destructive" onClick={() => cancel.mutate()}>{t("common.cancel")}</Button>}
    </>
  );

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-[360px] sm:max-w-[360px]" aria-describedby={undefined}>
        <SheetHeader>
          <SheetTitle>{order.title ?? t("dispatch.orderHeading")}</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-4 overflow-auto">
          <OrderDetailsCard order={order} actions={actions} />
        </div>
      </SheetContent>
      {showDispatch && (
        <DispatchModal order={order} onClose={() => setShowDispatch(false)} />
      )}
    </Sheet>
  );
}
