import { api } from "./client";
import { Client, ClientUpsert, UUID } from "../types";

export const clientsApi = {
  list:   ()                                       => api.get<Client[]>("/clients"),
  get:    (id: UUID)                               => api.get<Client>(`/clients/${id}`),
  create: (body: ClientUpsert)                     => api.post<Client>("/clients", body),
  update: (id: UUID, body: ClientUpsert)           => api.patch<Client>(`/clients/${id}`, body),
  delete: (id: UUID)                               => api.delete<void>(`/clients/${id}`)
};
