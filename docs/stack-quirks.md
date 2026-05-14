# Stack quirks

Surprises that have already bitten us. Check here before reinventing a fix.

- `OpenConnections.listAll()` is the way to broadcast WS events from outside an endpoint bean. `findByEndpointId(...)` is **not** in the public 3.20 API.
- Postgres named parameter with `NULL` value fails type inference. Branch SQL instead (see `MechanicRepository.findNearest`).
- `react-big-calendar` resource view requires both `resources` and `resourceIdAccessor` / `resourceTitleAccessor`.
