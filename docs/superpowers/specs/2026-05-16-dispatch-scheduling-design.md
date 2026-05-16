# Dispatch scheduling — design

Date: 2026-05-16
Scope: Replace dispatch model with explicit scheduling. Add `SCHEDULED` state, `scheduled_start_at` / `scheduled_end_at` persistence, free-text estimation parsing, Gantt drag + resize, shared create-order modal, UI-side overlap warnings.

## Context

Today the Dispatch page (`web/src/components/DispatchPage.tsx` + `DispatchGantt.tsx`) renders order chips at `startedAt ?? dispatchedAt ?? requestedAt` because the backend has no scheduled-time field. Time-axis drags emit a toast only. Order creation lives on `/orders` with `estimated_minutes` auto-computed from VMRS (no override). Vacations live in `AbsencesPanel`. Users need to:

1. Create an order with a custom estimate expressed in days/hours/minutes.
2. Pick a mechanic and a start day/time for the order.
3. Manage occupancy via drag-and-drop and edge-resize on the Gantt.
4. (Optional) Treat vacations similarly on the Gantt.
5. Lean on existing components where sensible (Kibo-UI was suggested).

Prior spec `2026-05-15-dispatch-fixes-design.md` rejected Kibo-UI for the same reasons that re-apply today (no hour-of-day range; `onMove` does not include row/group change). We keep the custom `DispatchGantt` and extend it.

## Goals

1. Persist scheduling (`scheduled_start_at`, `scheduled_end_at`) so drag/resize survives refresh.
2. Add a `SCHEDULED` state between `APPROVED` and `IN_PROGRESS`; remove `DISPATCHED` (no live data, seed-only DB).
3. Free-text estimation input parsed to minutes (`1d`, `2h30m`, `90m`, `1.5h`); 8-hour work-day for `d`.
4. Shared `CreateOrderForm` reused by Dispatch (modal) and Orders pages, with optional inline mechanic+schedule.
5. Gantt supports: pool→row drop, event→row reassign+reschedule, time-axis drag, edge resize.
6. UI-side conflict highlighting (overlap with another order or absence). No 409 from server.

## Non-goals

- Adopting Kibo-UI Gantt (structural mismatch: ranges, cross-row move).
- Server-side overlap enforcement.
- Auto-DISPATCH timer / cron.
- Mobile-grade touch DnD polish.
- Multi-select drag, keyboard reschedule, viewport auto-scroll.
- VMRS difficulty override per vehicle/site.
- Recurring schedules / templates.

## Design

### 1. State machine and schema

```
REQUESTED ──► QUOTED ──► APPROVED ──► SCHEDULED ──► IN_PROGRESS ──► COMPLETED
   │            │            │             │              │
   └────────────┴────────────┴─────────────┴──────────────┘
                        CANCELLED (terminal)

   override-state (admin) ──► any target, audit appended
```

`SCHEDULED` guard: `mechanic`, `scheduled_start_at`, `scheduled_end_at` all non-null. `IN_PROGRESS` source state becomes `SCHEDULED` (was `DISPATCHED`); auto-sets `started_at`. `COMPLETED` rules unchanged. `cancel` allowed from any non-terminal except `IN_PROGRESS` (override path stays).

Schema (`backend/src/main/resources/db/migration/V<n>__service_order_scheduling.sql`):

```sql
ALTER TABLE service_order
  ADD COLUMN scheduled_start_at TIMESTAMPTZ,
  ADD COLUMN scheduled_end_at   TIMESTAMPTZ,
  ADD CONSTRAINT sched_end_after_start CHECK (
    scheduled_end_at IS NULL OR scheduled_start_at IS NULL
    OR scheduled_end_at > scheduled_start_at
  );

-- enum surgery: drop DISPATCHED, add SCHEDULED. Seed-only DB, recreate enum is fine.
ALTER TYPE service_order_state RENAME TO service_order_state_old;
CREATE TYPE service_order_state AS ENUM (
  'REQUESTED','QUOTED','APPROVED','SCHEDULED','IN_PROGRESS','COMPLETED','CANCELLED'
);
ALTER TABLE service_order
  ALTER COLUMN state TYPE service_order_state
  USING state::text::service_order_state;
DROP TYPE service_order_state_old;
```

`estimated_minutes` column is unchanged. **Resize edits `scheduled_end_at` only**, never `estimated_minutes`. `estimated_minutes` stays as the planning reference (initial value from VMRS, optionally overridden at create).

### 2. API endpoints

| Method | Path | Body | Notes |
|--------|------|------|-------|
| POST | `/service-orders` | `{vehicleId, clientId, siteId, vmrsCode, title?, notes?, estimatedMinutes?, mechanicId?, scheduledStartAt?, scheduledEndAt?}` | If `mechanicId + scheduledStartAt + scheduledEndAt` all present → created as `SCHEDULED`. Else `REQUESTED`. `estimatedMinutes` overrides VMRS default when provided. |
| POST | `/{id}/quote` | — | unchanged |
| POST | `/{id}/approve` | — | unchanged |
| POST | `/{id}/schedule` | `{mechanicId, scheduledStartAt, scheduledEndAt}` | **new.** `APPROVED → SCHEDULED`. All three required. Replaces old `/dispatch`. |
| PATCH | `/{id}/schedule` | `{mechanicId?, scheduledStartAt?, scheduledEndAt?}` | **new.** Mutate schedule on `SCHEDULED` order. Used by Gantt time-drag, row-drag, edge-resize. 200 on success; emits `SERVICE_ORDER_SCHEDULE_CHANGED`. |
| POST | `/{id}/start` | — | `SCHEDULED → IN_PROGRESS`. Sets `started_at`. |
| POST | `/{id}/complete` | `{actualMinutes}` | unchanged |
| POST | `/{id}/cancel` | — | unchanged |
| POST | `/{id}/override-state` | `{state, reason, mechanicId?, scheduledStartAt?, scheduledEndAt?, actualMinutes?}` | Extend body with schedule fields. Audit pattern unchanged. If `state == "SCHEDULED"`, all three of `mechanicId + scheduledStartAt + scheduledEndAt` must be provided (else 400). `REQUESTED` hard-reopen also clears schedule fields. |
| POST | `/estimation/parse` | `{input}` | **new.** Returns `{minutes}` or 400 `{error:"invalid_estimation"}`. Single source of truth; client mirrors logic. |

Old endpoints removed (seed-only DB, no compat layer needed):
- `POST /{id}/dispatch`
- `POST /{id}/reassign` (replaced by `PATCH /schedule {mechanicId}`)

### 3. WebSocket events

| `type` | Payload |
|--------|---------|
| `SERVICE_ORDER_CREATED` | full DTO (unchanged) |
| `SERVICE_ORDER_STATE_CHANGED` | `{id, fromState, toState, mechanicId, scheduledStartAt, scheduledEndAt, startedAt, completedAt, override?, reason?}` |
| `SERVICE_ORDER_SCHEDULE_CHANGED` | **new.** `{id, mechanicId, fromMechanicId?, scheduledStartAt, scheduledEndAt}` — fired on `PATCH /schedule` without state change |
| `MECHANIC_LOCATION_UPDATED` | unchanged |
| `MECHANIC_STATUS_CHANGED` | unchanged |

`useDispatchSocket` invalidates `["serviceOrders"]` for both order events.

### 4. Gantt drag, drop, resize

**Drag sources / drop targets (dnd-kit data shapes):**

```ts
// draggables
{ id: `pool:${orderId}`,           data: { kind: "pool",   orderId, orderState } }
{ id: `event:${orderId}`,          data: { kind: "event",  orderId, mechanicId, scheduledStartAt, scheduledEndAt } }
{ id: `resize:${orderId}:${edge}`, data: { kind: "resize", orderId, edge: "start" | "end", scheduledStartAt, scheduledEndAt } }

// droppables
{ id: `row:${mechanicId}`,         data: { kind: "row", mechanicId, rowRect } }
```

`rowRect` captured on drag start via `useDroppable` node ref, so `onDragEnd` can map cursor X → time synchronously.

**Pixel → time mapping:**

```ts
function pxToTime(rect: DOMRect, clientX: number, view: GanttView, winStart: Date, winEnd: Date): Date {
  const ratio = clamp01((clientX - rect.left) / rect.width);
  const totalMs = winEnd.getTime() - winStart.getTime();
  return snap(new Date(winStart.getTime() + ratio * totalMs), view);
}

function snap(d: Date, view: GanttView): Date {
  return view === "day" ? roundToHour(d) : startOfDay(d);
}
```

Snap precision: 1 hour on Day view, 1 day on Week and Month views.

**Three drag interactions:**

1. **Pool → row** (`kind:"pool"` → `kind:"row"`). Guard: `orderState === "APPROVED"`. Else toast + reject (no network).
   - `scheduledStartAt = pxToTime(...)`; `scheduledEndAt = scheduledStartAt + estimatedMinutes`.
   - `POST /service-orders/{id}/schedule {mechanicId, scheduledStartAt, scheduledEndAt}`.

2. **Event → row** (`kind:"event"` → `kind:"row"`). Drag activation only enabled when order state is `SCHEDULED` (chips for `IN_PROGRESS`/`COMPLETED` render read-only). Else toast + reject.
   - Same row + same time: no-op.
   - Same row + new time: `PATCH /schedule {scheduledStartAt: t, scheduledEndAt: t + (oldEnd - oldStart)}`. Duration preserved.
   - Different row: `PATCH /schedule {mechanicId, scheduledStartAt: t, scheduledEndAt: t + duration}`.

3. **Resize chip border** (`kind:"resize"` → drop in same row).
   - Left handle: `PATCH /schedule {scheduledStartAt}`. Reject if new start ≥ current end (toast).
   - Right handle: `PATCH /schedule {scheduledEndAt}`. Reject if new end ≤ current start.
   - 6 px wide draggable strips on chip edges, `activationConstraint.distance: 2`.

**EventChip shape:**

```tsx
<div ref={chipRef} className="absolute ..." style={{ left, right, top, height }}>
  <ResizeHandle edge="start" orderId={o.id} />
  <button onClick={onSelect}>{label}</button>
  <ResizeHandle edge="end" orderId={o.id} />
</div>
```

`ResizeHandle` is its own `useDraggable` instance (`kind: "resize"`). Body click → select. Chip drag (excluding handles) → move. Handle drag → resize.

**Drag preview:** single `<DragOverlay>` at `DispatchPage` root, renders a ghost matching `active.data.kind` (pool card replica / chip replica with width / vertical bar at handle position).

**Row highlight + invalid-drop:** `useDroppable.isOver` × `canDrop()`:
- pool: green soft tint if `APPROVED`, red ring otherwise.
- event: green if mechanic differs or time differs, red if same-mechanic-same-time, red if state ≠ `SCHEDULED`.
- resize: green if resulting window stays valid (`end > start`), red otherwise.

**Conflict highlighting (non-blocking):** per render, `findConflicts(rowOrders, rowAbsences)` returns the set of conflicting order IDs. Conflicting chips get a red ring + `aria-describedby` tooltip listing overlap names and times. A drop that creates a new conflict succeeds but the toast warns: `"Overlap with X scheduled HH:MM–HH:MM"`. Memoize per row to keep cost predictable (n is small).

### 5. Create-order modal + estimation parsing

`web/src/components/CreateOrderForm.tsx` is the shared modal body. Consumed by:
- `DispatchPage` — header `+ New Order` button opens a shadcn `Dialog`.
- `OrdersPage` — replaces the existing inline create panel; same `Dialog`.

Layout:

```
┌─────────────────────────────────────────────────────────────┐
│  New Order                                              [X] │
├─────────────────────────────────────────────────────────────┤
│  Title           [ optional free text                    ]  │
│  Vehicle *       [ Select ▾ ]                               │
│  Client *        [ Select ▾ ]                               │
│  Site *          [ Select ▾ (filtered by client)         ]  │
│  VMRS code *     [ Select ▾ ] → fills Estimation default    │
│                                                             │
│  Estimation *    [ "1d 2h"                  ] ⓘ  = 600 min  │
│                  e.g. 1d, 2h30m, 90m, 1.5h                  │
│                                                             │
│  ── Optional: Assign now ─────────────────────────────────  │
│  Mechanic        [ Select ▾ (or — none —)                ]  │
│  Start           [ Date picker ] [ Time picker (1h step) ]  │
│  End             [ auto = start + Estimation ] [edit]       │
│                                                             │
│  Notes           [ textarea                              ]  │
│                                                             │
│  [ Cancel ]                                  [ Create ]     │
└─────────────────────────────────────────────────────────────┘
```

Field behaviour:
- `Vehicle`, `Client`, `Site`, `VMRS`, `Estimation` required to submit.
- VMRS change → prefills `Estimation` with the formatted VMRS minutes (`60` → `"1h"`, `480` → `"1d"`).
- `Estimation` text shows a live parsed-minutes badge (`= 600 min`) or a red error if parse fails.
- `Mechanic + Start` enables "Assign now":
  - Neither → `REQUESTED` (lands in pool).
  - Both → `SCHEDULED` (lands on Gantt at start time).
  - One without the other → form-level error, submit disabled.
- `End` auto-derives from `Start + estimatedMinutes`; pencil-edit lets the user override (same semantics as Gantt resize: shrinks/grows window without touching `estimated_minutes`).

Estimation parser (`web/src/lib/duration.ts`, mirrored on backend in `EstimationParser.java`):

```ts
const UNITS: Record<"d"|"h"|"m", number> = { d: 480, h: 60, m: 1 };
const TOKEN = /(\d+(?:\.\d+)?)\s*([dhm])/gi;

export function parseDuration(input: string): number | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;
  if (/^\d+(?:\.\d+)?$/.test(s)) return Math.round(parseFloat(s));        // bare number → minutes
  const stripped = s.replace(/\s+/g, "");
  const tokens = [...stripped.matchAll(/(\d+(?:\.\d+)?)([dhm])/g)];
  if (!tokens.length) return null;
  const consumed = tokens.reduce((n, m) => n + m[0].length, 0);
  if (consumed !== stripped.length) return null;                           // reject stray chars
  return Math.round(tokens.reduce((acc, m) => acc + parseFloat(m[1]) * UNITS[m[2] as "d"|"h"|"m"], 0));
}

export function formatDuration(minutes: number): string {
  const d = Math.floor(minutes / 480);
  let r = minutes - d * 480;
  const h = Math.floor(r / 60);
  r -= h * 60;
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (r) parts.push(`${r}m`);
  return parts.join(" ") || "0m";
}
```

Backend `EstimationParser` shares the same test fixture table; the `/estimation/parse` endpoint exists for cases where the client wants the canonical answer (e.g. on form blur) and to keep the server as the single source of truth.

Submit:

```ts
const minutes = parseDuration(estimation);
if (!minutes) return setError("estimation", "Invalid format");

const body: CreateOrderBody = {
  vehicleId, clientId, siteId, vmrsCode,
  title: title || undefined,
  notes: notes || undefined,
  estimatedMinutes: minutes,
};
if (mechanicId && startAt && endAt) {
  body.mechanicId = mechanicId;
  body.scheduledStartAt = startAt.toISOString();
  body.scheduledEndAt = endAt.toISOString();
}

await serviceOrdersApi.create(body);
qc.invalidateQueries({ queryKey: queryKeys.serviceOrders });
toast.success(body.mechanicId ? "Order scheduled" : "Order created");
```

API type update:

```diff
 create: (body: {
   vehicleId: UUID; clientId: UUID; siteId: UUID;
   vmrsCode: string; title?: string; notes?: string;
+  estimatedMinutes?: number;
+  mechanicId?: UUID;
+  scheduledStartAt?: string;  // ISO
+  scheduledEndAt?: string;    // ISO
 }) => api.post<ServiceOrder>("/service-orders", body)
```

### 6. Absences on Gantt

Read-only on Gantt (dashed bars, current rendering). Each mechanic-row header gains an `+ Absence` button that opens the existing `AbsencesPanel` (Mechanics-page Sheet drawer) pre-filtered to that mechanic. No drag/resize on absence bars in this iteration.

### 7. Error handling

| Where | Failure | Behaviour |
|-------|---------|-----------|
| `parseDuration` | malformed input | inline red helper text, submit disabled |
| `POST /service-orders` | missing required field | 400 `{error:"invalid_request", field}` → toast + form highlight |
| `POST /{id}/schedule` | order not in `APPROVED` | 409 `{error:"illegal_state_transition"}` → toast |
| `PATCH /{id}/schedule` | order not in `SCHEDULED` | 409 → toast |
| `PATCH /{id}/schedule` | `scheduled_end_at <= scheduled_start_at` | 400 → toast; chip snaps back via query invalidation |
| Gantt drop | pool order state ≠ `APPROVED` | client-side guard; toast; no network call |
| Gantt drop/resize | resulting window conflicts with another order/absence on that mechanic | success + warning toast listing conflicts; red ring on chips per `findConflicts` |
| WS reconnect | stale view | existing `useDispatchSocket` invalidates queries on event types |

Optimistic UI: drag-end mutates the local query cache via `setQueryData`, then revalidates on response. Failure reverts.

## Tests

**Backend (JUnit + REST-assured):**
- `ServiceOrderStateMachineTest`: `SCHEDULED` guards (mechanic + start + end); `DISPATCHED` removed; `SCHEDULED → IN_PROGRESS`; `override-state` targeting `SCHEDULED` with schedule fields; `REQUESTED` hard-reopen clears schedule too.
- `ServiceOrderResourceTest`:
  - `POST` without schedule → `REQUESTED`.
  - `POST` with full schedule → `SCHEDULED`.
  - `POST /{id}/schedule` happy path; non-`APPROVED` → 409.
  - `PATCH /{id}/schedule` time-only / mechanic-only / both / invalid window 400.
  - `override-state` with new schedule fields.
- `EstimationParserTest` (table): `"1d"→480, "2h30m"→150, "1.5h"→90, "90"→90, ""→null, "abc"→null, "1d 2h"→600, "0m"→0`.
- `EstimationServiceTest`: unchanged (VMRS default path).

**Frontend (vitest, where coverage exists):**
- `lib/duration.test.ts`: same fixture table as backend.
- `lib/findConflicts.test.ts`: overlap matrix (touching edges = no conflict; nested = conflict; absence vs order = conflict).
- `lib/gantt-time.test.ts`: `pxToTime` + `snap` (1 h Day, 1 d Week/Month).

**Manual smoke (record in PR):**
- Create order from Dispatch with mechanic+start → chip lands on Gantt at correct slot.
- Drag pool chip → row drops at hour boundary.
- Drag chip across rows → mechanic changes, time preserved.
- Resize right edge → end shifts, estimation unchanged.
- Resize left edge → start shifts.
- Two orders overlap → red ring + tooltip.
- Override `SCHEDULED` → `CANCELLED` then `REQUESTED` (hard reopen clears schedule fields).

## File inventory

**Backend**

| Action | File |
|--------|------|
| add | `backend/src/main/resources/db/migration/V<n>__service_order_scheduling.sql` |
| edit | `backend/src/main/java/.../domain/ServiceOrder.java` (+ scheduled fields) |
| edit | `backend/src/main/java/.../domain/ServiceOrderState.java` (drop `DISPATCHED`, add `SCHEDULED`) |
| edit | `backend/src/main/java/.../service/ServiceOrderStateMachine.java` (new guards) |
| edit | `backend/src/main/java/.../service/ServiceOrderService.java` (`schedule`, `reschedule`, `SCHEDULE_CHANGED` event) |
| edit | `backend/src/main/java/.../web/ServiceOrderResource.java` (new endpoints; remove `/dispatch`, `/reassign`) |
| edit | `backend/src/main/java/.../web/dto/ServiceOrderDto.java` (+ `scheduledStartAt`/`EndAt`) |
| edit | `backend/src/main/java/.../web/dto/CreateServiceOrderRequest.java` (+ `estimatedMinutes`, `mechanicId`, schedule) |
| add | `backend/src/main/java/.../service/EstimationParser.java` |
| add | `backend/src/main/java/.../web/EstimationResource.java` (POST `/estimation/parse`) |
| edit | `backend/src/main/java/.../web/dto/OverrideStateRequest.java` (+ schedule fields) |
| edit | `infra/seed.sh` (seed orders into `SCHEDULED` state) |
| edit | tests above |

**Frontend**

| Action | File |
|--------|------|
| edit | `web/src/types.ts` (add scheduled fields; remove `DISPATCHED` literal) |
| edit | `web/src/api/serviceOrders.ts` (`schedule` POST + PATCH; expand `create` body; remove `dispatch`/`reassign`) |
| add | `web/src/lib/duration.ts` (parser + formatter) |
| add | `web/src/lib/findConflicts.ts` (overlap detection) |
| add | `web/src/lib/gantt-time.ts` (`pxToTime`, `snap`) |
| add | `web/src/components/CreateOrderForm.tsx` (shared modal body) |
| edit | `web/src/components/DispatchPage.tsx` (`+ New Order` button, swap `dispatchMut`/`reassignMut` → `scheduleMut`/`rescheduleMut`, `DragOverlay`) |
| edit | `web/src/components/DispatchGantt.tsx` (resize handles; conflict detection; snap logic; pool shows `APPROVED` orders; rows render `SCHEDULED`/`IN_PROGRESS`/`COMPLETED` chips; drag/resize gestures enabled only on `SCHEDULED` chips, others read-only) |
| edit | `web/src/pages/OrdersPage.tsx` (use shared `CreateOrderForm`; surface schedule fields in detail panel) |
| edit | `web/src/components/OrderDetailsCard.tsx` (display scheduled window, estimation) |
| edit | `web/src/components/ServiceOrderDrawer.tsx` (`Start` button replaces `Dispatch`) |
| edit | `web/src/hooks/useDispatchSocket.ts` (handle `SERVICE_ORDER_SCHEDULE_CHANGED`) |
| edit | `web/src/i18n/en.json` + `it.json` (new strings) |

**Docs**

| Action | File |
|--------|------|
| edit | `docs/domain.md` (state machine, new fields) |
| edit | `docs/api.md` (endpoint catalog) |
| edit | `docs/stack-quirks.md` (Gantt resize + conflict detection notes) |
| edit | `docs/non-negotiables.md` (`SCHEDULED` guards) |

## Risks

- **Postgres enum surgery** in Flyway (drop `DISPATCHED`, add `SCHEDULED`): the migration uses `RENAME TYPE` + recreate + `USING` cast. Seed-only DB makes this acceptable; flagged in the migration header.
- **Resize-handle click vs chip-drag activation:** dnd-kit `activationConstraint.distance` tuned per drag kind (2 px for resize, 4 px for chip-move). Smoke-test required on macOS/Safari.
- **`findConflicts` cost** is O(n²) per row per render. n is small (orders per mechanic per visible window); memoize per row.

## Out of scope (deferred)

- Auth/RBAC on schedule endpoints (POC scope).
- Server-side overlap enforcement (UI-warning only, per decision).
- Auto-DISPATCH timer / cron, mobile-grade touch DnD polish.
- Multi-select drag, keyboard reschedule, viewport auto-scroll.
- VMRS difficulty override per vehicle/site.
- Recurring schedules / templates.
- Editable absences on Gantt (drag/resize/create inline); current iteration is read-only with row-header `+ Absence` deep-link.
