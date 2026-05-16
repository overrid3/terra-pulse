# Stack quirks

Surprises that have already bitten us. Check here before reinventing a fix.

- `OpenConnections.listAll()` is the way to broadcast WS events from outside an endpoint bean. `findByEndpointId(...)` is **not** in the public 3.20 API.
- Postgres named parameter with `NULL` value fails type inference. Branch SQL instead (see `MechanicRepository.findNearest`).
- `react-big-calendar` resource view places resources as **columns**, not rows. The dispatch board needs Gantt-style mechanic rows × time columns, so dispatch uses a **custom `DispatchGantt`** (`web/src/components/DispatchGantt.tsx`) instead of RBC. RBC is still used by `AbsenceCalendarPicker`.
- `DispatchGantt` drag-and-drop uses **`@dnd-kit/core`** (not HTML5 native DnD). Three drag kinds are discriminated via the `DragStartEvent.active.data.current.kind` field:
  - `pool` — dragging an unassigned card from the right-hand Unassigned Pool; drop onto a mechanic row calls `POST /{id}/schedule`.
  - `event` — dragging an existing time block to a different mechanic row or time slot; calls `PATCH /{id}/schedule`.
  - `resize` — dragging the right edge handle of an existing block to extend/shrink its duration; calls `PATCH /{id}/schedule` with updated `scheduledEndAt`.
  Each mechanic row registers its DOM element in a shared `rowRefs: Map<mechanicId, HTMLElement>` that the drag overlay reads to convert cursor position into a wall-clock time.
- Backend stores `scheduled_start_at` and `scheduled_end_at` on the `ServiceOrder`. Orders render at `scheduledStartAt ?? startedAt ?? requestedAt` on the Gantt grid. Conflict detection (overlapping windows for the same mechanic) is enforced server-side; the UI also highlights conflicting blocks in amber before the user drops.
