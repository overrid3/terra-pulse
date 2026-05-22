export type DispatchEvent = {
  type:
    | "SERVICE_ORDER_CREATED"
    | "SERVICE_ORDER_STATE_CHANGED"
    | "SERVICE_ORDER_SCHEDULE_CHANGED"
    | "MECHANIC_LOCATION_UPDATED"
    | "MECHANIC_STATUS_CHANGED";
  occurredAt: string;
  payload: Record<string, unknown>;
};

type Listener = (e: DispatchEvent) => void;

function resolveWsUrl(): string {
  if (import.meta.env.VITE_WS_BASE) {
    return `${import.meta.env.VITE_WS_BASE}/dispatch`;
  }
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws/dispatch`;
}

export function connectDispatchSocket(onEvent: Listener): () => void {
  const url = resolveWsUrl();
  let ws: WebSocket | null = null;
  let closed = false;
  let backoffMs = 500;

  const open = () => {
    ws = new WebSocket(url);
    ws.onopen = () => { backoffMs = 500; };
    ws.onmessage = (m) => {
      try { onEvent(JSON.parse(m.data) as DispatchEvent); }
      catch (e) { console.warn("Bad WS payload", e); }
    };
    ws.onclose = () => {
      if (closed) return;
      setTimeout(open, backoffMs);
      backoffMs = Math.min(backoffMs * 2, 10_000);
    };
    ws.onerror = () => ws?.close();
  };
  open();

  return () => {
    closed = true;
    ws?.close();
  };
}
