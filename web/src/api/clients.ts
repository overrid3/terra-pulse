import { api } from "./client";
import { Client, ClientState, ClientSummary, ClientUpsert, UUID } from "../types";

export const clientsApi = {
  list:     ()                                       => api.get<ClientSummary[]>("/clients"),
  get:      (id: UUID)                               => api.get<Client>(`/clients/${id}`),
  create:   (body: ClientUpsert)                     => api.post<Client>("/clients", body),
  update:   (id: UUID, body: ClientUpsert)           => api.patch<Client>(`/clients/${id}`, body),
  setState: (id: UUID, state: ClientState)           => api.put<Client>(`/clients/${id}/state`, { state }),
  delete:   (id: UUID)                               => api.delete<void>(`/clients/${id}`)
};
