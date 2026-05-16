# Architecture

## Layers

```
                      ┌──────────────────────────┐
                      │  React + react-query     │
                      │  (5173, Vite dev)        │
                      └──────────┬───────────────┘
              REST + JSON        │        WebSocket
                                 │  /ws/dispatch (push only)
                                 ▼
                      ┌──────────────────────────┐
                      │  Quarkus REST resources  │
                      │  /api/*                  │
                      ├──────────────────────────┤
                      │  Application services    │
                      │  (Estimation, Dispatch,  │
                      │   NearestMechanic,       │
                      │   GeometrySupport)       │
                      ├──────────────────────────┤
                      │  Panache repositories    │
                      │  (Vehicle, Mechanic,     │
                      │   Reservation, Order,    │
                      │   Client, VmrsCode)      │
                      ├──────────────────────────┤
                      │  Hibernate ORM 7.2       │
                      │  + Hibernate Spatial     │
                      └──────────┬───────────────┘
                                 │  JDBC
                                 ▼
                      ┌──────────────────────────┐
                      │  PostgreSQL 16 + PostGIS │
                      │  (5432, Docker)          │
                      └──────────────────────────┘
```

## Key decisions

- **Reactive backend, not blocking**. Quarkus + Vert.x lets WebSocket broadcast happen on the event loop while REST handlers stay on worker threads. `quarkus-websockets-next` is the API (not the legacy `quarkus-websockets`).
- **PostGIS for geo, not in-memory**. Mechanic locations and service-order sites are `geometry(Point, 4326)`. KNN queries use the `<->` operator on a GIST index (`mechanic_location_gix`).
- **State machine guards in code, not DB**. Postgres CHECK constraints are kept simple. The transition matrix is in `ServiceOrderState.canTransitionTo(...)` and the per-target field requirements are in `ServiceOrderStateMachine.transitionTo(...)`. Override endpoint bypasses both.
- **Flyway owns DDL**. Hibernate is on `validate`. Migrations live under `backend/src/main/resources/db/migration/V*.sql`.
- **WS broadcast pattern**: `DispatchEventBus.publish(...)` serializes a `DispatchEvent` record (envelope + opaque payload) and pushes to every open connection returned by `OpenConnections.listAll()`. Per-endpoint filtering isn't needed yet — we have one server-push channel.
- **Client-side cache**: react-query keys are coarse (`["mechanics"]`, `["serviceOrders"]`, `["clients"]`). WS events invalidate by prefix in `useDispatchSocket`.

## Request flows

### Schedule a service order

```
React → POST /api/service-orders/{id}/schedule {mechanicId, scheduledStartAt, scheduledEndAt}
       ↳ ServiceOrderResource.schedule
         ↳ loads SO + Mechanic
         ↳ ServiceOrderStateMachine.transitionTo(so, SCHEDULED)
           ↳ guards: mechanic non-null, scheduledStartAt + scheduledEndAt set, no overlap, prev state APPROVED
           ↳ sets scheduledAt
         ↳ DispatchEventBus.publish(SERVICE_ORDER_STATE_CHANGED)
           ↳ ObjectMapper.writeValueAsString(event)
           ↳ for c in OpenConnections.listAll(): c.sendText(json)
React ← 200 OK + ServiceOrderDto
React ← WS event → queryClient.invalidateQueries(["serviceOrders"])
```

### Nearest mechanic spatial query

```
React → GET /api/mechanics/nearest?lat=..&lng=..&skill=HYDRAULICS
       ↳ MechanicRepository.findNearest(lat, lng, limit, skill)
         ↳ native SQL with `<->` operator and ST_SetSRID(ST_MakePoint(...))
         ↳ GIST index `mechanic_location_gix` services the ORDER BY
React ← 200 OK + Mechanic[] sorted by distance
```

## Deferred work

The original blueprint (see `Pre plan prompt 1.md`) covers a lot more. Explicitly **out of POC scope**:

- OptaPlanner / Timefold AI solver — replaced by manual dispatch
- VMRS dataset — stub of 8 codes in `V4__seed_vmrs_stub.sql`
- Flutter mobile app — stub README; mechanic GPS is simulated via `/api/dev/simulate-move`
- MQTT broker (EMQX/HiveMQ) — backend would subscribe and bridge to WS in production
- OEM telemetry (ISO 15143-3 / VisionLink) — no integration; engine hours updated manually via PATCH
- Auth (Keycloak / JWT) — all endpoints open on localhost
- Native image / GraalVM — JVM only
- Observability stack (Prometheus, Grafana, OTel) — only `quarkus-smallrye-health`
- CI/CD pipeline
- Reservation exclusion constraints — app-level overlap check only
- Drag-and-drop on the calendar — read-only events

## Domain trade-offs

- **Single-table vs joined inheritance for Reservation**: Chose JOINED to keep child fields (`daily_rate`, `hourly_rate`, `operator_mechanic_id`) physically separate. Cost: 1 extra JOIN per query.
- **Override semantics**: `CANCELLED` keeps history; `REQUESTED` is a hard reopen — clears mechanic + lifecycle timestamps + `actual_minutes`. Every override appends to `service_order.notes` as an audit trail.
- **Skills as `TEXT[]`**: simplest path; freeform values for the POC. Production would normalize to a `mechanic_skill` table with an enum.
