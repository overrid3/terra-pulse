import { api } from "./client";
import { AbsenceUpsert, MechanicAbsence, UUID } from "../types";

export const absencesApi = {
  listByMechanic: (mechanicId: UUID) =>
    api.get<MechanicAbsence[]>(`/mechanic-absences?mechanicId=${mechanicId}`),

  listInRange: (from: string, to: string) =>
    api.get<MechanicAbsence[]>(
      `/mechanic-absences?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    ),

  create: (body: AbsenceUpsert) => api.post<MechanicAbsence>("/mechanic-absences", body),
  update: (id: UUID, body: AbsenceUpsert) => api.put<MechanicAbsence>(`/mechanic-absences/${id}`, body),
  delete: (id: UUID) => api.delete<void>(`/mechanic-absences/${id}`)
};
