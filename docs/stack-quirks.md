# Stack quirks

Surprises that have already bitten us. Check here before reinventing a fix.

- `OpenConnections.listAll()` is the way to broadcast WS events from outside an endpoint bean. `findByEndpointId(...)` is **not** in the public 3.20 API.
- Postgres named parameter with `NULL` value fails type inference. Branch SQL instead (see `MechanicRepository.findNearest`).
- `react-big-calendar` resource view requires both `resources` and `resourceIdAccessor` / `resourceTitleAccessor`. Resources only render in `day` view — `week` and `month` views silently drop them and show events on a global timeline.
- `react-big-calendar/lib/addons/dragAndDrop` ships in the same package (no peer dep). Wrap `Calendar` with `withDragAndDrop(...)` and import `addons/dragAndDrop/styles.css`. `onDropFromOutside` only receives a `resource` when the drop hits a resource row in day view — guard for `undefined` in non-day views.
- Backend has **no scheduled-start field**. The calendar shows orders at `startedAt ?? dispatchedAt ?? requestedAt`; dragging an event along the time axis cannot be persisted. Cross-mechanic drag calls `POST /service-orders/{id}/reassign`.
