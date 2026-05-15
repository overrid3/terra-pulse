import { api } from "./client";
import { Site, SiteRef, SiteUpsert, UUID } from "../types";

export const sitesApi = {
  listAll: ()                                               => api.get<SiteRef[]>(`/sites`),
  list:    (clientId: UUID)                                 => api.get<Site[]>(`/clients/${clientId}/sites`),
  create:  (clientId: UUID, body: SiteUpsert)               => api.post<Site>(`/clients/${clientId}/sites`, body),
  update:  (clientId: UUID, siteId: UUID, body: SiteUpsert) => api.patch<Site>(`/clients/${clientId}/sites/${siteId}`, body),
  delete:  (clientId: UUID, siteId: UUID)                   => api.delete<void>(`/clients/${clientId}/sites/${siteId}`)
};
