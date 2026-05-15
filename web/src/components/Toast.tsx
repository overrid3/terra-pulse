import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "../api/client";

export type ToastKind = "info" | "success" | "warning" | "error";

export type ToastAction = { label: string; onClick: () => void };

export type ToastInput = {
  kind?: ToastKind;
  title?: string;
  message: string;
  durationMs?: number | null;
  action?: ToastAction;
};

type Toast = ToastInput & { id: number; kind: ToastKind; durationMs: number | null };

type ToastCtx = {
  push: (t: ToastInput) => void;
  error: (e: unknown, opts?: { title?: string; action?: ToastAction }) => void;
  success: (message: string, opts?: { title?: string }) => void;
  dismiss: (id: number) => void;
};

const ctx = createContext<ToastCtx | null>(null);

export function useToast(): ToastCtx {
  const c = useContext(ctx);
  if (!c) throw new Error("ToastProvider missing");
  return c;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((t: ToastInput) => {
    const id = ++idRef.current;
    const kind: ToastKind = t.kind ?? "info";
    const durationMs = t.durationMs === undefined ? (kind === "error" ? 8000 : 5000) : t.durationMs;
    setToasts((cur) => [...cur, { ...t, id, kind, durationMs }]);
  }, []);

  const error = useCallback((e: unknown, opts?: { title?: string; action?: ToastAction }) => {
    let title = opts?.title ?? "Error";
    let message = "Something went wrong";
    if (e instanceof ApiError) {
      message = e.message;
      if (e.status === 409 && !opts?.title) title = "Conflict";
      else if (e.status === 404 && !opts?.title) title = "Not found";
      else if (e.status >= 500 && !opts?.title) title = "Server error";
    } else if (e instanceof Error) {
      message = e.message;
    } else if (typeof e === "string") {
      message = e;
    }
    push({ kind: "error", title, message, action: opts?.action });
  }, [push]);

  const success = useCallback((message: string, opts?: { title?: string }) => {
    push({ kind: "success", title: opts?.title, message });
  }, [push]);

  const value = useMemo<ToastCtx>(() => ({ push, error, success, dismiss }), [push, error, success, dismiss]);

  return (
    <ctx.Provider value={value}>
      {children}
      <div className="toast-container" role="region" aria-live="polite" aria-label="Notifications">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ctx.Provider>
  );
}

const ICON: Record<ToastKind, string> = {
  info: "info",
  success: "check_circle",
  warning: "warning",
  error: "error"
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  useEffect(() => {
    if (toast.durationMs == null) return;
    const h = setTimeout(onDismiss, toast.durationMs);
    return () => clearTimeout(h);
  }, [toast.durationMs, onDismiss]);

  return (
    <div className={`toast toast-${toast.kind}`} role={toast.kind === "error" ? "alert" : "status"}>
      <span className="toast-icon material-symbols-outlined">{ICON[toast.kind]}</span>
      <div className="toast-body">
        {toast.title && <div className="toast-title">{toast.title}</div>}
        <div className="toast-message">{toast.message}</div>
        {toast.action && (
          <button
            className="toast-action"
            type="button"
            onClick={() => { toast.action!.onClick(); onDismiss(); }}
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button className="toast-close" type="button" aria-label="Dismiss" onClick={onDismiss}>×</button>
    </div>
  );
}
