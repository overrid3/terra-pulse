import { api } from "./client";

export type VmrsCode = { code: string; description: string; srtMinutes: number; difficultyFactor: number };

export const vmrsApi = {
  list: () => api.get<VmrsCode[]>("/vmrs-codes"),
};
