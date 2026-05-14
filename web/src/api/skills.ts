import { api } from "./client";
import { Skill, UUID } from "../types";

export const skillsApi = {
  list:   ()                            => api.get<Skill[]>("/skills"),
  create: (name: string)                => api.post<Skill>("/skills", { name }),
  rename: (id: UUID, name: string)      => api.put<Skill>(`/skills/${id}`, { name }),
  delete: (id: UUID)                    => api.delete<void>(`/skills/${id}`)
};
