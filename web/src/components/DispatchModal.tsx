import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { mechanicsApi } from "../api/mechanics";
import { serviceOrdersApi } from "../api/serviceOrders";
import { queryKeys } from "../api/client";
import { ServiceOrder } from "../types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Props = {
  order: ServiceOrder;
  onClose: () => void;
};

export function DispatchModal({ order, onClose }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: nearest, isLoading } = useQuery({
    queryKey: ["nearest", order.id],
    queryFn: () =>
      mechanicsApi.nearest(order.siteLocation.lat, order.siteLocation.lng, 5)
  });

  const dispatchMut = useMutation({
    mutationFn: (mechanicId: string) => {
      const start = new Date();
      const end = new Date(start.getTime() + order.estimatedMinutes * 60_000);
      return serviceOrdersApi.schedule(order.id, {
        mechanicId,
        scheduledStartAt: start.toISOString(),
        scheduledEndAt: end.toISOString(),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.serviceOrders });
      qc.invalidateQueries({ queryKey: queryKeys.mechanics });
      onClose();
    }
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>
            {t("dispatch.dispatchHeading", { title: order.title ?? order.vmrsCode })}
          </DialogTitle>
          <DialogDescription>
            {t("dispatch.siteLabel")}: {order.siteLocation.lat.toFixed(4)},{" "}
            {order.siteLocation.lng.toFixed(4)}
          </DialogDescription>
        </DialogHeader>
        {isLoading && <p>{t("dispatch.loadingNearest")}</p>}
        <ul className="list-none p-0 my-3">
          {nearest?.map((m, idx) => (
            <li
              key={m.id}
              className="flex justify-between items-center p-2.5 border border-[var(--color-hairline)] rounded-[var(--radius-sm)] mb-1.5 hover:bg-[var(--color-surface-sunken)] transition-colors"
            >
              <div>
                <strong>
                  {idx + 1}. {m.fullName}
                </strong>
                <div className="text-[var(--text-xs)] text-[var(--color-text-muted)]">
                  {t(`mechanicStatus.${m.status}`)} · {m.skills.join(", ")}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={dispatchMut.isPending || m.status === "OFF_DUTY"}
                onClick={() => dispatchMut.mutate(m.id)}
              >
                {t("dispatch.actionDispatch")}
              </Button>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
