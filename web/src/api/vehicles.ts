import { api } from "./client";
import { UUID, Vehicle, VehicleUpsert } from "../types";

export const vehiclesApi = {
  list:   ()                            => api.get<Vehicle[]>("/vehicles"),
  get:    (id: UUID)                    => api.get<Vehicle>(`/vehicles/${id}`),
  create: (body: VehicleUpsert)         => api.post<Vehicle>("/vehicles", body),
  update: (id: UUID, body: VehicleUpsert) => api.put<Vehicle>(`/vehicles/${id}`, body),
  delete: (id: UUID)                    => api.delete<void>(`/vehicles/${id}`)
};
