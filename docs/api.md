# API reference

Base URL: `http://localhost:8080/api`. OpenAPI / Swagger UI: `http://localhost:8080/q/swagger-ui`.
All bodies and responses are JSON. UUIDs are canonical 36-char strings. Timestamps are ISO-8601 UTC.

## Vehicles `/api/vehicles`

| Method | Path                    | Notes                                |
|--------|-------------------------|--------------------------------------|
| GET    | `/`                     | list                                 |
| GET    | `/{id}`                 | fetch                                |
| POST   | `/`                     | create                               |
| PATCH  | `/{id}`                 | partial update (status, engineHours) |
| DELETE | `/{id}`                 |                                      |

## Mechanics `/api/mechanics`

| Method | Path                                                  | Notes                                              |
|--------|-------------------------------------------------------|----------------------------------------------------|
| GET    | `/`                                                   | list                                               |
| GET    | `/nearest?lat=&lng=&limit=&skill=`                    | KNN; skill optional; skips mechanics w/o location  |
| GET    | `/{id}`                                               |                                                    |
| POST   | `/`                                                   | create                                             |
| PATCH  | `/{id}`                                               | body may include `{status, location: {lat,lng}}`. Location update fires `MECHANIC_LOCATION_UPDATED`; status change fires `MECHANIC_STATUS_CHANGED` |
| DELETE | `/{id}`                                               |                                                    |

## Sites `/api/sites`

| Method | Path                              | Notes                                                                          |
|--------|-----------------------------------|--------------------------------------------------------------------------------|
| GET    | `/`                               | list all sites across clients as `SiteRefDto` (id, clientId, clientName, name, locationLabel). Used by Vehicles page to resolve `siteId → site name` |
| GET    | `/clients/{clientId}/sites`       | list sites for a single client (full `SiteDto` with counts)                     |
| POST   | `/clients/{clientId}/sites`       | create site under client                                                        |
| PATCH  | `/clients/{clientId}/sites/{id}`  | partial update                                                                  |
| DELETE | `/clients/{clientId}/sites/{id}`  |                                                                                 |

## Clients `/api/clients`

| Method | Path     | Notes                                                                              |
|--------|----------|------------------------------------------------------------------------------------|
| GET    | `/`      |                                                                                    |
| GET    | `/{id}`  |                                                                                    |
| POST   | `/`      | create. `name` + `email` required. Duplicate email → 409 `{error:"duplicate_email"}` |
| PUT    | `/{id}`  | full replace; same validation as POST                                              |
| PATCH  | `/{id}`  | partial; only non-null fields are written                                          |
| DELETE | `/{id}`  | hard delete; will fail if reservations reference it (FK)                           |

## Reservations `/api/reservations`

| Method | Path                                       | Notes                                                                                                |
|--------|--------------------------------------------|------------------------------------------------------------------------------------------------------|
| GET    | `/?vehicleId=&from=&to=`                   | list, all filters optional. Window filter uses overlap semantics (`endAt > from AND startAt < to`).  |
| GET    | `/{id}`                                    |                                                                                                      |
| POST   | `/`                                        | body discriminated by `hireType` (`DRY_HIRE` / `WET_HIRE`). `DRY_HIRE` requires `dailyRate`. `WET_HIRE` requires `hourlyRate` and may include `operatorMechanicId`. Overlapping reservation for the same vehicle → 409 `{error:"reservation_overlap"}`. |
| PATCH  | `/{id}`                                    | only `status` is patchable                                                                           |
| DELETE | `/{id}`                                    | allowed only while `status = BOOKED`                                                                 |

## Service orders `/api/service-orders`

| Method | Path                              | Body                                  | Notes                                                                                                          |
|--------|-----------------------------------|---------------------------------------|----------------------------------------------------------------------------------------------------------------|
| GET    | `/?state=&mechanicId=`            |                                       | both filters optional                                                                                          |
| GET    | `/{id}`                           |                                       |                                                                                                                |
| POST   | `/`                               | `{vehicleId, clientId?, vmrsCode, siteLocation: {lat,lng}, notes?}` | creates in `REQUESTED`; `estimated_minutes` pre-populated from VMRS                                            |
| POST   | `/{id}/quote`                     |                                       | recomputes estimate from current VMRS row; transitions `REQUESTED → QUOTED`                                    |
| POST   | `/{id}/approve`                   |                                       | `QUOTED → APPROVED`                                                                                            |
| POST   | `/{id}/dispatch`                  | `{mechanicId}`                        | `APPROVED → DISPATCHED`. Required mechanic id.                                                                 |
| POST   | `/{id}/reassign`                  | `{mechanicId}`                        | Reassign mechanic on a `DISPATCHED`/`IN_PROGRESS` order. State unchanged. Emits `SERVICE_ORDER_STATE_CHANGED` with `reassigned=true` and `previousMechanicId`. |
| POST   | `/{id}/start`                     |                                       | `DISPATCHED → IN_PROGRESS`                                                                                     |
| POST   | `/{id}/complete`                  | `{actualMinutes}`                     | `IN_PROGRESS → COMPLETED`                                                                                      |
| POST   | `/{id}/cancel`                    |                                       | normal transition to `CANCELLED` (allowed from any non-terminal state except IN_PROGRESS via this endpoint — IN_PROGRESS must override) |
| POST   | `/{id}/override-state`            | `{state: "CANCELLED" \| "REQUESTED", reason: "…"}` | admin override; only those two targets are accepted; `REQUESTED` performs a hard reopen (clears mechanic + timestamps); audit appended to `notes`. |

Invalid normal transitions return **409** with `{error:"illegal_state_transition", message: "Illegal state transition: FROM -> TO"}`.

## Dev-only `/api/dev` (profile `dev`)

| Method | Path             | Body                                  | Notes                                       |
|--------|------------------|---------------------------------------|---------------------------------------------|
| POST   | `/simulate-move` | `{mechanicId, lat, lng}`              | stands in for the deferred mobile GPS feed  |

Not exposed in non-dev profiles (`@IfBuildProfile("dev")`).

## WebSocket `ws://localhost:8080/ws/dispatch`

Server-push only. Inbound messages from clients are ignored.

### Envelope

```json
{
  "type": "<EVENT_TYPE>",
  "occurredAt": "<ISO-8601 UTC>",
  "payload": { ... }
}
```

### Event types and payloads

| `type`                          | Payload (key fields)                                                                                                       |
|---------------------------------|----------------------------------------------------------------------------------------------------------------------------|
| `SERVICE_ORDER_CREATED`         | Full `ServiceOrderDto`                                                                                                     |
| `SERVICE_ORDER_STATE_CHANGED`   | `{ id, fromState, toState, mechanicId, dispatchedAt, startedAt, completedAt, actualMinutes, estimatedMinutes, override?, reason? }` |
| `MECHANIC_LOCATION_UPDATED`     | `{ mechanicId, lat, lng, updatedAt }`                                                                                      |
| `MECHANIC_STATUS_CHANGED`       | `{ mechanicId, fromStatus, toStatus, updatedAt }`                                                                          |

Client-side: `web/src/hooks/useDispatchSocket.ts` invalidates `["serviceOrders"]` for `SERVICE_ORDER_*` and `["mechanics"]` for `MECHANIC_*`.
