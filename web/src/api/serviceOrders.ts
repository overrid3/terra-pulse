import { api } from "./client";
import { ServiceOrder, UUID } from "../types";

export type CreateOrderBody = {
  vehicleId: UUID;
  clientId?: UUID;
  siteId: UUID;
  vmrsCode: string;
  title?: string;
  notes?: string;
  estimation?: string;          // free-text, parsed server-side
  mechanicId?: UUID;
  scheduledStartAt?: string;    // ISO
  scheduledEndAt?: string;      // ISO
};

export type SchedulePatchBody = {
  mechanicId?: UUID;
  scheduledStartAt?: string;
  scheduledEndAt?: string;
};

export type ServiceOrderPatchBody = {
  title?: string;
  vehicleId?: UUID;
  clientId?: UUID;
  siteId?: UUID;
  vmrsCode?: string;
  notes?: string;
  scheduledStartAt?: string | null;
  scheduledEndAt?: string | null;
  estimatedMinutes?: number;
};

export const serviceOrdersApi = {
  list:          ()                             => api.get<ServiceOrder[]>("/service-orders"),
  listByVehicle: (vehicleId: UUID)              => api.get<ServiceOrder[]>(`/service-orders?vehicleId=${vehicleId}`),
  get:           (id: UUID)                     => api.get<ServiceOrder>(`/service-orders/${id}`),
  create:        (body: CreateOrderBody)        => api.post<ServiceOrder>("/service-orders", body),
  quote:         (id: UUID)                     => api.post<ServiceOrder>(`/service-orders/${id}/quote`),
  approve:       (id: UUID)                     => api.post<ServiceOrder>(`/service-orders/${id}/approve`),
  schedule:      (id: UUID, body: { mechanicId: UUID; scheduledStartAt: string; scheduledEndAt: string }) =>
                                                   api.post<ServiceOrder>(`/service-orders/${id}/schedule`, body),
  reschedule:    (id: UUID, body: SchedulePatchBody) =>
                                                   api.patch<ServiceOrder>(`/service-orders/${id}/schedule`, body),
  start:         (id: UUID)                     => api.post<ServiceOrder>(`/service-orders/${id}/start`),
  complete:      (id: UUID, actualMinutes: number) =>
                                                   api.post<ServiceOrder>(`/service-orders/${id}/complete`, { actualMinutes }),
  cancel:        (id: UUID)                     => api.post<ServiceOrder>(`/service-orders/${id}/cancel`),
  unassign:      (id: UUID)                     => api.post<ServiceOrder>(`/service-orders/${id}/unassign`),
  delete:        (id: UUID)                     => api.delete<void>(`/service-orders/${id}`),
  override:      (id: UUID, body: {
                   state: "REQUESTED" | "QUOTED" | "APPROVED" | "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
                   reason: string;
                   mechanicId?: UUID;
                   actualMinutes?: number;
                   scheduledStartAt?: string;
                   scheduledEndAt?: string;
                 }) => api.post<ServiceOrder>(`/service-orders/${id}/override-state`, body),
  renameTitle:   (id: UUID, title: string)      => api.patch<ServiceOrder>(`/service-orders/${id}/title`, { title }),
  patch:         (id: UUID, body: ServiceOrderPatchBody) => api.patch<ServiceOrder>(`/service-orders/${id}`, body),
  parseEstimation: (input: string)              => api.post<{ minutes: number }>("/estimation/parse", { input }),
};
