export type DispatchEvent = {
  type:
    | "SERVICE_ORDER_CREATED"
    | "SERVICE_ORDER_STATE_CHANGED"
    | "MECHANIC_LOCATION_UPDATED"
    | "MECHANIC_STATUS_CHANGED";
  occurredAt: string;
  payload: Record<string, unknown>;
};

type Listener = (e: DispatchEvent) => void;

export function connectDispatchSocket(onEvent: Listener): () => void {
  const url = (import.meta.env.VITE_WS_BASE ?? "ws://localhost:8080/ws") + "/dispatch";
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
