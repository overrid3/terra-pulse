# Dispatch Scheduling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add explicit scheduling to service orders (new `SCHEDULED` state, persisted `scheduled_start_at`/`scheduled_end_at`), free-text duration parsing, Gantt drag+resize, and a shared create-order modal — replacing the current dispatch-only flow.

**Architecture:** Backend gets a Flyway migration (no enum surgery — state is `VARCHAR(16)`), state-machine update, two new endpoints (`POST` + `PATCH /{id}/schedule`), and a duration parser. Frontend extends the existing custom `DispatchGantt` with resize handles, conflict detection, snap-to-grid, and a shared `CreateOrderForm` mounted from both Dispatch (modal) and Orders pages.

**Tech Stack:** Quarkus 3.31 (Java 25), Hibernate ORM 7.2 + PostGIS, Flyway, JUnit 5 + REST-assured. React 18 + TS, @dnd-kit/core, @tanstack/react-query, date-fns, sonner, shadcn `Dialog`, vitest (frontend tests where coverage exists).

**Reference spec:** `docs/superpowers/specs/2026-05-16-dispatch-scheduling-design.md`.

---

## Task layout

Phases (execute in order — later tasks depend on earlier ones):
- **A. Backend foundations** (T1–T3): migration, enum, entity.
- **B. State machine** (T4–T5): guards + tests.
- **C. Estimation parser** (T6–T7): util + endpoint.
- **D. DTOs** (T8–T9).
- **E. Resource endpoints** (T10–T14): create, schedule, reschedule, removals, override.
- **F. WS + seed** (T15–T16).
- **G. Frontend libs** (T17–T20): types, duration, conflicts, gantt-time.
- **H. API client** (T21).
- **I. Shared form** (T22–T24).
- **J. Gantt extensions** (T25–T29).
- **K. Polish** (T30–T31): WS hook + docs/i18n.

---

## Task 1: Flyway migration V14 — scheduled columns + DISPATCHED→SCHEDULED backfill

**Files:**
- Create: `backend/src/main/resources/db/migration/V14__service_order_scheduling.sql`

- [ ] **Step 1: Write migration**

```sql
-- ============================================================================
-- V14: scheduled window for service_order.
-- state column is VARCHAR(16) (per V2 convention) — no Postgres enum surgery.
-- Backfill DISPATCHED → SCHEDULED before the app's enum drops the value.
-- ============================================================================

UPDATE service_order
   SET state = 'SCHEDULED'
 WHERE state = 'DISPATCHED';

ALTER TABLE service_order
    ADD COLUMN scheduled_start_at TIMESTAMPTZ,
    ADD COLUMN scheduled_end_at   TIMESTAMPTZ,
    ADD CONSTRAINT sched_end_after_start CHECK (
        scheduled_end_at IS NULL OR scheduled_start_at IS NULL
        OR scheduled_end_at > scheduled_start_at
    );

CREATE INDEX service_order_schedule_idx
    ON service_order (mechanic_id, scheduled_start_at, scheduled_end_at)
 WHERE scheduled_start_at IS NOT NULL;
```

- [ ] **Step 2: Validate migration runs**

Run: `just down && just up && just seed`
Expected: backend starts cleanly, Flyway log shows `V14` applied, `\d service_order` (via `docker compose exec postgis psql -U terrapulse -d terrapulse`) shows new columns + constraint.

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/resources/db/migration/V14__service_order_scheduling.sql
git commit -m "feat(api): V14 — scheduled_start_at/end_at + DISPATCHED backfill"
```

---

## Task 2: ServiceOrderState — drop DISPATCHED, add SCHEDULED

**Files:**
- Modify: `backend/src/main/java/com/terrapulse/domain/service/ServiceOrderState.java`

- [ ] **Step 1: Replace enum + transition table**

```java
package com.terrapulse.domain.service;

import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

public enum ServiceOrderState {
    REQUESTED,
    QUOTED,
    APPROVED,
    SCHEDULED,
    IN_PROGRESS,
    COMPLETED,
    CANCELLED;

    private static final Map<ServiceOrderState, Set<ServiceOrderState>> ALLOWED = Map.of(
            REQUESTED,   EnumSet.of(QUOTED, CANCELLED),
            QUOTED,      EnumSet.of(APPROVED, CANCELLED),
            APPROVED,    EnumSet.of(SCHEDULED, CANCELLED),
            SCHEDULED,   EnumSet.of(IN_PROGRESS, CANCELLED),
            IN_PROGRESS, EnumSet.of(COMPLETED),
            COMPLETED,   EnumSet.noneOf(ServiceOrderState.class),
            CANCELLED,   EnumSet.noneOf(ServiceOrderState.class)
    );

    public boolean canTransitionTo(ServiceOrderState target) {
        return ALLOWED.get(this).contains(target);
    }

    public boolean isTerminal() {
        return ALLOWED.get(this).isEmpty();
    }
}
```

- [ ] **Step 2: Confirm compile (will fail in many call sites — Task 4–14 fix them)**

Run: `cd backend && ./mvnw -DskipTests compile -q 2>&1 | head -40`
Expected: compile errors only in files we will touch: `ServiceOrderStateMachine.java`, `ServiceOrderResource.java`, `ServiceOrderOverrideTest.java`. No commit yet — fold into Task 4's commit.

---

## Task 3: ServiceOrder entity — scheduled fields

**Files:**
- Modify: `backend/src/main/java/com/terrapulse/domain/service/ServiceOrder.java:75-80`

- [ ] **Step 1: Insert new columns after `requestedAt`**

After the `dispatched_at` block, add:

```java
    @Column(name = "scheduled_start_at")
    public Instant scheduledStartAt;

    @Column(name = "scheduled_end_at")
    public Instant scheduledEndAt;
```

Keep `dispatched_at` column for now (it's a DB column with a backfilled value; entity field stays so override-state legacy logic compiles until Task 14 cleans it up).

- [ ] **Step 2: Commit**

```bash
git add backend/src/main/java/com/terrapulse/domain/service/ServiceOrder.java \
        backend/src/main/java/com/terrapulse/domain/service/ServiceOrderState.java
git commit -m "feat(api): SCHEDULED state + scheduled_start_at/end_at entity fields"
```

---

## Task 4: ServiceOrderStateMachine — SCHEDULED guards

**Files:**
- Modify: `backend/src/main/java/com/terrapulse/domain/service/ServiceOrderStateMachine.java`

- [ ] **Step 1: Replace switch body**

```java
package com.terrapulse.domain.service;

import java.time.Instant;

public final class ServiceOrderStateMachine {

    private ServiceOrderStateMachine() {}

    public static void transitionTo(ServiceOrder order, ServiceOrderState target) {
        ServiceOrderState current = order.state;
        if (!current.canTransitionTo(target)) {
            throw new IllegalStateTransitionException(current, target);
        }

        switch (target) {
            case QUOTED -> {
                if (order.estimatedMinutes == null || order.estimatedMinutes <= 0) {
                    throw new IllegalStateTransitionException("estimatedMinutes must be set before QUOTED");
                }
            }
            case SCHEDULED -> {
                if (order.mechanic == null) {
                    throw new IllegalStateTransitionException("mechanic must be assigned before SCHEDULED");
                }
                if (order.scheduledStartAt == null || order.scheduledEndAt == null) {
                    throw new IllegalStateTransitionException("scheduledStartAt and scheduledEndAt must be set before SCHEDULED");
                }
                if (!order.scheduledEndAt.isAfter(order.scheduledStartAt)) {
                    throw new IllegalStateTransitionException("scheduledEndAt must be after scheduledStartAt");
                }
            }
            case IN_PROGRESS -> order.startedAt = Instant.now();
            case COMPLETED -> {
                if (order.actualMinutes == null || order.actualMinutes <= 0) {
                    throw new IllegalStateTransitionException("actualMinutes must be set before COMPLETED");
                }
                order.completedAt = Instant.now();
            }
            default -> { /* no extra guards */ }
        }

        order.state = target;
    }
}
```

- [ ] **Step 2: Run state-machine unit tests (will compile after Task 5 adds new ones)**

For now defer test run — covered in Task 5.

---

## Task 5: ServiceOrderStateMachineTest — SCHEDULED cases

**Files:**
- Create: `backend/src/test/java/com/terrapulse/domain/service/ServiceOrderStateMachineTest.java`

- [ ] **Step 1: Write tests**

```java
package com.terrapulse.domain.service;

import com.terrapulse.domain.mechanic.Mechanic;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.junit.jupiter.api.Assertions.*;

class ServiceOrderStateMachineTest {

    private ServiceOrder approvedOrder() {
        ServiceOrder so = new ServiceOrder();
        so.state = ServiceOrderState.APPROVED;
        so.estimatedMinutes = 60;
        return so;
    }

    @Test
    void scheduled_requiresMechanic() {
        ServiceOrder so = approvedOrder();
        so.scheduledStartAt = Instant.now();
        so.scheduledEndAt = so.scheduledStartAt.plus(1, ChronoUnit.HOURS);
        IllegalStateTransitionException ex = assertThrows(
                IllegalStateTransitionException.class,
                () -> ServiceOrderStateMachine.transitionTo(so, ServiceOrderState.SCHEDULED)
        );
        assertTrue(ex.getMessage().contains("mechanic"));
    }

    @Test
    void scheduled_requiresStartAndEnd() {
        ServiceOrder so = approvedOrder();
        so.mechanic = new Mechanic();
        IllegalStateTransitionException ex = assertThrows(
                IllegalStateTransitionException.class,
                () -> ServiceOrderStateMachine.transitionTo(so, ServiceOrderState.SCHEDULED)
        );
        assertTrue(ex.getMessage().contains("scheduledStartAt"));
    }

    @Test
    void scheduled_endMustBeAfterStart() {
        ServiceOrder so = approvedOrder();
        so.mechanic = new Mechanic();
        Instant t = Instant.now();
        so.scheduledStartAt = t.plus(1, ChronoUnit.HOURS);
        so.scheduledEndAt = t;
        assertThrows(IllegalStateTransitionException.class,
                () -> ServiceOrderStateMachine.transitionTo(so, ServiceOrderState.SCHEDULED));
    }

    @Test
    void scheduled_happyPath() {
        ServiceOrder so = approvedOrder();
        so.mechanic = new Mechanic();
        Instant t = Instant.now();
        so.scheduledStartAt = t;
        so.scheduledEndAt = t.plus(1, ChronoUnit.HOURS);
        ServiceOrderStateMachine.transitionTo(so, ServiceOrderState.SCHEDULED);
        assertEquals(ServiceOrderState.SCHEDULED, so.state);
    }

    @Test
    void inProgress_fromScheduled_setsStartedAt() {
        ServiceOrder so = approvedOrder();
        so.state = ServiceOrderState.SCHEDULED;
        ServiceOrderStateMachine.transitionTo(so, ServiceOrderState.IN_PROGRESS);
        assertEquals(ServiceOrderState.IN_PROGRESS, so.state);
        assertNotNull(so.startedAt);
    }

    @Test
    void approved_cannotSkipToInProgress() {
        ServiceOrder so = approvedOrder();
        assertThrows(IllegalStateTransitionException.class,
                () -> ServiceOrderStateMachine.transitionTo(so, ServiceOrderState.IN_PROGRESS));
    }
}
```

- [ ] **Step 2: Run tests, expect green**

Run: `cd backend && ./mvnw -q test -Dtest=ServiceOrderStateMachineTest`
Expected: 6/6 passing.

- [ ] **Step 3: Commit (folds in Task 4 changes)**

```bash
git add backend/src/main/java/com/terrapulse/domain/service/ServiceOrderStateMachine.java \
        backend/src/test/java/com/terrapulse/domain/service/ServiceOrderStateMachineTest.java
git commit -m "feat(api): state-machine SCHEDULED guards + unit tests"
```

---

## Task 6: EstimationParser — Java util + table-driven tests

**Files:**
- Create: `backend/src/main/java/com/terrapulse/service/EstimationParser.java`
- Create: `backend/src/test/java/com/terrapulse/service/EstimationParserTest.java`

- [ ] **Step 1: Write failing test**

```java
package com.terrapulse.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.junit.jupiter.api.Assertions.*;

class EstimationParserTest {

    @ParameterizedTest
    @CsvSource(textBlock = """
            '1d',       480
            '2h30m',    150
            '1.5h',     90
            '90',       90
            '1d 2h',    600
            '0m',       0
            '2h',       120
            '15m',      15
            """)
    void parse_validInputs(String input, int expected) {
        assertEquals(expected, EstimationParser.parse(input));
    }

    @Test
    void parse_empty_throws() {
        assertThrows(IllegalArgumentException.class, () -> EstimationParser.parse(""));
        assertThrows(IllegalArgumentException.class, () -> EstimationParser.parse("   "));
    }

    @Test
    void parse_invalid_throws() {
        assertThrows(IllegalArgumentException.class, () -> EstimationParser.parse("abc"));
        assertThrows(IllegalArgumentException.class, () -> EstimationParser.parse("1y"));
        assertThrows(IllegalArgumentException.class, () -> EstimationParser.parse("1d junk"));
    }

    @Test
    void parse_null_throws() {
        assertThrows(IllegalArgumentException.class, () -> EstimationParser.parse(null));
    }
}
```

- [ ] **Step 2: Run test, expect compile failure (`EstimationParser` not yet defined)**

Run: `cd backend && ./mvnw -q test -Dtest=EstimationParserTest`
Expected: compilation error: `EstimationParser` not found.

- [ ] **Step 3: Implement parser**

```java
package com.terrapulse.service;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class EstimationParser {

    private EstimationParser() {}

    private static final int MIN_PER_D = 480;   // 8h work-day
    private static final int MIN_PER_H = 60;
    private static final Pattern TOKEN = Pattern.compile("(\\d+(?:\\.\\d+)?)([dhm])");
    private static final Pattern BARE  = Pattern.compile("\\d+(?:\\.\\d+)?");

    public static int parse(String input) {
        if (input == null) throw new IllegalArgumentException("input required");
        String s = input.trim().toLowerCase();
        if (s.isEmpty()) throw new IllegalArgumentException("input empty");

        if (BARE.matcher(s).matches()) {
            return (int) Math.round(Double.parseDouble(s));
        }

        String stripped = s.replaceAll("\\s+", "");
        Matcher m = TOKEN.matcher(stripped);
        double total = 0;
        int consumed = 0;
        boolean matched = false;
        while (m.find()) {
            matched = true;
            double n = Double.parseDouble(m.group(1));
            char unit = m.group(2).charAt(0);
            total += switch (unit) {
                case 'd' -> n * MIN_PER_D;
                case 'h' -> n * MIN_PER_H;
                case 'm' -> n;
                default  -> throw new IllegalArgumentException("unknown unit: " + unit);
            };
            consumed += m.group().length();
        }
        if (!matched || consumed != stripped.length()) {
            throw new IllegalArgumentException("invalid duration: " + input);
        }
        return (int) Math.round(total);
    }
}
```

- [ ] **Step 4: Run tests, expect green**

Run: `cd backend && ./mvnw -q test -Dtest=EstimationParserTest`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/terrapulse/service/EstimationParser.java \
        backend/src/test/java/com/terrapulse/service/EstimationParserTest.java
git commit -m "feat(api): EstimationParser util (d/h/m → minutes)"
```

---

## Task 7: EstimationResource — `POST /api/estimation/parse`

**Files:**
- Create: `backend/src/main/java/com/terrapulse/api/EstimationResource.java`
- Create: `backend/src/test/java/com/terrapulse/api/EstimationResourceTest.java`

- [ ] **Step 1: Write failing test**

```java
package com.terrapulse.api;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;

@QuarkusTest
class EstimationResourceTest {

    @Test
    void parse_validInput_returnsMinutes() {
        given()
            .contentType("application/json")
            .body("{\"input\":\"1d 2h\"}")
        .when()
            .post("/api/estimation/parse")
        .then()
            .statusCode(200)
            .body("minutes", equalTo(600));
    }

    @Test
    void parse_invalidInput_returns400() {
        given()
            .contentType("application/json")
            .body("{\"input\":\"abc\"}")
        .when()
            .post("/api/estimation/parse")
        .then()
            .statusCode(400)
            .body("error", equalTo("invalid_estimation"));
    }
}
```

- [ ] **Step 2: Run test, expect 404 (endpoint missing)**

Run: `cd backend && ./mvnw -q test -Dtest=EstimationResourceTest`
Expected: failures with 404.

- [ ] **Step 3: Implement resource**

```java
package com.terrapulse.api;

import com.terrapulse.service.EstimationParser;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.util.Map;

@Path("/api/estimation")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class EstimationResource {

    public record ParseRequest(String input) {}

    @POST
    @Path("/parse")
    public Response parse(ParseRequest in) {
        try {
            int minutes = EstimationParser.parse(in == null ? null : in.input());
            return Response.ok(Map.of("minutes", minutes)).build();
        } catch (IllegalArgumentException ex) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "invalid_estimation", "message", ex.getMessage()))
                    .build();
        }
    }
}
```

- [ ] **Step 4: Run tests, expect green**

Run: `cd backend && ./mvnw -q test -Dtest=EstimationResourceTest`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/terrapulse/api/EstimationResource.java \
        backend/src/test/java/com/terrapulse/api/EstimationResourceTest.java
git commit -m "feat(api): POST /api/estimation/parse"
```

---

## Task 8: ServiceOrderDto + ServiceOrderCreateDto — add schedule fields

**Files:**
- Modify: `backend/src/main/java/com/terrapulse/api/dto/ServiceOrderDtos.java`

- [ ] **Step 1: Expand `ServiceOrderDto` record**

Insert `scheduledStartAt` and `scheduledEndAt` between `completedAt` and `notes`. Wire them in `of()`:

```java
public record ServiceOrderDto(
        UUID id,
        String title,
        UUID vehicleId,
        UUID mechanicId,
        UUID clientId,
        String clientName,
        UUID siteId,
        String siteName,
        String vmrsCode,
        String vmrsDescription,
        ServiceOrderState state,
        Integer estimatedMinutes,
        Integer actualMinutes,
        LatLng siteLocation,
        Instant requestedAt,
        Instant dispatchedAt,
        Instant scheduledStartAt,
        Instant scheduledEndAt,
        Instant startedAt,
        Instant completedAt,
        String notes,
        Instant createdAt,
        Instant updatedAt
) {
    public static ServiceOrderDto of(ServiceOrder so) {
        return new ServiceOrderDto(
                so.id,
                so.title,
                so.vehicle.id,
                so.mechanic != null ? so.mechanic.id : null,
                so.client != null ? so.client.id : null,
                so.client != null ? so.client.name : null,
                so.site != null ? so.site.id : null,
                so.site != null ? so.site.name : null,
                so.vmrsCode.code,
                so.vmrsCode.description,
                so.state,
                so.estimatedMinutes,
                so.actualMinutes,
                LatLng.of(so.siteLocation),
                so.requestedAt,
                so.dispatchedAt,
                so.scheduledStartAt,
                so.scheduledEndAt,
                so.startedAt,
                so.completedAt,
                so.notes,
                so.createdAt,
                so.updatedAt
        );
    }
}
```

- [ ] **Step 2: Expand `ServiceOrderCreateDto`**

```java
public record ServiceOrderCreateDto(
        UUID vehicleId,
        UUID clientId,
        UUID siteId,
        String vmrsCode,
        LatLng siteLocation,
        String notes,
        String title,
        String estimation,
        UUID mechanicId,
        Instant scheduledStartAt,
        Instant scheduledEndAt
) {}
```

`estimation` is the free-text input (e.g. `"1d"`); resource parses it via `EstimationParser`.

- [ ] **Step 3: Add `ScheduleRequest` and `PatchScheduleRequest` records**

Below the existing `DispatchRequest`:

```java
public record ScheduleRequest(
        UUID mechanicId,
        Instant scheduledStartAt,
        Instant scheduledEndAt
) {}

public record PatchScheduleRequest(
        UUID mechanicId,
        Instant scheduledStartAt,
        Instant scheduledEndAt
) {}
```

- [ ] **Step 4: Expand `OverrideStateRequest`**

```java
public record OverrideStateRequest(
        ServiceOrderState state,
        String reason,
        UUID mechanicId,
        Integer actualMinutes,
        Instant scheduledStartAt,
        Instant scheduledEndAt
) {}
```

- [ ] **Step 5: Compile check**

Run: `cd backend && ./mvnw -DskipTests compile -q 2>&1 | head -20`
Expected: compile errors only in `ServiceOrderResource.java` (Task 10 fixes). No commit yet — fold into Task 10.

---

## Task 9: Remove `DispatchRequest` references from resource + cleanup imports

**Files:**
- Modify: `backend/src/main/java/com/terrapulse/api/ServiceOrderResource.java` (remove unused `DispatchRequest` import once Task 13 strips endpoints; deferred)

- [ ] **Step 1: No-op marker task — keep `DispatchRequest` in place; remove in Task 13.**

(Plan structure note: `DispatchRequest` stays usable while we add the new `ScheduleRequest` flow alongside it. Task 13 removes both `/dispatch` and `/reassign` and deletes `DispatchRequest`.)

---

## Task 10: `POST /service-orders` — accept estimation + optional schedule

**Files:**
- Modify: `backend/src/main/java/com/terrapulse/api/ServiceOrderResource.java:100-150`

- [ ] **Step 1: Write failing test**

Create or extend `backend/src/test/java/com/terrapulse/api/ServiceOrderCreateTest.java`:

```java
package com.terrapulse.api;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.notNullValue;

@QuarkusTest
class ServiceOrderCreateTest {

    // assumes infra/seed.sh has been run — pulls vehicleId/clientId/siteId/vmrsCode from /api fixtures
    // For test isolation, helper SeedClient.fetchAny() (see existing tests for pattern) provides IDs.

    @Test
    void create_withoutSchedule_returnsRequested() {
        String body = """
            {
              "vehicleId": "%s",
              "siteId": "%s",
              "vmrsCode": "%s",
              "estimation": "2h"
            }
            """.formatted(SeedClient.anyVehicleId(), SeedClient.anySiteId(), SeedClient.anyVmrsCode());
        given().contentType("application/json").body(body)
        .when().post("/api/service-orders")
        .then().statusCode(201)
                .body("state", equalTo("REQUESTED"))
                .body("estimatedMinutes", equalTo(120))
                .body("scheduledStartAt", equalTo(null));
    }

    @Test
    void create_withFullSchedule_returnsScheduled() {
        String body = """
            {
              "vehicleId": "%s",
              "siteId": "%s",
              "vmrsCode": "%s",
              "estimation": "1h",
              "mechanicId": "%s",
              "scheduledStartAt": "2026-06-01T08:00:00Z",
              "scheduledEndAt":   "2026-06-01T09:00:00Z"
            }
            """.formatted(
                SeedClient.anyVehicleId(), SeedClient.anySiteId(),
                SeedClient.anyVmrsCode(), SeedClient.anyMechanicId());
        given().contentType("application/json").body(body)
        .when().post("/api/service-orders")
        .then().statusCode(201)
                .body("state", equalTo("SCHEDULED"))
                .body("mechanicId", notNullValue())
                .body("scheduledStartAt", equalTo("2026-06-01T08:00:00Z"));
    }

    @Test
    void create_invalidEstimation_returns400() {
        String body = """
            {
              "vehicleId": "%s",
              "siteId": "%s",
              "vmrsCode": "%s",
              "estimation": "garbage"
            }
            """.formatted(SeedClient.anyVehicleId(), SeedClient.anySiteId(), SeedClient.anyVmrsCode());
        given().contentType("application/json").body(body)
        .when().post("/api/service-orders")
        .then().statusCode(400);
    }
}
```

`SeedClient` is the existing fixture helper in `backend/src/test/java/com/terrapulse/api/SeedClient.java` (mirror pattern from `ServiceOrderOverrideTest`). If it doesn't exist, copy the inline GET-and-pick pattern used by `ServiceOrderOverrideTest.java`.

- [ ] **Step 2: Run test, expect 400/500 (resource doesn't handle new fields yet)**

Run: `cd backend && ./mvnw -q test -Dtest=ServiceOrderCreateTest`

- [ ] **Step 3: Rewrite `create()` method**

Replace the body of `ServiceOrderResource.create(...)` (lines 100–150) with:

```java
@POST
@Transactional
public Response create(ServiceOrderCreateDto in) {
    Vehicle v = vehicleRepo.findById(in.vehicleId());
    if (v == null) throw new IllegalArgumentException("vehicleId not found");
    VmrsCode c = vmrsRepo.findById(in.vmrsCode());
    if (c == null) throw new IllegalArgumentException("vmrsCode not found");
    if (in.siteId() == null) throw new IllegalArgumentException("siteId required");
    Site site = siteRepo.findById(in.siteId());
    if (site == null) throw new IllegalArgumentException("siteId not found");

    ServiceOrder so = new ServiceOrder();
    so.vehicle = v;
    so.vmrsCode = c;
    so.site = site;

    Client resolvedClient;
    if (in.clientId() != null) {
        resolvedClient = clientRepo.findById(in.clientId());
        if (resolvedClient == null) throw new IllegalArgumentException("clientId not found");
    } else {
        resolvedClient = site.client;
    }
    so.client = resolvedClient;

    if (site.lat != null && site.lng != null) {
        so.siteLocation = geo.point(site.lng, site.lat);
    } else if (in.siteLocation() != null) {
        so.siteLocation = geo.point(in.siteLocation().lng(), in.siteLocation().lat());
    } else {
        throw new IllegalArgumentException("siteLocation required when site has no coordinates");
    }
    so.notes = in.notes();

    if (in.title() == null || in.title().isBlank()) {
        so.title = titleGenerator.generate(v, c);
    } else {
        String t = in.title().trim();
        if (t.length() > 120) throw new IllegalArgumentException("title must be <= 120 chars");
        so.title = t;
    }

    if (in.estimation() != null && !in.estimation().isBlank()) {
        try {
            so.estimatedMinutes = EstimationParser.parse(in.estimation());
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("estimation: " + ex.getMessage());
        }
        if (so.estimatedMinutes <= 0) {
            throw new IllegalArgumentException("estimation must be > 0 minutes");
        }
    } else {
        so.estimatedMinutes = estimation.estimateMinutes(c);
    }

    boolean wantsSchedule = in.mechanicId() != null
            && in.scheduledStartAt() != null
            && in.scheduledEndAt() != null;
    boolean partialSchedule = !wantsSchedule
            && (in.mechanicId() != null || in.scheduledStartAt() != null || in.scheduledEndAt() != null);
    if (partialSchedule) {
        throw new IllegalArgumentException("mechanicId, scheduledStartAt and scheduledEndAt must all be set together");
    }

    if (wantsSchedule) {
        Mechanic m = mechanicRepo.findById(in.mechanicId());
        if (m == null) throw new IllegalArgumentException("mechanicId not found");
        so.mechanic = m;
        so.scheduledStartAt = in.scheduledStartAt();
        so.scheduledEndAt = in.scheduledEndAt();
        so.state = ServiceOrderState.SCHEDULED;
        // run state-machine guard so any invariant violation surfaces as a typed error
        ServiceOrderStateMachine.transitionTo(rewind(so), ServiceOrderState.SCHEDULED);
        // (rewind is just `so.state = REQUESTED;` to satisfy the transition graph)
    } else {
        so.state = ServiceOrderState.REQUESTED;
    }

    repo.persist(so);
    ServiceOrderDto dto = ServiceOrderDto.of(so);
    bus.publish(DispatchEvent.of(DispatchEvent.SERVICE_ORDER_CREATED, dto));
    return Response.status(Response.Status.CREATED).entity(dto).build();
}

private static ServiceOrder rewind(ServiceOrder so) {
    so.state = ServiceOrderState.APPROVED;  // SCHEDULED requires source APPROVED per state-machine
    return so;
}
```

Add import: `import com.terrapulse.service.EstimationParser;`

- [ ] **Step 4: Map `IllegalArgumentException` → 400 (existing ExceptionMapper)**

Verify: `find backend/src -name "*ExceptionMapper*" -o -name "*Errors*"` — confirm existing mapper returns 400. If not, the override-state path already throws `IllegalArgumentException` and yields 400; same path will work.

- [ ] **Step 5: Run tests**

Run: `cd backend && ./mvnw -q test -Dtest=ServiceOrderCreateTest`
Expected: all 3 green.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/terrapulse/api/ServiceOrderResource.java \
        backend/src/main/java/com/terrapulse/api/dto/ServiceOrderDtos.java \
        backend/src/test/java/com/terrapulse/api/ServiceOrderCreateTest.java
git commit -m "feat(api): create accepts estimation + optional schedule → SCHEDULED"
```

---

## Task 11: `POST /{id}/schedule` — APPROVED → SCHEDULED

**Files:**
- Modify: `backend/src/main/java/com/terrapulse/api/ServiceOrderResource.java`
- Create: `backend/src/test/java/com/terrapulse/api/ServiceOrderScheduleTest.java`

- [ ] **Step 1: Write failing test**

```java
package com.terrapulse.api;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;

@QuarkusTest
class ServiceOrderScheduleTest {

    @Test
    void schedule_fromApproved_succeeds() {
        String id = SeedClient.createAndApprove();
        String body = """
            {
              "mechanicId": "%s",
              "scheduledStartAt": "2026-06-01T08:00:00Z",
              "scheduledEndAt":   "2026-06-01T09:00:00Z"
            }
            """.formatted(SeedClient.anyMechanicId());
        given().contentType("application/json").body(body)
        .when().post("/api/service-orders/" + id + "/schedule")
        .then().statusCode(200)
                .body("state", equalTo("SCHEDULED"));
    }

    @Test
    void schedule_fromRequested_returns409() {
        String id = SeedClient.createOnly();
        given().contentType("application/json")
               .body("""
                   {"mechanicId":"%s","scheduledStartAt":"2026-06-01T08:00:00Z","scheduledEndAt":"2026-06-01T09:00:00Z"}
                   """.formatted(SeedClient.anyMechanicId()))
        .when().post("/api/service-orders/" + id + "/schedule")
        .then().statusCode(409);
    }

    @Test
    void schedule_missingMechanic_returns400() {
        String id = SeedClient.createAndApprove();
        given().contentType("application/json")
               .body("""
                   {"scheduledStartAt":"2026-06-01T08:00:00Z","scheduledEndAt":"2026-06-01T09:00:00Z"}
                   """)
        .when().post("/api/service-orders/" + id + "/schedule")
        .then().statusCode(400);
    }
}
```

`SeedClient.createOnly()` and `createAndApprove()` are helpers; add them mirroring existing test patterns.

- [ ] **Step 2: Run, expect 404 (endpoint missing)**

Run: `cd backend && ./mvnw -q test -Dtest=ServiceOrderScheduleTest`

- [ ] **Step 3: Add endpoint to `ServiceOrderResource`**

Insert after the `approve(...)` method:

```java
@POST
@Path("/{id}/schedule")
@Transactional
public ServiceOrderDto schedule(@PathParam("id") UUID id, ScheduleRequest in) {
    if (in == null || in.mechanicId() == null
            || in.scheduledStartAt() == null || in.scheduledEndAt() == null) {
        throw new IllegalArgumentException("mechanicId, scheduledStartAt, scheduledEndAt all required");
    }
    Mechanic m = mechanicRepo.findById(in.mechanicId());
    if (m == null) throw new IllegalArgumentException("mechanicId not found");

    ServiceOrder so = load(id);
    so.mechanic = m;
    so.scheduledStartAt = in.scheduledStartAt();
    so.scheduledEndAt = in.scheduledEndAt();
    return applyTransition(so, ServiceOrderState.SCHEDULED);
}
```

Add import: `import com.terrapulse.api.dto.ServiceOrderDtos.ScheduleRequest;`

- [ ] **Step 4: Run tests**

Run: `cd backend && ./mvnw -q test -Dtest=ServiceOrderScheduleTest`
Expected: 3/3 green.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/terrapulse/api/ServiceOrderResource.java \
        backend/src/test/java/com/terrapulse/api/ServiceOrderScheduleTest.java
git commit -m "feat(api): POST /service-orders/{id}/schedule"
```

---

## Task 12: `PATCH /{id}/schedule` — reschedule + reassign

**Files:**
- Modify: `backend/src/main/java/com/terrapulse/api/ServiceOrderResource.java`
- Create: `backend/src/test/java/com/terrapulse/api/ServiceOrderRescheduleTest.java`

- [ ] **Step 1: Write failing test**

```java
package com.terrapulse.api;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.notNullValue;

@QuarkusTest
class ServiceOrderRescheduleTest {

    @Test
    void patch_timeOnly_updatesWindow() {
        String id = SeedClient.createAndSchedule("2026-06-01T08:00:00Z", "2026-06-01T09:00:00Z");
        given().contentType("application/json")
               .body("""
                   {"scheduledStartAt":"2026-06-01T10:00:00Z","scheduledEndAt":"2026-06-01T11:00:00Z"}
                   """)
        .when().patch("/api/service-orders/" + id + "/schedule")
        .then().statusCode(200)
                .body("scheduledStartAt", equalTo("2026-06-01T10:00:00Z"));
    }

    @Test
    void patch_mechanicOnly_reassigns() {
        String id = SeedClient.createAndSchedule("2026-06-01T08:00:00Z", "2026-06-01T09:00:00Z");
        String other = SeedClient.anyOtherMechanicId(id);
        given().contentType("application/json")
               .body("{\"mechanicId\":\"" + other + "\"}")
        .when().patch("/api/service-orders/" + id + "/schedule")
        .then().statusCode(200)
                .body("mechanicId", equalTo(other));
    }

    @Test
    void patch_invalidWindow_returns400() {
        String id = SeedClient.createAndSchedule("2026-06-01T08:00:00Z", "2026-06-01T09:00:00Z");
        given().contentType("application/json")
               .body("""
                   {"scheduledStartAt":"2026-06-01T11:00:00Z","scheduledEndAt":"2026-06-01T10:00:00Z"}
                   """)
        .when().patch("/api/service-orders/" + id + "/schedule")
        .then().statusCode(400);
    }

    @Test
    void patch_notScheduledState_returns409() {
        String id = SeedClient.createOnly();
        given().contentType("application/json")
               .body("""
                   {"scheduledStartAt":"2026-06-01T08:00:00Z","scheduledEndAt":"2026-06-01T09:00:00Z"}
                   """)
        .when().patch("/api/service-orders/" + id + "/schedule")
        .then().statusCode(409);
    }
}
```

- [ ] **Step 2: Add `SERVICE_ORDER_SCHEDULE_CHANGED` constant**

Modify `backend/src/main/java/com/terrapulse/ws/DispatchEvent.java` (locate constants block, add):

```java
public static final String SERVICE_ORDER_SCHEDULE_CHANGED = "SERVICE_ORDER_SCHEDULE_CHANGED";
```

- [ ] **Step 3: Add PATCH endpoint to resource**

```java
@PATCH
@Path("/{id}/schedule")
@Transactional
public ServiceOrderDto patchSchedule(@PathParam("id") UUID id, PatchScheduleRequest in) {
    if (in == null
            || (in.mechanicId() == null && in.scheduledStartAt() == null && in.scheduledEndAt() == null)) {
        throw new IllegalArgumentException("at least one of mechanicId, scheduledStartAt, scheduledEndAt required");
    }
    ServiceOrder so = load(id);
    if (so.state != ServiceOrderState.SCHEDULED) {
        throw new IllegalStateTransitionException(
                "PATCH /schedule only allowed in SCHEDULED state (got " + so.state + ")");
    }
    UUID previousMechanicId = so.mechanic != null ? so.mechanic.id : null;

    if (in.mechanicId() != null) {
        Mechanic m = mechanicRepo.findById(in.mechanicId());
        if (m == null) throw new IllegalArgumentException("mechanicId not found");
        so.mechanic = m;
    }
    Instant newStart = in.scheduledStartAt() != null ? in.scheduledStartAt() : so.scheduledStartAt;
    Instant newEnd   = in.scheduledEndAt()   != null ? in.scheduledEndAt()   : so.scheduledEndAt;
    if (newEnd == null || newStart == null || !newEnd.isAfter(newStart)) {
        throw new IllegalArgumentException("scheduledEndAt must be after scheduledStartAt");
    }
    so.scheduledStartAt = newStart;
    so.scheduledEndAt = newEnd;

    ServiceOrderDto dto = ServiceOrderDto.of(so);
    Map<String, Object> payload = new HashMap<>();
    payload.put("id", so.id);
    payload.put("mechanicId", so.mechanic.id);
    payload.put("fromMechanicId", previousMechanicId);
    payload.put("scheduledStartAt", so.scheduledStartAt);
    payload.put("scheduledEndAt", so.scheduledEndAt);
    bus.publish(DispatchEvent.of(DispatchEvent.SERVICE_ORDER_SCHEDULE_CHANGED, payload));
    return dto;
}
```

Add imports: `import java.time.Instant;`, `import com.terrapulse.api.dto.ServiceOrderDtos.PatchScheduleRequest;`. Map `IllegalStateTransitionException` → HTTP 409 in the existing mapper (already mapped per `ServiceOrderOverrideTest` patterns).

- [ ] **Step 4: Run tests**

Run: `cd backend && ./mvnw -q test -Dtest=ServiceOrderRescheduleTest`
Expected: 4/4 green.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/terrapulse/api/ServiceOrderResource.java \
        backend/src/main/java/com/terrapulse/ws/DispatchEvent.java \
        backend/src/test/java/com/terrapulse/api/ServiceOrderRescheduleTest.java
git commit -m "feat(api): PATCH /service-orders/{id}/schedule + SCHEDULE_CHANGED event"
```

---

## Task 13: Remove `/dispatch` + `/reassign`, delete `DispatchRequest`

**Files:**
- Modify: `backend/src/main/java/com/terrapulse/api/ServiceOrderResource.java` (delete two methods + imports)
- Modify: `backend/src/main/java/com/terrapulse/api/dto/ServiceOrderDtos.java` (delete `DispatchRequest`)

- [ ] **Step 1: Delete the two methods**

Remove `dispatch(...)` (lines ~186–198 of original file) and `reassign(...)` (lines ~200–225). Remove the `DispatchRequest` import.

- [ ] **Step 2: Delete the record**

Remove `public record DispatchRequest(UUID mechanicId) {}` from `ServiceOrderDtos.java`.

- [ ] **Step 3: Update / delete any failing tests**

Run: `cd backend && ./mvnw -q test 2>&1 | grep -E "FAIL|ERROR" | head`
Expected failures (delete or update): any test that calls `/dispatch` or `/reassign`. These tests should be ported to `/schedule` semantics or removed if redundant with Task 11/12.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/terrapulse/api/ServiceOrderResource.java \
        backend/src/main/java/com/terrapulse/api/dto/ServiceOrderDtos.java \
        backend/src/test/java/com/terrapulse/api/   # if tests removed
git commit -m "refactor(api): remove /dispatch and /reassign — superseded by /schedule"
```

---

## Task 14: Override-state — accept schedule fields, support `SCHEDULED` target

**Files:**
- Modify: `backend/src/main/java/com/terrapulse/api/ServiceOrderResource.java:256-342` (overrideState method)
- Modify: `backend/src/test/java/com/terrapulse/api/ServiceOrderOverrideTest.java`

- [ ] **Step 1: Update existing test + add SCHEDULED target case**

Open `ServiceOrderOverrideTest.java`. Replace any `DISPATCHED` references with `SCHEDULED`. Add:

```java
@Test
void override_toScheduled_requiresAllScheduleFields() {
    String id = SeedClient.createOnly();
    given().contentType("application/json")
           .body("""
               {"state":"SCHEDULED","reason":"force schedule"}
               """)
    .when().post("/api/service-orders/" + id + "/override-state")
    .then().statusCode(400);
}

@Test
void override_toScheduled_happyPath() {
    String id = SeedClient.createOnly();
    String body = """
        {
          "state":"SCHEDULED",
          "reason":"force schedule",
          "mechanicId":"%s",
          "scheduledStartAt":"2026-06-01T08:00:00Z",
          "scheduledEndAt":  "2026-06-01T09:00:00Z"
        }
        """.formatted(SeedClient.anyMechanicId());
    given().contentType("application/json").body(body)
    .when().post("/api/service-orders/" + id + "/override-state")
    .then().statusCode(200)
            .body("state", equalTo("SCHEDULED"))
            .body("scheduledStartAt", equalTo("2026-06-01T08:00:00Z"));
}

@Test
void override_toRequested_clearsSchedule() {
    String id = SeedClient.createAndSchedule("2026-06-01T08:00:00Z", "2026-06-01T09:00:00Z");
    given().contentType("application/json")
           .body("""
               {"state":"REQUESTED","reason":"reopen"}
               """)
    .when().post("/api/service-orders/" + id + "/override-state")
    .then().statusCode(200)
            .body("state", equalTo("REQUESTED"))
            .body("scheduledStartAt", equalTo(null))
            .body("scheduledEndAt", equalTo(null))
            .body("mechanicId", equalTo(null));
}
```

- [ ] **Step 2: Update override-state switch — replace DISPATCHED case with SCHEDULED**

In the `switch (target)` block of `overrideState(...)`:

```java
case REQUESTED, QUOTED, APPROVED -> {
    so.mechanic = null;
    so.scheduledStartAt = null;
    so.scheduledEndAt = null;
    so.dispatchedAt = null;
    so.startedAt = null;
    so.completedAt = null;
    so.actualMinutes = null;
}
case SCHEDULED -> {
    if (so.mechanic == null) {
        if (in.mechanicId() == null) {
            throw new IllegalArgumentException("mechanicId required to override to SCHEDULED");
        }
        Mechanic m = mechanicRepo.findById(in.mechanicId());
        if (m == null) throw new IllegalArgumentException("mechanic not found: " + in.mechanicId());
        so.mechanic = m;
    }
    Instant newStart = in.scheduledStartAt() != null ? in.scheduledStartAt() : so.scheduledStartAt;
    Instant newEnd   = in.scheduledEndAt()   != null ? in.scheduledEndAt()   : so.scheduledEndAt;
    if (newStart == null || newEnd == null || !newEnd.isAfter(newStart)) {
        throw new IllegalArgumentException("scheduledStartAt + scheduledEndAt required (end after start) to override to SCHEDULED");
    }
    so.scheduledStartAt = newStart;
    so.scheduledEndAt = newEnd;
    so.startedAt = null;
    so.completedAt = null;
    so.actualMinutes = null;
}
case IN_PROGRESS -> {
    // existing block stays, but require scheduledStartAt + scheduledEndAt
    if (so.mechanic == null) {
        if (in.mechanicId() == null) throw new IllegalArgumentException("mechanicId required to override to IN_PROGRESS");
        Mechanic m = mechanicRepo.findById(in.mechanicId());
        if (m == null) throw new IllegalArgumentException("mechanic not found: " + in.mechanicId());
        so.mechanic = m;
    }
    if (so.scheduledStartAt == null) so.scheduledStartAt = in.scheduledStartAt() != null ? in.scheduledStartAt() : Instant.now();
    if (so.scheduledEndAt == null)   so.scheduledEndAt   = in.scheduledEndAt()   != null ? in.scheduledEndAt()   : so.scheduledStartAt.plusSeconds(60L * Math.max(1, so.estimatedMinutes));
    if (so.startedAt == null) so.startedAt = Instant.now();
    so.completedAt = null;
    so.actualMinutes = null;
}
case COMPLETED -> {
    // existing block — preserve, but also require schedule fields filled
    if (so.mechanic == null) {
        if (in.mechanicId() == null) throw new IllegalArgumentException("mechanicId required to override to COMPLETED");
        Mechanic m = mechanicRepo.findById(in.mechanicId());
        if (m == null) throw new IllegalArgumentException("mechanic not found: " + in.mechanicId());
        so.mechanic = m;
    }
    if (so.scheduledStartAt == null) so.scheduledStartAt = in.scheduledStartAt() != null ? in.scheduledStartAt() : Instant.now();
    if (so.scheduledEndAt == null)   so.scheduledEndAt   = in.scheduledEndAt()   != null ? in.scheduledEndAt()   : so.scheduledStartAt.plusSeconds(60L * Math.max(1, so.estimatedMinutes));
    if (so.startedAt == null) so.startedAt = Instant.now();
    if (so.actualMinutes == null) {
        if (in.actualMinutes() == null || in.actualMinutes() < 1) {
            throw new IllegalArgumentException("actualMinutes required to override to COMPLETED");
        }
        so.actualMinutes = in.actualMinutes();
    }
    if (so.completedAt == null) so.completedAt = Instant.now();
}
case CANCELLED -> {
    // keep lifecycle fields for audit trail
}
```

Delete the old `DISPATCHED` case.

- [ ] **Step 3: Run override tests**

Run: `cd backend && ./mvnw -q test -Dtest=ServiceOrderOverrideTest`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/terrapulse/api/ServiceOrderResource.java \
        backend/src/test/java/com/terrapulse/api/ServiceOrderOverrideTest.java
git commit -m "feat(api): override-state handles SCHEDULED target + schedule fields"
```

---

## Task 15: WS event hookup — invalidate on `SCHEDULE_CHANGED`

**Files:**
- (Backend: already done in Task 12. Frontend wires up in Task 30.)

Skip — backend side is complete. Marker task only.

---

## Task 16: Seed script — produce SCHEDULED orders

**Files:**
- Modify: `infra/seed.sh`

- [ ] **Step 1: Locate the service-order seeding block**

```bash
grep -n "service-orders\|/dispatch\|/reassign" infra/seed.sh
```

- [ ] **Step 2: Replace `/dispatch` calls with `/schedule`**

For each seed flow that previously created → quoted → approved → dispatched, append:

```bash
START=$(date -u -v+1d +%Y-%m-%dT08:00:00Z 2>/dev/null || date -u -d "+1 day" +%Y-%m-%dT08:00:00Z)
END=$(date -u -v+1d +%Y-%m-%dT10:00:00Z 2>/dev/null || date -u -d "+1 day" +%Y-%m-%dT10:00:00Z)
curl -fsS -X POST "$API/service-orders/$ORDER_ID/schedule" \
    -H 'content-type: application/json' \
    -d "{\"mechanicId\":\"$MECH_ID\",\"scheduledStartAt\":\"$START\",\"scheduledEndAt\":\"$END\"}" > /dev/null
```

(The exact substitution depends on the existing structure; preserve the surrounding loop.)

- [ ] **Step 3: Run seed end-to-end**

```bash
just down && just up && just seed
curl -fsS http://localhost:8080/api/service-orders | jq '.[] | {state, scheduledStartAt}' | head
```

Expected: at least one row with `"state": "SCHEDULED"` and a non-null `scheduledStartAt`.

- [ ] **Step 4: Commit**

```bash
git add infra/seed.sh
git commit -m "chore(infra): seed orders into SCHEDULED state"
```

---

## Task 17: Frontend types — add scheduled fields + drop DISPATCHED literal

**Files:**
- Modify: `web/src/types.ts:19-49`

- [ ] **Step 1: Replace `ServiceOrderState` union and `SERVICE_ORDER_STATES`, extend `ServiceOrder`**

```ts
export type ServiceOrderState =
  | "REQUESTED" | "QUOTED" | "APPROVED" | "SCHEDULED"
  | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export const SERVICE_ORDER_STATES: ServiceOrderState[] = [
  "REQUESTED", "QUOTED", "APPROVED", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"
];

export type ServiceOrder = {
  id: UUID;
  title?: string;
  vehicleId: UUID;
  mechanicId: UUID | null;
  clientId: UUID | null;
  siteId: UUID;
  siteName?: string | null;
  clientName: string | null;
  vmrsCode: string;
  vmrsDescription?: string;
  state: ServiceOrderState;
  estimatedMinutes: number;
  actualMinutes: number | null;
  siteLocation: LatLng;
  requestedAt: string;
  dispatchedAt: string | null;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};
```

- [ ] **Step 2: Compile check**

```bash
cd web && npx tsc -b 2>&1 | head -30
```

Expected: errors only in files we'll touch (`OrdersPage`, `DispatchGantt`, `DispatchPage`, `OrderDetailsCard`, `ServiceOrderDrawer`, `api/serviceOrders.ts`). Defer commit until later tasks compile.

---

## Task 18: `web/src/lib/duration.ts` — parser + formatter + tests

**Files:**
- Create: `web/src/lib/duration.ts`
- Create: `web/src/lib/duration.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from "vitest";
import { parseDuration, formatDuration } from "./duration";

describe("parseDuration", () => {
  it.each([
    ["1d", 480],
    ["2h30m", 150],
    ["1.5h", 90],
    ["90", 90],
    ["1d 2h", 600],
    ["0m", 0],
    ["2h", 120],
    ["15m", 15],
  ])("parses %s → %i", (input, expected) => {
    expect(parseDuration(input)).toBe(expected);
  });

  it.each(["", "abc", "1y", "1d junk", "   "])("rejects %s", (input) => {
    expect(parseDuration(input)).toBeNull();
  });
});

describe("formatDuration", () => {
  it.each([
    [480, "1d"],
    [150, "2h 30m"],
    [90, "1h 30m"],
    [0, "0m"],
    [600, "1d 2h"],
  ])("formats %i → %s", (mins, expected) => {
    expect(formatDuration(mins)).toBe(expected);
  });
});
```

- [ ] **Step 2: Run test, expect import failure**

```bash
cd web && npx vitest run src/lib/duration.test.ts
```

(If vitest isn't installed: `npm i -D vitest @testing-library/jest-dom` and add `"test": "vitest"` to `package.json`. Verify with `cd web && npm test src/lib/duration.test.ts`.)

- [ ] **Step 3: Implement**

```ts
const UNITS: Record<"d" | "h" | "m", number> = { d: 480, h: 60, m: 1 };
const TOKEN = /(\d+(?:\.\d+)?)([dhm])/g;
const BARE = /^\d+(?:\.\d+)?$/;

export function parseDuration(input: string): number | null {
  if (!input) return null;
  const s = input.trim().toLowerCase();
  if (!s) return null;
  if (BARE.test(s)) return Math.round(parseFloat(s));

  const stripped = s.replace(/\s+/g, "");
  const tokens = [...stripped.matchAll(TOKEN)];
  if (!tokens.length) return null;
  const consumed = tokens.reduce((n, m) => n + m[0].length, 0);
  if (consumed !== stripped.length) return null;
  const total = tokens.reduce(
    (acc, m) => acc + parseFloat(m[1]) * UNITS[m[2] as "d" | "h" | "m"],
    0
  );
  return Math.round(total);
}

export function formatDuration(minutes: number): string {
  if (minutes < 0) return "0m";
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

- [ ] **Step 4: Run tests, expect green**

Run: `cd web && npx vitest run src/lib/duration.test.ts`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/duration.ts web/src/lib/duration.test.ts
git commit -m "feat(web): duration parser (d/h/m ↔ minutes)"
```

---

## Task 19: `web/src/lib/findConflicts.ts` — overlap detection + tests

**Files:**
- Create: `web/src/lib/findConflicts.ts`
- Create: `web/src/lib/findConflicts.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from "vitest";
import { findConflicts, ScheduledItem } from "./findConflicts";

const mk = (id: string, startISO: string, endISO: string): ScheduledItem => ({
  id, startAt: new Date(startISO), endAt: new Date(endISO),
});

describe("findConflicts", () => {
  it("returns empty for non-overlapping items", () => {
    const items = [mk("a", "2026-06-01T08:00Z", "2026-06-01T09:00Z"),
                   mk("b", "2026-06-01T09:00Z", "2026-06-01T10:00Z")];
    expect(findConflicts(items)).toEqual(new Set());
  });

  it("touching edges = no conflict", () => {
    const items = [mk("a", "2026-06-01T08:00Z", "2026-06-01T09:00Z"),
                   mk("b", "2026-06-01T09:00Z", "2026-06-01T10:00Z")];
    expect(findConflicts(items).size).toBe(0);
  });

  it("overlap returns both ids", () => {
    const items = [mk("a", "2026-06-01T08:00Z", "2026-06-01T10:00Z"),
                   mk("b", "2026-06-01T09:00Z", "2026-06-01T11:00Z")];
    expect(findConflicts(items)).toEqual(new Set(["a", "b"]));
  });

  it("nested overlap returns both", () => {
    const items = [mk("a", "2026-06-01T08:00Z", "2026-06-01T12:00Z"),
                   mk("b", "2026-06-01T09:00Z", "2026-06-01T10:00Z")];
    expect(findConflicts(items)).toEqual(new Set(["a", "b"]));
  });

  it("three-way overlap returns all", () => {
    const items = [mk("a", "2026-06-01T08:00Z", "2026-06-01T10:00Z"),
                   mk("b", "2026-06-01T09:00Z", "2026-06-01T11:00Z"),
                   mk("c", "2026-06-01T08:30Z", "2026-06-01T09:30Z")];
    expect(findConflicts(items)).toEqual(new Set(["a", "b", "c"]));
  });
});
```

- [ ] **Step 2: Run, expect import failure**

Run: `cd web && npx vitest run src/lib/findConflicts.test.ts`

- [ ] **Step 3: Implement**

```ts
export type ScheduledItem = {
  id: string;
  startAt: Date;
  endAt: Date;
};

export function findConflicts(items: ScheduledItem[]): Set<string> {
  const conflicts = new Set<string>();
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j];
      if (a.startAt < b.endAt && b.startAt < a.endAt) {
        conflicts.add(a.id);
        conflicts.add(b.id);
      }
    }
  }
  return conflicts;
}
```

- [ ] **Step 4: Run tests, expect green**

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/findConflicts.ts web/src/lib/findConflicts.test.ts
git commit -m "feat(web): findConflicts util (overlap detection)"
```

---

## Task 20: `web/src/lib/gantt-time.ts` — pxToTime + snap

**Files:**
- Create: `web/src/lib/gantt-time.ts`
- Create: `web/src/lib/gantt-time.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from "vitest";
import { pxToTime, snap } from "./gantt-time";

const RECT = { left: 0, width: 1200, right: 1200, top: 0, bottom: 100, height: 100, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;

describe("snap", () => {
  it("Day view snaps to nearest hour", () => {
    const d = new Date("2026-06-01T08:23:45Z");
    expect(snap(d, "day").toISOString()).toBe("2026-06-01T08:00:00.000Z");
  });

  it("Day view rounds up past 30min", () => {
    const d = new Date("2026-06-01T08:45:00Z");
    expect(snap(d, "day").toISOString()).toBe("2026-06-01T09:00:00.000Z");
  });

  it("Week view snaps to start of day", () => {
    const d = new Date("2026-06-01T15:30:00Z");
    expect(snap(d, "week").toISOString()).toBe("2026-06-01T00:00:00.000Z");
  });
});

describe("pxToTime", () => {
  it("midpoint of Day view returns middle hour", () => {
    const winStart = new Date("2026-06-01T00:00:00Z");
    const winEnd = new Date("2026-06-02T00:00:00Z");
    const t = pxToTime(RECT, 600, "day", winStart, winEnd);
    expect(t.toISOString()).toBe("2026-06-01T12:00:00.000Z");
  });
});
```

- [ ] **Step 2: Run, expect import failure**

- [ ] **Step 3: Implement**

```ts
import { startOfDay } from "date-fns";

export type GanttView = "day" | "week" | "month";

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function pxToTime(
  rect: DOMRect, clientX: number, view: GanttView, winStart: Date, winEnd: Date
): Date {
  const ratio = clamp01((clientX - rect.left) / rect.width);
  const totalMs = winEnd.getTime() - winStart.getTime();
  return snap(new Date(winStart.getTime() + ratio * totalMs), view);
}

export function snap(d: Date, view: GanttView): Date {
  if (view === "day") {
    const minutes = d.getUTCMinutes();
    const rounded = new Date(d);
    if (minutes >= 30) rounded.setUTCHours(d.getUTCHours() + 1);
    rounded.setUTCMinutes(0, 0, 0);
    return rounded;
  }
  return startOfDay(d);
}
```

- [ ] **Step 4: Run tests, expect green**

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/gantt-time.ts web/src/lib/gantt-time.test.ts
git commit -m "feat(web): pxToTime + snap (1h Day, 1d Week/Month)"
```

---

## Task 21: API client — schedule POST/PATCH, expand create, remove old methods

**Files:**
- Modify: `web/src/api/serviceOrders.ts`

- [ ] **Step 1: Rewrite to current shape**

```ts
import { api } from "./client";
import { ServiceOrder, UUID } from "../types";

export type CreateOrderBody = {
  vehicleId: UUID;
  clientId?: UUID;
  siteId: UUID;
  vmrsCode: string;
  title?: string;
  notes?: string;
  estimation?: string;          // free-text, parsed server-side
  mechanicId?: UUID;
  scheduledStartAt?: string;    // ISO
  scheduledEndAt?: string;      // ISO
};

export type SchedulePatchBody = {
  mechanicId?: UUID;
  scheduledStartAt?: string;
  scheduledEndAt?: string;
};

export const serviceOrdersApi = {
  list:          ()                            => api.get<ServiceOrder[]>("/service-orders"),
  listByVehicle: (vehicleId: UUID)             => api.get<ServiceOrder[]>(`/service-orders?vehicleId=${vehicleId}`),
  get:           (id: UUID)                    => api.get<ServiceOrder>(`/service-orders/${id}`),
  create:        (body: CreateOrderBody)       => api.post<ServiceOrder>("/service-orders", body),
  quote:         (id: UUID)                    => api.post<ServiceOrder>(`/service-orders/${id}/quote`),
  approve:       (id: UUID)                    => api.post<ServiceOrder>(`/service-orders/${id}/approve`),
  schedule:      (id: UUID, body: { mechanicId: UUID; scheduledStartAt: string; scheduledEndAt: string }) =>
                                                  api.post<ServiceOrder>(`/service-orders/${id}/schedule`, body),
  reschedule:    (id: UUID, body: SchedulePatchBody) =>
                                                  api.patch<ServiceOrder>(`/service-orders/${id}/schedule`, body),
  start:         (id: UUID)                    => api.post<ServiceOrder>(`/service-orders/${id}/start`),
  complete:      (id: UUID, actualMinutes: number) =>
                                                  api.post<ServiceOrder>(`/service-orders/${id}/complete`, { actualMinutes }),
  cancel:        (id: UUID)                    => api.post<ServiceOrder>(`/service-orders/${id}/cancel`),
  override:      (id: UUID, body: {
                   state: "REQUESTED" | "QUOTED" | "APPROVED" | "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
                   reason: string;
                   mechanicId?: UUID;
                   actualMinutes?: number;
                   scheduledStartAt?: string;
                   scheduledEndAt?: string;
                 }) => api.post<ServiceOrder>(`/service-orders/${id}/override-state`, body),
  renameTitle:   (id: UUID, title: string)     => api.patch<ServiceOrder>(`/service-orders/${id}/title`, { title }),
  parseEstimation: (input: string)             => api.post<{ minutes: number }>("/estimation/parse", { input }),
};
```

Remove `dispatch` and `reassign` exports.

- [ ] **Step 2: Compile check**

```bash
cd web && npx tsc -b 2>&1 | head -30
```

Expected: errors in `DispatchPage`, `OrdersPage`, `ServiceOrderDrawer`. These are fixed in later tasks. Defer commit until Task 24.

---

## Task 22: `CreateOrderForm.tsx` — shared modal body

**Files:**
- Create: `web/src/components/CreateOrderForm.tsx`

- [ ] **Step 1: Write component**

```tsx
import { useState, useMemo, useEffect, FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { vehiclesApi } from "../api/vehicles";
import { clientsApi } from "../api/clients";
import { sitesApi } from "../api/sites";
import { vmrsApi } from "../api/vmrs";
import { mechanicsApi } from "../api/mechanics";
import { queryKeys } from "../api/client";
import { CreateOrderBody } from "../api/serviceOrders";
import { parseDuration, formatDuration } from "../lib/duration";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { UUID } from "../types";

type Props = {
  onSubmit: (body: CreateOrderBody) => Promise<void> | void;
  onCancel: () => void;
  submitting: boolean;
  // Optional: prefill if invoked from a context with a known mechanic/time
  initialMechanicId?: UUID;
  initialStartAt?: string;
};

export function CreateOrderForm({ onSubmit, onCancel, submitting, initialMechanicId, initialStartAt }: Props) {
  const vehiclesQ  = useQuery({ queryKey: queryKeys.vehicles,    queryFn: vehiclesApi.list });
  const clientsQ   = useQuery({ queryKey: queryKeys.clients,     queryFn: clientsApi.list });
  const sitesQ     = useQuery({ queryKey: queryKeys.sites,       queryFn: sitesApi.list });
  const vmrsQ      = useQuery({ queryKey: queryKeys.vmrs,        queryFn: vmrsApi.list });
  const mechanicsQ = useQuery({ queryKey: queryKeys.mechanics,   queryFn: mechanicsApi.list });

  const [vehicleId, setVehicleId] = useState<string>("");
  const [clientId,  setClientId]  = useState<string>("");
  const [siteId,    setSiteId]    = useState<string>("");
  const [vmrsCode,  setVmrsCode]  = useState<string>("");
  const [title,     setTitle]     = useState<string>("");
  const [notes,     setNotes]     = useState<string>("");
  const [estimation, setEstimation] = useState<string>("");
  const [mechanicId, setMechanicId] = useState<string>(initialMechanicId ?? "");
  const [startAt, setStartAt] = useState<string>(initialStartAt ?? "");
  const [endAtOverride, setEndAtOverride] = useState<string>("");

  useEffect(() => {
    const v = vmrsQ.data?.find((x) => x.code === vmrsCode);
    if (v && !estimation) setEstimation(formatDuration(Math.round(v.srtMinutes * v.difficultyFactor)));
  }, [vmrsCode, vmrsQ.data]);

  const filteredSites = useMemo(
    () => (sitesQ.data ?? []).filter((s) => !clientId || s.clientId === clientId),
    [sitesQ.data, clientId]
  );

  const parsedMinutes = useMemo(() => parseDuration(estimation), [estimation]);
  const estimationError = estimation && parsedMinutes === null;

  function computedEndAt(): string {
    if (endAtOverride) return endAtOverride;
    if (!startAt || !parsedMinutes) return "";
    const end = new Date(new Date(startAt).getTime() + parsedMinutes * 60_000);
    return end.toISOString();
  }

  const assignNow = Boolean(mechanicId && startAt);
  const assignPartial = Boolean((mechanicId || startAt) && !(mechanicId && startAt));

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!vehicleId || !clientId || !siteId || !vmrsCode) {
      toast.error("Vehicle, client, site, VMRS required");
      return;
    }
    if (!parsedMinutes || parsedMinutes <= 0) {
      toast.error("Invalid estimation");
      return;
    }
    if (assignPartial) {
      toast.error("Set both mechanic + start time, or neither");
      return;
    }
    const body: CreateOrderBody = {
      vehicleId, clientId, siteId, vmrsCode,
      title: title.trim() || undefined,
      notes: notes.trim() || undefined,
      estimation,
    };
    if (assignNow) {
      body.mechanicId = mechanicId;
      body.scheduledStartAt = new Date(startAt).toISOString();
      body.scheduledEndAt = computedEndAt();
    }
    onSubmit(body);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="grid gap-1.5"><Label>Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="optional" />
      </div>
      <div className="grid gap-1.5"><Label>Vehicle *</Label>
        <Select value={vehicleId} onValueChange={setVehicleId}>
          <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
          <SelectContent>{(vehiclesQ.data ?? []).map((v) => (
            <SelectItem key={v.id} value={v.id}>{v.make} {v.model} ({v.serialNumber})</SelectItem>
          ))}</SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5"><Label>Client *</Label>
        <Select value={clientId} onValueChange={setClientId}>
          <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
          <SelectContent>{(clientsQ.data ?? []).map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
          ))}</SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5"><Label>Site *</Label>
        <Select value={siteId} onValueChange={setSiteId} disabled={!clientId}>
          <SelectTrigger><SelectValue placeholder={clientId ? "Select site" : "Select client first"} /></SelectTrigger>
          <SelectContent>{filteredSites.map((s) => (
            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
          ))}</SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5"><Label>VMRS *</Label>
        <Select value={vmrsCode} onValueChange={setVmrsCode}>
          <SelectTrigger><SelectValue placeholder="Select VMRS code" /></SelectTrigger>
          <SelectContent>{(vmrsQ.data ?? []).map((c) => (
            <SelectItem key={c.code} value={c.code}>{c.code} — {c.description}</SelectItem>
          ))}</SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label>Estimation *</Label>
        <Input value={estimation} onChange={(e) => setEstimation(e.target.value)} placeholder="1d, 2h30m, 90m" aria-invalid={estimationError} />
        <span className={`text-xs ${estimationError ? "text-[var(--color-danger-fg)]" : "text-[var(--color-text-muted)]"}`}>
          {estimationError ? "Invalid format" : parsedMinutes != null ? `= ${parsedMinutes} min` : "e.g. 1d, 2h30m, 90m, 1.5h"}
        </span>
      </div>
      <div className="border-t pt-3 mt-1">
        <div className="text-sm text-[var(--color-text-muted)] mb-2">Optional: Assign now</div>
        <div className="grid gap-1.5"><Label>Mechanic</Label>
          <Select value={mechanicId} onValueChange={setMechanicId}>
            <SelectTrigger><SelectValue placeholder="— none —" /></SelectTrigger>
            <SelectContent>{(mechanicsQ.data ?? []).map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.fullName}</SelectItem>
            ))}</SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5 mt-2"><Label>Start (UTC)</Label>
          <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} step={3600} />
        </div>
        {assignNow && (
          <div className="grid gap-1.5 mt-2"><Label>End</Label>
            <Input type="datetime-local" value={endAtOverride || computedEndAt().slice(0, 16)} onChange={(e) => setEndAtOverride(new Date(e.target.value).toISOString())} step={3600} />
          </div>
        )}
        {assignPartial && (
          <p className="text-xs text-[var(--color-danger-fg)] mt-1">Set both mechanic + start, or neither</p>
        )}
      </div>
      <div className="grid gap-1.5"><Label>Notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </div>
      <div className="flex justify-end gap-2 mt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={submitting || estimationError || assignPartial}>
          {submitting ? "Creating…" : "Create"}
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Compile check**

Run: `cd web && npx tsc -b 2>&1 | head -20`
Expected: missing API helpers `vehiclesApi.list`, `clientsApi.list`, etc. already exist — verify via `grep -n "export const" web/src/api/*.ts`. If `vmrsApi` doesn't exist, create it: `web/src/api/vmrs.ts` with `list: () => api.get<{code: string; description: string; srtMinutes: number; difficultyFactor: number}[]>("/vmrs-codes")` (mirroring backend). Also extend `queryKeys` in `api/client.ts` with `vmrs: ["vmrs"]` if absent.

- [ ] **Step 3: Defer commit until Task 23 wires it.**

---

## Task 23: Mount `CreateOrderForm` in Dispatch page (modal + button)

**Files:**
- Modify: `web/src/components/DispatchPage.tsx`

- [ ] **Step 1: Import + state + mutation**

Near the top imports:

```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { CreateOrderForm } from "./CreateOrderForm";
import { CreateOrderBody } from "../api/serviceOrders";
```

Inside `DispatchPage` state block:

```tsx
const [createOpen, setCreateOpen] = useState(false);
const createMut = useMutation({
  mutationFn: (body: CreateOrderBody) => serviceOrdersApi.create(body),
  onSuccess: () => {
    invalidateOrders();
    setCreateOpen(false);
    toast.success("Order created");
  },
  onError: (e: Error) => toast.error(e.message),
});
```

- [ ] **Step 2: Insert `+ New Order` button in the header (after the date range label)**

```tsx
<Dialog open={createOpen} onOpenChange={setCreateOpen}>
  <DialogTrigger asChild>
    <Button size="sm"><Plus className="h-4 w-4 mr-1" />New Order</Button>
  </DialogTrigger>
  <DialogContent className="max-w-lg">
    <DialogHeader><DialogTitle>New Order</DialogTitle></DialogHeader>
    <CreateOrderForm
      submitting={createMut.isPending}
      onCancel={() => setCreateOpen(false)}
      onSubmit={(body) => createMut.mutate(body)}
    />
  </DialogContent>
</Dialog>
```

- [ ] **Step 3: Replace `dispatchMut` and `reassignMut` with `scheduleMut` and `rescheduleMut`**

```tsx
const scheduleMut = useMutation({
  mutationFn: (args: { id: UUID; mechanicId: UUID; start: string; end: string }) =>
    serviceOrdersApi.schedule(args.id, { mechanicId: args.mechanicId, scheduledStartAt: args.start, scheduledEndAt: args.end }),
  onSuccess: () => { invalidateOrders(); toast.success("Order scheduled"); },
  onError: (e: Error) => toast.error(e.message),
});

const rescheduleMut = useMutation({
  mutationFn: (args: { id: UUID; mechanicId?: UUID; start?: string; end?: string }) =>
    serviceOrdersApi.reschedule(args.id, {
      mechanicId: args.mechanicId,
      scheduledStartAt: args.start,
      scheduledEndAt: args.end,
    }),
  onSuccess: () => { invalidateOrders(); toast.success("Schedule updated"); },
  onError: (e: Error) => toast.error(e.message),
});
```

- [ ] **Step 4: Rewrite `handleDragEnd`**

```tsx
function handleDragEnd(e: DragEndEvent) {
  const a = e.active.data.current as
    | { kind?: string; orderId?: string; orderState?: string; currentMechanicId?: string;
        scheduledStartAt?: string; scheduledEndAt?: string; edge?: "start" | "end" }
    | undefined;
  const o = e.over?.data.current as { kind?: string; mechanicId?: string; rowRect?: DOMRect } | undefined;
  if (!a || !a.orderId) return;

  // Resize lands on same-row droppable; mechanicId equals current
  if (a.kind === "resize" && o?.kind === "row" && o.mechanicId && o.rowRect) {
    const winStart = ...; const winEnd = ...;  // already computed at component scope; reuse memo
    const cursorX = (e.activatorEvent as MouseEvent).clientX + (e.delta?.x ?? 0);
    const t = pxToTime(o.rowRect, cursorX, view, winStart, winEnd);
    if (a.edge === "start") {
      const end = new Date(a.scheduledEndAt!);
      if (t >= end) { toast.error("Start must be before end"); return; }
      rescheduleMut.mutate({ id: a.orderId, start: t.toISOString() });
    } else {
      const start = new Date(a.scheduledStartAt!);
      if (t <= start) { toast.error("End must be after start"); return; }
      rescheduleMut.mutate({ id: a.orderId, end: t.toISOString() });
    }
    return;
  }

  if (!o || o.kind !== "row" || !o.mechanicId || !o.rowRect) return;
  const mechanicId = o.mechanicId as UUID;
  const orderId = a.orderId as UUID;
  const cursorX = (e.activatorEvent as MouseEvent).clientX + (e.delta?.x ?? 0);
  const t = pxToTime(o.rowRect, cursorX, view, winStart, winEnd);

  if (a.kind === "pool") {
    if (a.orderState !== "APPROVED") {
      toast.error(`Order must be APPROVED to schedule (current: ${a.orderState})`);
      return;
    }
    const order = ordersQ.data?.find((x) => x.id === orderId);
    if (!order) return;
    const end = new Date(t.getTime() + order.estimatedMinutes * 60_000);
    scheduleMut.mutate({ id: orderId, mechanicId, start: t.toISOString(), end: end.toISOString() });
    return;
  }

  if (a.kind === "event") {
    const oldStart = new Date(a.scheduledStartAt!);
    const oldEnd   = new Date(a.scheduledEndAt!);
    const duration = oldEnd.getTime() - oldStart.getTime();
    const newStart = t;
    const newEnd = new Date(newStart.getTime() + duration);
    const sameRow = a.currentMechanicId === mechanicId;
    const sameTime = newStart.getTime() === oldStart.getTime();
    if (sameRow && sameTime) return;
    rescheduleMut.mutate({
      id: orderId,
      mechanicId: sameRow ? undefined : mechanicId,
      start: newStart.toISOString(),
      end: newEnd.toISOString(),
    });
  }
}
```

You need `winStart` and `winEnd` accessible here — lift the `useMemo` computation from `DispatchGantt` into `DispatchPage` and pass it down, OR compute it inline in `handleDragEnd`. Lifting is cleaner.

Add at top of the component:

```tsx
const [winStart, winEnd] = useMemo(() => {
  if (view === "day")   return dayBoundary(date);
  if (view === "week")  return weekBoundary(date);
  return monthBoundary(date);
}, [view, date]);
```

Pass `winStart`/`winEnd` to `DispatchGantt` and have it accept them as props instead of recomputing.

Import `pxToTime` from `../lib/gantt-time`.

- [ ] **Step 5: Add DragOverlay**

Inside `<DndContext>`, after `</main>`, before `</div>`:

```tsx
<DragOverlay>
  {/* render ghost based on active.data; simplest is null + rely on dnd-kit default */}
</DragOverlay>
```

For now leave the overlay child `null`; dnd-kit will still render the original ghost. Wire a proper ghost in Task 28.

- [ ] **Step 6: Smoke test (no commit yet)**

Run: `cd web && just web-dev` (or `npm run dev`). Verify `+ New Order` button appears, opens modal, creates an order. Verify drag from pool onto a Gantt row produces a backend call to `/schedule` (DevTools Network tab).

---

## Task 24: Wire `CreateOrderForm` in OrdersPage; finalize commit

**Files:**
- Modify: `web/src/pages/OrdersPage.tsx`

- [ ] **Step 1: Replace existing inline create panel with the shared form**

Find the section that builds the create body (`onSubmit={(body) => createMut.mutate(body)}`). Replace with:

```tsx
<CreateOrderForm
  submitting={createMut.isPending}
  onCancel={() => setCreateOpen(false)}
  onSubmit={(body) => createMut.mutate(body)}
/>
```

Add corresponding `Dialog` wrapper if not present, and a `+ New Order` button if not present.

- [ ] **Step 2: Delete the old standalone create form component if it's only used here**

```bash
grep -l "OrderCreate\|CreateOrder" web/src/ -r | grep -v CreateOrderForm
```

If a now-unused file shows up, delete it.

- [ ] **Step 3: TypeScript compile clean**

```bash
cd web && npx tsc -b
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add web/src/api/serviceOrders.ts web/src/components/CreateOrderForm.tsx \
        web/src/components/DispatchPage.tsx web/src/pages/OrdersPage.tsx \
        web/src/types.ts \
        web/src/api/vmrs.ts                 # if newly created
git commit -m "feat(web): shared CreateOrderForm + schedule/reschedule mutations"
```

---

## Task 25: `ResizeHandle` + `DispatchGantt` resize wiring

**Files:**
- Modify: `web/src/components/DispatchGantt.tsx`

- [ ] **Step 1: Add `ResizeHandle` subcomponent + use in `EventChip`**

Inside `DispatchGantt.tsx`, near `EventChip`:

```tsx
function ResizeHandle({ orderId, edge, scheduledStartAt, scheduledEndAt }: {
  orderId: string; edge: "start" | "end";
  scheduledStartAt: string; scheduledEndAt: string;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `resize:${orderId}:${edge}`,
    data: { kind: "resize", orderId, edge, scheduledStartAt, scheduledEndAt },
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      role="separator"
      aria-label={`Resize ${edge}`}
      className={cn(
        "absolute top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-[var(--color-brand-strong)] z-10",
        edge === "start" ? "left-0" : "right-0",
        isDragging && "bg-[var(--color-brand-strong)]"
      )}
      onClick={(e) => e.stopPropagation()}
    />
  );
}
```

- [ ] **Step 2: Mount handles in `EventChip` only when state is `SCHEDULED`**

Inside the `EventChip` return block, before/after the label:

```tsx
{order.state === "SCHEDULED" && order.scheduledStartAt && order.scheduledEndAt && (
  <ResizeHandle orderId={order.id} edge="start"
                scheduledStartAt={order.scheduledStartAt}
                scheduledEndAt={order.scheduledEndAt} />
)}
{/* existing label */}
{order.state === "SCHEDULED" && order.scheduledStartAt && order.scheduledEndAt && (
  <ResizeHandle orderId={order.id} edge="end"
                scheduledStartAt={order.scheduledStartAt}
                scheduledEndAt={order.scheduledEndAt} />
)}
```

Wrap chip-body click region in a child so resize handles don't trigger select/move.

- [ ] **Step 3: Update event drag activation**

Replace the chip's `useDraggable` data with:

```tsx
data: {
  kind: "event",
  orderId: order.id,
  orderState: order.state,
  currentMechanicId: order.mechanicId,
  scheduledStartAt: order.scheduledStartAt,
  scheduledEndAt: order.scheduledEndAt,
}
```

Make event drag a no-op if `order.state !== "SCHEDULED"`:

```tsx
const { ... } = useDraggable({
  id: `event:${order.id}`,
  data: { ... },
  disabled: order.state !== "SCHEDULED",
});
```

- [ ] **Step 4: Update `ordersForRow` filter**

```tsx
function ordersForRow(id: string) {
  return orders.filter((o) =>
    o.mechanicId === id
    && (o.state === "SCHEDULED" || o.state === "IN_PROGRESS" || o.state === "COMPLETED")
    && o.scheduledStartAt && o.scheduledEndAt
  );
}
```

- [ ] **Step 5: Update `eventBounds`**

```tsx
function eventBounds(o: ServiceOrder) {
  const start = new Date(o.scheduledStartAt!);
  const end   = new Date(o.scheduledEndAt!);
  return { start, end };
}
```

- [ ] **Step 6: Smoke test**

In dev server: confirm chips render at the scheduled window (not at `dispatched_at` fallback). Confirm resize handles only appear on SCHEDULED chips. Confirm dragging a left handle calls `/schedule` (PATCH) with new `scheduledStartAt`.

- [ ] **Step 7: Commit**

```bash
git add web/src/components/DispatchGantt.tsx
git commit -m "feat(web): Gantt resize handles + scheduled window rendering"
```

---

## Task 26: Gantt conflict detection rendering

**Files:**
- Modify: `web/src/components/DispatchGantt.tsx`

- [ ] **Step 1: Compute conflict set per row**

In `MechanicRow`, alongside `assignLanes(rowOrders)`:

```tsx
import { findConflicts, ScheduledItem } from "../lib/findConflicts";

// inside MechanicRow:
const conflictIds = useMemo(() => {
  const items: ScheduledItem[] = [
    ...orders.map((o) => ({ id: o.id, startAt: new Date(o.scheduledStartAt!), endAt: new Date(o.scheduledEndAt!) })),
    ...absences.map((a) => ({ id: `abs:${a.id}`, startAt: new Date(a.startAt), endAt: new Date(a.endAt) })),
  ];
  return findConflicts(items);
}, [orders, absences]);
```

- [ ] **Step 2: Apply red ring class on conflicting chips**

In the chip render:

```tsx
className={cn(
  "absolute rounded-[var(--radius-sm)] border ...",
  `state-${order.state}`,
  conflictIds.has(order.id) && "ring-2 ring-[var(--color-danger)]",
  isDragging && "opacity-40"
)}
```

Add `aria-describedby` referencing a tooltip element listing overlapping titles + times.

- [ ] **Step 3: Smoke test**

Create two SCHEDULED orders on the same mechanic with overlapping windows via seed or manual API. Confirm both get a red ring.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/DispatchGantt.tsx
git commit -m "feat(web): Gantt conflict highlighting (red ring + tooltip)"
```

---

## Task 27: `+ Absence` button in mechanic row header

**Files:**
- Modify: `web/src/components/DispatchGantt.tsx`

- [ ] **Step 1: Add button in `MechanicRow` row header**

```tsx
<button
  type="button"
  className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
  onClick={(e) => { e.stopPropagation(); /* open Absences sheet for this mechanic */ }}
  aria-label={`Add absence for ${mechanic.fullName}`}
>
  + Absence
</button>
```

Wire `onAddAbsence(mechanicId)` callback up to `DispatchPage`, which opens the existing `AbsencesPanel` Sheet pre-filtered.

- [ ] **Step 2: Commit**

```bash
git add web/src/components/DispatchGantt.tsx web/src/components/DispatchPage.tsx
git commit -m "feat(web): + Absence button in Gantt row header"
```

---

## Task 28: DragOverlay ghosts for pool/event/resize

**Files:**
- Modify: `web/src/components/DispatchPage.tsx`

- [ ] **Step 1: Track active drag**

```tsx
const [activeDrag, setActiveDrag] = useState<{ kind: string; orderId?: string } | null>(null);

function handleDragStart(e: DragStartEvent) {
  const d = e.active.data.current as any;
  setActiveDrag({ kind: d?.kind ?? "unknown", orderId: d?.orderId });
}
function handleDragEnd(e: DragEndEvent) {
  setActiveDrag(null);
  // existing logic from Task 23 Step 4
}
```

- [ ] **Step 2: Render DragOverlay children**

```tsx
<DragOverlay>
  {activeDrag?.kind === "pool" && (() => {
    const o = ordersQ.data?.find((x) => x.id === activeDrag.orderId);
    if (!o) return null;
    return <div className="bg-[var(--color-surface-container)] border border-[var(--color-hairline)] rounded p-2 shadow-md text-sm">{o.title ?? o.vmrsCode}</div>;
  })()}
  {activeDrag?.kind === "event" && (() => {
    const o = ordersQ.data?.find((x) => x.id === activeDrag.orderId);
    if (!o) return null;
    return <div className={cn("rounded border px-2 py-1 shadow-md text-xs", `state-${o.state}`)}>{o.title ?? o.vmrsCode}</div>;
  })()}
  {activeDrag?.kind === "resize" && (
    <div className="w-1.5 h-7 bg-[var(--color-brand-strong)] rounded" />
  )}
</DragOverlay>
```

- [ ] **Step 3: Commit**

```bash
git add web/src/components/DispatchPage.tsx
git commit -m "feat(web): DragOverlay ghosts for pool/event/resize"
```

---

## Task 29: ServiceOrderDrawer + OrderDetailsCard updates

**Files:**
- Modify: `web/src/components/ServiceOrderDrawer.tsx`
- Modify: `web/src/components/OrderDetailsCard.tsx`

- [ ] **Step 1: Replace `Dispatch` action with `Start` (when state is `SCHEDULED`)**

In the drawer's action bar, the dispatch button should:
- Hide for non-`SCHEDULED` states.
- Render only for `SCHEDULED`, calling `serviceOrdersApi.start(id)`.

```tsx
{order.state === "SCHEDULED" && (
  <Button onClick={() => startMut.mutate(order.id)}>Start</Button>
)}
```

Remove any `dispatchMut`/`reassignMut` usage in this file.

- [ ] **Step 2: Show scheduled window + estimation in `OrderDetailsCard`**

```tsx
import { formatDuration } from "../lib/duration";

// inside the card body:
<dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-1 text-sm">
  <dt className="text-[var(--color-text-muted)]">Estimation</dt>
  <dd>{formatDuration(order.estimatedMinutes)} ({order.estimatedMinutes} min)</dd>
  {order.scheduledStartAt && (
    <>
      <dt className="text-[var(--color-text-muted)]">Scheduled</dt>
      <dd>{format(new Date(order.scheduledStartAt), "PP HH:mm")} → {format(new Date(order.scheduledEndAt!), "PP HH:mm")}</dd>
    </>
  )}
  {/* existing rows */}
</dl>
```

- [ ] **Step 3: Compile + smoke test**

Run: `cd web && npx tsc -b`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/ServiceOrderDrawer.tsx web/src/components/OrderDetailsCard.tsx
git commit -m "feat(web): drawer shows Start (was Dispatch) + scheduled window in details"
```

---

## Task 30: `useDispatchSocket` — handle SCHEDULE_CHANGED

**Files:**
- Modify: `web/src/hooks/useDispatchSocket.ts`

- [ ] **Step 1: Add case for new event type**

```ts
case "SERVICE_ORDER_CREATED":
case "SERVICE_ORDER_STATE_CHANGED":
case "SERVICE_ORDER_SCHEDULE_CHANGED":
  qc.invalidateQueries({ queryKey: queryKeys.serviceOrders });
  break;
```

- [ ] **Step 2: Commit**

```bash
git add web/src/hooks/useDispatchSocket.ts
git commit -m "feat(web): handle SERVICE_ORDER_SCHEDULE_CHANGED WS event"
```

---

## Task 31: Docs + i18n strings

**Files:**
- Modify: `docs/domain.md` — replace `DISPATCHED` state row with `SCHEDULED`; update state-machine diagram; document `scheduled_start_at`/`scheduled_end_at`.
- Modify: `docs/api.md` — replace `/dispatch` + `/reassign` rows with `/schedule` (POST + PATCH); add `POST /estimation/parse`; add `SERVICE_ORDER_SCHEDULE_CHANGED` to WS events.
- Modify: `docs/stack-quirks.md` — replace the DispatchGantt note (the existing one mentions native HTML5 DnD; now mention resize handles + scheduled-window rendering + conflict detection).
- Modify: `docs/non-negotiables.md` — note SCHEDULED guards in the state-machine bullet.
- Modify: `web/src/i18n/en.json` + `web/src/i18n/it.json` — add strings:
  - `dispatch.newOrder` / `it`: `"Nuovo ordine"`
  - `dispatch.scheduleSuccess` / `it`: `"Ordine pianificato"`
  - `dispatch.rescheduleSuccess` / `it`: `"Pianificazione aggiornata"`
  - `dispatch.conflictWarning` / `it`: `"Sovrapposizione con {{title}} alle {{time}}"`
  - `dispatch.addAbsence` / `it`: `"+ Assenza"`
  - `orders.form.estimation` / `it`: `"Stima"`
  - `orders.form.estimationHint` / `it`: `"es. 1d, 2h30m, 90m"`
  - `orders.form.assignNow` / `it`: `"Opzionale: assegna ora"`
  - Plus matching state label entries: `state.SCHEDULED`, remove `state.DISPATCHED`.

- [ ] **Step 1: Apply edits per the bullets above** (no code block: small, surgical text changes).

- [ ] **Step 2: Verify nothing references `DISPATCHED` in source**

```bash
grep -rn "DISPATCHED" web/src backend/src docs --include="*.ts" --include="*.tsx" --include="*.java" --include="*.md" --include="*.json" | grep -v "node_modules\|\.tsbuildinfo"
```

Expected: zero hits, or hits only inside the deprecated migration-fix comment (`V14`) and the new spec/plan files documenting the rename.

- [ ] **Step 3: Final full-stack smoke**

```bash
just down && just up && just seed
```

Open `http://localhost:5173/dispatch`. Run through the manual smoke list from the spec:

- [ ] Create order from Dispatch with mechanic+start → chip lands on Gantt at correct slot
- [ ] Drag pool chip → row drops at hour boundary
- [ ] Drag chip across rows → mechanic changes, time preserved
- [ ] Resize right edge → end shifts, estimation unchanged
- [ ] Resize left edge → start shifts
- [ ] Two orders overlap → red ring + tooltip
- [ ] Override SCHEDULED → CANCELLED then REQUESTED (hard reopen clears schedule)

- [ ] **Step 4: Commit**

```bash
git add docs/ web/src/i18n/
git commit -m "docs + i18n: dispatch scheduling, SCHEDULED state, schedule endpoints"
```

---

## Self-review checklist (completed)

- **Spec coverage:**
  - State machine + schema → T1–T5.
  - API endpoints (POST/PATCH /schedule, parse) → T7, T10–T14.
  - WS event `SERVICE_ORDER_SCHEDULE_CHANGED` → T12 (backend), T30 (frontend).
  - Gantt drag/drop/resize → T20, T25.
  - Snap-to-hour (Day) / day (Week+Month) → T20, T23.
  - Conflict highlighting → T19, T26.
  - Shared `CreateOrderForm` → T22–T24.
  - Estimation parser (client + server) → T6, T18.
  - Absences read-only + row-header button → T27.
  - DragOverlay → T28.
  - Drawer `Start` replaces `Dispatch`; details show schedule + estimation → T29.
  - Override `SCHEDULED` target → T14.
  - Docs + i18n + seed → T16, T31.

- **Placeholders:** none — `V<n>` was the only placeholder in the spec and is concretized to `V14` here. All code blocks contain the actual code.

- **Type consistency:** `scheduledStartAt`/`scheduledEndAt` used identically in DTO, entity, frontend types, and API client. `parseDuration` returns `number | null` consistently. `ScheduleRequest` (POST) vs `PatchScheduleRequest` (PATCH) are distinct records with the same field set but different semantic (all-required vs all-optional).
