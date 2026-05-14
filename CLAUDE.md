# TerraPulse — Claude guide

POC earthmoving fleet management. Quarkus + PostGIS backend, React dispatch UI, mobile + MQTT deferred.

Status: **POC**. Production concerns (auth, observability, OptaPlanner, MQTT, Flutter) are intentionally deferred — see "Scope fence" below before suggesting hardening.

## Read these before changing code

- [docs/architecture.md](docs/architecture.md) — backend layers, WS flow, why each tech
- [docs/domain.md](docs/domain.md) — entities, state machine, hire types, override semantics
- [docs/api.md](docs/api.md) — REST endpoint catalog + WS event envelope
- [docs/dev-setup.md](docs/dev-setup.md) — Java 21 via SDKMAN, justfile recipes, troubleshooting
- `Pre plan prompt 1.md` — original blueprint with full target architecture (OptaPlanner, MQTT, Flutter, etc.)

## Quick start

```
just up         # boots postgis + backend (Quarkus dev) + web (Vite)
just seed       # populates demo scenario via REST
just down       # stops everything
```

Open http://localhost:5173/. Swagger at http://localhost:8080/q/swagger-ui.

## Layout

| Dir        | Purpose                                                 |
|------------|---------------------------------------------------------|
| `backend/` | Quarkus 3.31 (Java **25** supported), Hibernate ORM 7.2 + Spatial |
| `web/`     | Vite + React 18 + TS, react-router-dom, react-big-calendar |
| `infra/`   | Docker Compose support files + `seed.sh`                |
| `mobile/`  | Flutter app — deferred (stub README only)               |
| `docs/`    | Topic deep-dives linked above                           |

### Web routes (`web/src/App.tsx`)

- `/dispatch`  — live board (mechanics × time, react-big-calendar)
- `/orders`    — workflow + history + admin override
- `/mechanics` — CRUD
- `/clients`   — CRUD (B2B fields)

## Non-negotiables

- **Java 25** for backend (Quarkus 3.31 added full Java 25 runtime + native image support). `.sdkmanrc` pins `25.0.2-zulu`. Older Quarkus 3.20 needed Java 21 because Byte Buddy rejected JDK 25 class files — that constraint is gone.
- **Flyway owns the schema**. `quarkus.hibernate-orm.database.generation=validate`. Never let Hibernate auto-DDL.
- **Hibernate-spatial version** must match the Hibernate ORM version pulled by the Quarkus BOM (`backend/pom.xml` → `hibernate-orm.version` property; currently `7.2.1.Final` to match Quarkus 3.31.1 BOM).
- **State machine guards** in `ServiceOrderStateMachine` are the source of truth for service-order transitions. Override endpoint (`POST /service-orders/{id}/override-state`) is the only legitimate bypass and only allows `CANCELLED` / `REQUESTED` targets.
- **DevResource** (`/api/dev/*`) is gated by `@IfBuildProfile("dev")`. Do not call from prod-style code paths.
- **`Client` FK rules**: `Reservation.client_id` is **NOT NULL** — creating a reservation without `clientId` returns 400. `ServiceOrder.client_id` is nullable but the UI's order-creation form requires it. See `docs/domain.md` for the B2B field set.

## Stack quirks

- `OpenConnections.listAll()` is the way to broadcast WS events from outside an endpoint bean. `findByEndpointId(...)` is **not** in the public 3.20 API.
- Postgres named parameter with `NULL` value fails type inference. Branch SQL instead (see `MechanicRepository.findNearest`).
- `react-big-calendar` resource view requires both `resources` and `resourceIdAccessor` / `resourceTitleAccessor`.

## Scope fence (still POC)

No auth, no MQTT, no Flutter, no OptaPlanner, no native image, no CI. Mechanic GPS is faked via `POST /api/dev/simulate-move`. See `docs/architecture.md` § "Deferred work" for the full list.

## Commit style

Conventional commits. One concern per commit.
