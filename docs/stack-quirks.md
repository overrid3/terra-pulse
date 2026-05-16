# Stack quirks

Surprises that have already bitten us. Check here before reinventing a fix.

- `OpenConnections.listAll()` is the way to broadcast WS events from outside an endpoint bean. `findByEndpointId(...)` is **not** in the public 3.20 API.
- Postgres named parameter with `NULL` value fails type inference. Branch SQL instead (see `MechanicRepository.findNearest`).
- `react-big-calendar` resource view places resources as **columns**, not rows. The dispatch board needs Gantt-style mechanic rows × time columns, so dispatch uses a **custom `DispatchGantt`** (`web/src/components/DispatchGantt.tsx`) instead of RBC. RBC is still used by `AbsenceCalendarPicker`.
- `DispatchGantt` drag-and-drop uses HTML5 native DnD with a `text/plain` payload prefix to discriminate sources: `pool:<orderId>` (unassigned card) vs `event:<orderId>` (existing block). Drop targets are mechanic-row time areas; each row reads the payload prefix and routes to `dispatch` or `reassign`.
- Backend has **no scheduled-start field**. Orders render at `startedAt ?? dispatchedAt ?? requestedAt`; dragging an event along the time axis cannot be persisted (toast informs user). Cross-mechanic drag calls `POST /service-orders/{id}/reassign`.
