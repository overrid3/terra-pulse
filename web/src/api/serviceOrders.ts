import { api } from "./client";
import { ServiceOrder, UUID } from "../types";

export const serviceOrdersApi = {
  list:     ()                                       => api.get<ServiceOrder[]>("/service-orders"),
  listByVehicle: (vehicleId: UUID)                   => api.get<ServiceOrder[]>(`/service-orders?vehicleId=${vehicleId}`),
  get:      (id: UUID)                               => api.get<ServiceOrder>(`/service-orders/${id}`),
  quote:    (id: UUID)                               => api.post<ServiceOrder>(`/service-orders/${id}/quote`),
  approve:  (id: UUID)                               => api.post<ServiceOrder>(`/service-orders/${id}/approve`),
  dispatch: (id: UUID, mechanicId: UUID)             => api.post<ServiceOrder>(`/service-orders/${id}/dispatch`, { mechanicId }),
  reassign: (id: UUID, mechanicId: UUID)             => api.post<ServiceOrder>(`/service-orders/${id}/reassign`, { mechanicId }),
  start:    (id: UUID)                               => api.post<ServiceOrder>(`/service-orders/${id}/start`),
  complete: (id: UUID, actualMinutes: number)        => api.post<ServiceOrder>(`/service-orders/${id}/complete`, { actualMinutes }),
  cancel:   (id: UUID)                               => api.post<ServiceOrder>(`/service-orders/${id}/cancel`),
  override: (id: UUID, state: "CANCELLED" | "REQUESTED", reason: string) =>
    api.post<ServiceOrder>(`/service-orders/${id}/override-state`, { state, reason }),
  renameTitle: (id: UUID, title: string) =>
    api.patch<ServiceOrder>(`/service-orders/${id}/title`, { title }),
  create:   (body: { vehicleId: UUID; clientId: UUID; siteId: UUID; vmrsCode: string; title?: string; siteLocation?: { lat: number; lng: number }; notes?: string }) =>
    api.post<ServiceOrder>("/service-orders", body)
};
