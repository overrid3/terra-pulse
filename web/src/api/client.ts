import { UUID } from "../types";

const BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8080/api";

export class ApiError extends Error {
  status: number;
  statusText: string;
  code: string | null;
  details: Record<string, unknown>;

  constructor(status: number, statusText: string, code: string | null, message: string, details: Record<string, unknown>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.statusText = statusText;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    ...init
  });
  if (!res.ok) {
    const raw = await res.text();
    let code: string | null = null;
    let message = `${res.status} ${res.statusText}`;
    let details: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        details = parsed;
        if (typeof parsed.error === "string") code = parsed.error;
        if (typeof parsed.message === "string") message = parsed.message;
      } else if (raw) {
        message = raw;
      }
    } catch {
      if (raw) message = raw;
    }
    throw new ApiError(res.status, res.statusText, code, message, details);
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
