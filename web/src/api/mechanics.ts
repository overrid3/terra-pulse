import { api } from "./client";
import { Mechanic, MechanicStatus, UUID, LatLng } from "../types";

export type MechanicUpsert = {
  fullName: string;
  phone?: string | null;
  skills: string[];
  status: MechanicStatus;
  location?: LatLng | null;
};

export const mechanicsApi = {
  list:    ()                                                     => api.get<Mechanic[]>("/mechanics"),
  get:     (id: UUID)                                             => api.get<Mechanic>(`/mechanics/${id}`),
  create:  (body: MechanicUpsert)                                 => api.post<Mechanic>("/mechanics", body),
  patch:   (id: UUID, body: Partial<MechanicUpsert>)              => api.patch<Mechanic>(`/mechanics/${id}`, body),
  delete:  (id: UUID)                                             => api.delete<void>(`/mechanics/${id}`),
  nearest: (lat: number, lng: number, limit = 5, skill?: string)  => {
    const qs = new URLSearchParams({ lat: String(lat), lng: String(lng), limit: String(limit) });
    if (skill) qs.set("skill", skill);
    return api.get<Mechanic[]>(`/mechanics/nearest?${qs}`);
  }
};
