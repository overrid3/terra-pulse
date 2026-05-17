import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { connectDispatchSocket } from "@/ws/dispatchSocket";
import { queryKeys } from "@/api/client";

export function useDispatchSocket() {
  const qc = useQueryClient();
  useEffect(() => {
    const close = connectDispatchSocket((ev) => {
      if (ev.type.startsWith("SERVICE_ORDER")) {
        qc.invalidateQueries({ queryKey: queryKeys.serviceOrders });
      }
      if (ev.type.startsWith("MECHANIC")) {
        qc.invalidateQueries({ queryKey: queryKeys.mechanics });
      }
    });
    return close;
  }, [qc]);
}
