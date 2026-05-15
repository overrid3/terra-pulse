import { ReactNode, useCallback, useMemo } from "react";
import { toast as sonnerToast } from "sonner";
import { ApiError } from "../api/client";
import { Toaster } from "./ui/sonner";

export type ToastKind = "info" | "success" | "warning" | "error";
export type ToastAction = { label: string; onClick: () => void };
export type ToastInput = {
  kind?: ToastKind;
  title?: string;
  message: string;
  durationMs?: number | null;
  action?: ToastAction;
};

type ToastCtx = {
  push: (t: ToastInput) => void;
  error: (e: unknown, opts?: { title?: string; action?: ToastAction }) => void;
  success: (message: string, opts?: { title?: string }) => void;
  dismiss: (id: string | number) => void;
};

function pushImpl(t: ToastInput): string | number {
  const kind = t.kind ?? "info";
  const duration = t.durationMs === undefined ? (kind === "error" ? 8000 : 5000) : t.durationMs ?? Infinity;
  const opts = {
    description: t.title ? t.message : undefined,
    duration,
    action: t.action
      ? { label: t.action.label, onClick: t.action.onClick }
      : undefined,
  };
  const label = t.title ?? t.message;
  switch (kind) {
    case "success": return sonnerToast.success(label, opts);
    case "warning": return sonnerToast.warning(label, opts);
    case "error":   return sonnerToast.error(label, opts);
    default:        return sonnerToast.info(label, opts);
  }
}

function errorImpl(e: unknown, opts?: { title?: string; action?: ToastAction }): void {
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
  pushImpl({ kind: "error", title, message, action: opts?.action });
}

export function useToast(): ToastCtx {
  const push = useCallback(pushImpl, []);
  const error = useCallback(errorImpl, []);
  const success = useCallback(
    (message: string, opts?: { title?: string }) =>
      pushImpl({ kind: "success", title: opts?.title, message }),
    []
  );
  const dismiss = useCallback((id: string | number) => sonnerToast.dismiss(id), []);
  return useMemo(() => ({ push, error, success, dismiss }), [push, error, success, dismiss]);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Toaster richColors closeButton position="top-right" />
    </>
  );
}
