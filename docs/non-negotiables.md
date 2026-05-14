# Non-negotiables

Constraints that must not be violated without explicit discussion.

- **Java 25** for backend. Quarkus 3.31 added full Java 25 runtime + native image support. `.sdkmanrc` pins `25.0.2-zulu`. Older Quarkus 3.20 needed Java 21 because Byte Buddy rejected JDK 25 class files — that constraint is gone.
- **Flyway owns the schema.** `quarkus.hibernate-orm.database.generation=validate`. Never let Hibernate auto-DDL.
- **Hibernate-spatial version** must match the Hibernate ORM version pulled by the Quarkus BOM (`backend/pom.xml` → `hibernate-orm.version` property; currently `7.2.1.Final` to match Quarkus 3.31.1 BOM).
- **State machine guards** in `ServiceOrderStateMachine` are the source of truth for service-order transitions. Override endpoint (`POST /service-orders/{id}/override-state`) is the only legitimate bypass and only allows `CANCELLED` / `REQUESTED` targets.
- **DevResource** (`/api/dev/*`) is gated by `@IfBuildProfile("dev")`. Do not call from prod-style code paths.
- **`Client` FK rules**: `Reservation.client_id` is **NOT NULL** — creating a reservation without `clientId` returns 400. `ServiceOrder.client_id` is nullable but the UI's order-creation form requires it. See [domain.md](domain.md) for the B2B field set.
