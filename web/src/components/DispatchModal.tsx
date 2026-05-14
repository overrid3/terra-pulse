import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { mechanicsApi } from "../api/mechanics";
import { serviceOrdersApi } from "../api/serviceOrders";
import { queryKeys } from "../api/client";
import { ServiceOrder } from "../types";

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
    mutationFn: (mechanicId: string) => serviceOrdersApi.dispatch(order.id, mechanicId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.serviceOrders });
      qc.invalidateQueries({ queryKey: queryKeys.mechanics });
      onClose();
    }
  });

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{t("dispatch.dispatchHeading", { title: order.title ?? order.vmrsCode })}</h3>
        <p className="muted">
          {t("dispatch.siteLabel")}: {order.siteLocation.lat.toFixed(4)}, {order.siteLocation.lng.toFixed(4)}
        </p>
        {isLoading && <p>{t("dispatch.loadingNearest")}</p>}
        <ul className="nearest-list">
          {nearest?.map((m, idx) => (
            <li key={m.id}>
              <div>
                <strong>{idx + 1}. {m.fullName}</strong>
                <div className="muted">{t(`mechanicStatus.${m.status}`)} · {m.skills.join(", ")}</div>
              </div>
              <button
                disabled={dispatchMut.isPending || m.status === "OFF_DUTY"}
                onClick={() => dispatchMut.mutate(m.id)}
              >
                {t("dispatch.actionDispatch")}
              </button>
            </li>
          ))}
        </ul>
        <button className="ghost" onClick={onClose}>{t("common.cancel")}</button>
      </div>
    </div>
  );
}
