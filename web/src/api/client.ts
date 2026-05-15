import { UUID } from "../types";

const BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8080/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    ...init
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText} — ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get:   <T>(p: string)                  => request<T>(p),
  post:  <T>(p: string, body?: unknown)  => request<T>(p, { method: "POST",  body: body == null ? undefined : JSON.stringify(body) }),
  put:   <T>(p: string, body?: unknown)  => request<T>(p, { method: "PUT",   body: body == null ? undefined : JSON.stringify(body) }),
  patch: <T>(p: string, body?: unknown)  => request<T>(p, { method: "PATCH", body: body == null ? undefined : JSON.stringify(body) }),
  delete:<T>(p: string)                  => request<T>(p, { method: "DELETE" })
};

export const queryKeys = {
  mechanics:    ["mechanics"] as const,
  serviceOrders:["serviceOrders"] as const,
  vehicles:     ["vehicles"] as const,
  clients:      ["clients"] as const,
  skills:       ["skills"] as const,
  absences:     ["absences"] as const,
  sites:        (clientId: UUID) => ["sites", clientId] as const
};
