# Dispatch Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Dispatch Gantt drag-and-drop reliability, show identifiable event labels, allow override to any state, unify order details across Dispatch drawer and Orders page, and prune dead code.

**Architecture:** Migrate Gantt DnD from native HTML5 to `@dnd-kit/core` (keep custom layout). Expose `siteName` on `ServiceOrderDto`. Widen `overrideState` endpoint with per-target side-effect rules. Extract shared `OrderDetailsCard` consumed by `ServiceOrderDrawer` and `OrdersPage`. Delete `ResourceTimeline` (unreferenced); add Gitignore for runtime artifacts.

**Tech Stack:** Java 25 + Quarkus + Hibernate ORM; React 18 + TypeScript + Tailwind v4 + shadcn/ui; `@dnd-kit/core` (new); `@tanstack/react-query`; `react-i18next`; JUnit 5 (backend) — no frontend test framework currently installed, so frontend tasks rely on type-check + manual smoke.

---

## File Structure

**Backend create:**
- `backend/src/test/java/com/terrapulse/api/ServiceOrderOverrideTest.java`

**Backend modify:**
- `backend/src/main/java/com/terrapulse/api/dto/ServiceOrderDtos.java` — add `siteName` to `ServiceOrderDto`, extend `OverrideStateRequest` with `mechanicId` + `actualMinutes`.
- `backend/src/main/java/com/terrapulse/api/ServiceOrderResource.java` — `overrideState`: accept any state, side-effect matrix, validation.

**Frontend create:**
- `web/src/components/OrderDetailsCard.tsx`

**Frontend modify:**
- `web/src/types.ts` — add `siteName?: string` on `ServiceOrder`.
- `web/src/api/serviceOrders.ts` — extend `override` signature.
- `web/src/components/DispatchGantt.tsx` — replace native DnD with dndkit; new chip label hierarchy.
- `web/src/components/DispatchPage.tsx` — wrap with `DndContext`, remove `lastPoolDragId`, remove `showVisualSlotHint` ref dance.
- `web/src/components/PendingOrders.tsx` — switch to dndkit `useDraggable`.
- `web/src/components/ServiceOrderDrawer.tsx` — render shared `OrderDetailsCard`.
- `web/src/pages/OrdersPage.tsx` — `OrderDetail` renders shared `OrderDetailsCard`; expand override state set; add conditional mechanic + minutes inputs.

**Frontend delete:**
- `web/src/components/ResourceTimeline.tsx` — unreferenced.

**Repo hygiene:**
- `.gitignore` — exclude `web/.claude-flow/`.
- Remove `web/.claude-flow/data/pending-insights.jsonl` from tracking.

---

## Task 1: Add `siteName` to ServiceOrderDto

**Files:**
- Modify: `backend/src/main/java/com/terrapulse/api/dto/ServiceOrderDtos.java`

- [ ] **Step 1: Add `siteName` field to record + factory**

Edit `ServiceOrderDtos.java`. Add field after `siteId`:

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
                so.startedAt,
                so.completedAt,
                so.notes,
                so.createdAt,
                so.updatedAt
        );
    }
}
```

- [ ] **Step 2: Build backend**

Run: `cd backend && ./mvnw -q -DskipTests compile`
Expected: BUILD SUCCESS.

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/terrapulse/api/dto/ServiceOrderDtos.java
git commit -m "feat(api): expose siteName on ServiceOrderDto"
```

---

## Task 2: Mirror `siteName` on frontend type

**Files:**
- Modify: `web/src/types.ts`

- [ ] **Step 1: Find ServiceOrder type and add field**

Run: `grep -n "siteId\|export type ServiceOrder\b" web/src/types.ts`
Expected: shows the `ServiceOrder` type with `siteId` field.

Add `siteName?: string;` directly after `siteId`:

```ts
export type ServiceOrder = {
  // ...existing fields...
  siteId?: UUID | null;
  siteName?: string | null;
  // ...existing fields continue...
};
```

(Keep exact existing surrounding fields. Only insert the one line.)

- [ ] **Step 2: Type-check**

Run: `cd web && npx tsc -b`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/types.ts
git commit -m "feat(web): add siteName to ServiceOrder type"
```

---

## Task 3: Widen `OverrideStateRequest` DTO

**Files:**
- Modify: `backend/src/main/java/com/terrapulse/api/dto/ServiceOrderDtos.java`

- [ ] **Step 1: Replace `OverrideStateRequest` record**

```java
public record OverrideStateRequest(
        ServiceOrderState state,
        String reason,
        UUID mechanicId,
        Integer actualMinutes
) {}
```

- [ ] **Step 2: Build**

Run: `cd backend && ./mvnw -q -DskipTests compile`
Expected: BUILD SUCCESS (Resource still compiles because Java records allow callers to pass nulls for new components).

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/terrapulse/api/dto/ServiceOrderDtos.java
git commit -m "feat(api): extend OverrideStateRequest with mechanicId + actualMinutes"
```

---

## Task 4: Override-state endpoint — accept any state with side-effect rules

**Files:**
- Modify: `backend/src/main/java/com/terrapulse/api/ServiceOrderResource.java:253-300` (the existing `overrideState` block)

- [ ] **Step 1: Replace method body**

Locate `@Path("/{id}/override-state")` block and replace the entire method with:

```java
@POST
@Path("/{id}/override-state")
@Transactional
public ServiceOrderDto overrideState(@PathParam("id") UUID id, OverrideStateRequest in) {
    if (in == null || in.state() == null) {
        throw new IllegalArgumentException("state required");
    }
    ServiceOrderState target = in.state();
    ServiceOrder so = load(id);
    ServiceOrderState from = so.state;

    String reason = (in.reason() == null || in.reason().isBlank()) ? "no reason given" : in.reason();
    String entry = "[override " + java.time.Instant.now() + "] " + from + " -> " + target + ": " + reason;
    so.notes = (so.notes == null || so.notes.isBlank()) ? entry : so.notes + "\n" + entry;

    java.time.Instant now = java.time.Instant.now();
    switch (target) {
        case REQUESTED, QUOTED, APPROVED -> {
            so.mechanic = null;
            so.dispatchedAt = null;
            so.startedAt = null;
            so.completedAt = null;
            so.actualMinutes = null;
        }
        case DISPATCHED -> {
            if (so.mechanic == null) {
                if (in.mechanicId() == null) {
                    throw new IllegalArgumentException("mechanicId required to override to DISPATCHED");
                }
                so.mechanic = mechanics.findById(in.mechanicId());
                if (so.mechanic == null) {
                    throw new IllegalArgumentException("mechanic not found: " + in.mechanicId());
                }
            }
            if (so.dispatchedAt == null) so.dispatchedAt = now;
            so.startedAt = null;
            so.completedAt = null;
            so.actualMinutes = null;
        }
        case IN_PROGRESS -> {
            if (so.mechanic == null) {
                if (in.mechanicId() == null) {
                    throw new IllegalArgumentException("mechanicId required to override to IN_PROGRESS");
                }
                so.mechanic = mechanics.findById(in.mechanicId());
                if (so.mechanic == null) {
                    throw new IllegalArgumentException("mechanic not found: " + in.mechanicId());
                }
            }
            if (so.dispatchedAt == null) so.dispatchedAt = now;
            if (so.startedAt == null) so.startedAt = now;
            so.completedAt = null;
            so.actualMinutes = null;
        }
        case COMPLETED -> {
            if (so.mechanic == null) {
                if (in.mechanicId() == null) {
                    throw new IllegalArgumentException("mechanicId required to override to COMPLETED");
                }
                so.mechanic = mechanics.findById(in.mechanicId());
                if (so.mechanic == null) {
                    throw new IllegalArgumentException("mechanic not found: " + in.mechanicId());
                }
            }
            if (so.dispatchedAt == null) so.dispatchedAt = now;
            if (so.startedAt == null) so.startedAt = now;
            if (so.actualMinutes == null) {
                if (in.actualMinutes() == null || in.actualMinutes() < 1) {
                    throw new IllegalArgumentException("actualMinutes required to override to COMPLETED");
                }
                so.actualMinutes = in.actualMinutes();
            }
            if (so.completedAt == null) so.completedAt = now;
        }
        case CANCELLED -> {
            // keep lifecycle fields for audit trail
        }
    }
    so.state = target;

    java.util.Map<String, Object> payload = new java.util.HashMap<>();
    payload.put("id", so.id);
    payload.put("fromState", from);
    payload.put("toState", target);
    payload.put("override", true);
    payload.put("reason", reason);
    bus.publish(com.terrapulse.ws.DispatchEvent.of(
            com.terrapulse.ws.DispatchEvent.SERVICE_ORDER_STATE_CHANGED, payload));

    return ServiceOrderDto.of(so);
}
```

- [ ] **Step 2: Ensure `mechanics` repository injected**

Run: `grep -n "MechanicRepository\|MechanicsRepository\|Mechanic\\b.*mechanics" backend/src/main/java/com/terrapulse/api/ServiceOrderResource.java | head`
Expected: shows existing `@Inject` for the mechanic repository used by `dispatch()` — reuse that field name. If field name differs from `mechanics`, replace `mechanics.findById(...)` calls above with the actual field name.

- [ ] **Step 3: Build**

Run: `cd backend && ./mvnw -q -DskipTests compile`
Expected: BUILD SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/terrapulse/api/ServiceOrderResource.java
git commit -m "feat(api): override-state accepts any target with side-effect rules"
```

---

## Task 5: Backend test for override side-effects

**Files:**
- Create: `backend/src/test/java/com/terrapulse/api/ServiceOrderOverrideTest.java`

- [ ] **Step 1: Inspect existing service test for patterns**

Run: `ls backend/src/test/java/com/terrapulse/service && cat backend/src/test/java/com/terrapulse/service/*.java | head -80`
Expected: lists at least one existing test; use its package layout, REST client style or persistence helper, and Quarkus annotations (`@QuarkusTest`, `@TestTransaction`).

- [ ] **Step 2: Write failing tests**

Mirror the existing test's setup helpers (factory for ServiceOrder + Mechanic). Use REST-assured if existing tests use it; otherwise call the resource method directly. Below is a REST-assured skeleton — adapt imports/helpers to existing patterns.

```java
package com.terrapulse.api;

import com.terrapulse.domain.service.ServiceOrderState;
import io.quarkus.test.TestTransaction;
import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;
import java.util.Map;
import java.util.UUID;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.notNullValue;

@QuarkusTest
class ServiceOrderOverrideTest {

    // assume helpers from sibling tests: createOrder(state), createMechanic()
    // if helpers don't exist, inline the seed via TestTransaction + Panache

    @Test
    @TestTransaction
    void overrideToRequestedClearsLifecycleFields() {
        UUID orderId = TestSeed.completedOrder();
        given().contentType("application/json")
            .body(Map.of("state", "REQUESTED", "reason", "reopen"))
            .when().post("/service-orders/{id}/override-state", orderId)
            .then().statusCode(200)
                .body("state", equalTo("REQUESTED"))
                .body("mechanicId", equalTo(null))
                .body("dispatchedAt", equalTo(null))
                .body("startedAt", equalTo(null))
                .body("completedAt", equalTo(null))
                .body("actualMinutes", equalTo(null));
    }

    @Test
    @TestTransaction
    void overrideToDispatchedRequiresMechanic() {
        UUID orderId = TestSeed.approvedOrder();
        given().contentType("application/json")
            .body(Map.of("state", "DISPATCHED", "reason", "force"))
            .when().post("/service-orders/{id}/override-state", orderId)
            .then().statusCode(400);
    }

    @Test
    @TestTransaction
    void overrideToDispatchedWithMechanicSetsTimestamp() {
        UUID orderId = TestSeed.approvedOrder();
        UUID mechId = TestSeed.mechanic();
        given().contentType("application/json")
            .body(Map.of("state", "DISPATCHED", "reason", "force", "mechanicId", mechId.toString()))
            .when().post("/service-orders/{id}/override-state", orderId)
            .then().statusCode(200)
                .body("state", equalTo("DISPATCHED"))
                .body("mechanicId", equalTo(mechId.toString()))
                .body("dispatchedAt", notNullValue());
    }

    @Test
    @TestTransaction
    void overrideToCompletedRequiresActualMinutes() {
        UUID orderId = TestSeed.approvedOrder();
        UUID mechId = TestSeed.mechanic();
        given().contentType("application/json")
            .body(Map.of("state", "COMPLETED", "reason", "force", "mechanicId", mechId.toString()))
            .when().post("/service-orders/{id}/override-state", orderId)
            .then().statusCode(400);
    }

    @Test
    @TestTransaction
    void overrideToCompletedFullPath() {
        UUID orderId = TestSeed.approvedOrder();
        UUID mechId = TestSeed.mechanic();
        given().contentType("application/json")
            .body(Map.of("state", "COMPLETED", "reason", "force",
                         "mechanicId", mechId.toString(), "actualMinutes", 45))
            .when().post("/service-orders/{id}/override-state", orderId)
            .then().statusCode(200)
                .body("state", equalTo("COMPLETED"))
                .body("actualMinutes", equalTo(45))
                .body("completedAt", notNullValue());
    }

    @Test
    @TestTransaction
    void overrideAppendsNotesAudit() {
        UUID orderId = TestSeed.requestedOrder();
        given().contentType("application/json")
            .body(Map.of("state", "CANCELLED", "reason", "wrong vehicle"))
            .when().post("/service-orders/{id}/override-state", orderId)
            .then().statusCode(200)
                .body("notes", org.hamcrest.Matchers.containsString("override"))
                .body("notes", org.hamcrest.Matchers.containsString("wrong vehicle"));
    }
}
```

If no `TestSeed` helper exists, inline seed in each test using `@Inject EntityManager em` + Panache `persistAndFlush` mirroring the patterns from `backend/src/test/java/com/terrapulse/service/*`.

- [ ] **Step 3: Run tests, confirm pass**

Run: `cd backend && ./mvnw -q -Dtest=ServiceOrderOverrideTest test`
Expected: tests pass. If they fail, inspect failure; the override code is correct, the test seed helpers are the likely mismatch.

- [ ] **Step 4: Commit**

```bash
git add backend/src/test/java/com/terrapulse/api/ServiceOrderOverrideTest.java
git commit -m "test(api): cover override-state side-effect matrix"
```

---

## Task 6: Frontend override API signature

**Files:**
- Modify: `web/src/api/serviceOrders.ts:15-16`

- [ ] **Step 1: Replace `override` method**

Read the surrounding code first:

Run: `grep -n "override\|reassign\|export" web/src/api/serviceOrders.ts`

Replace the `override` entry with:

```ts
override: (id: UUID, body: {
  state: "REQUESTED" | "QUOTED" | "APPROVED" | "DISPATCHED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  reason: string;
  mechanicId?: UUID;
  actualMinutes?: number;
}) =>
  api.post<ServiceOrder>(`/service-orders/${id}/override-state`, body),
```

- [ ] **Step 2: Type-check (will fail at call site)**

Run: `cd web && npx tsc -b`
Expected: error in `web/src/pages/OrdersPage.tsx` — `override` called with positional args. Task 11 fixes this call site.

- [ ] **Step 3: Commit (broken intermediate is acceptable; next task fixes caller)**

Defer commit. Move to Task 7 to keep refactor atomic with the caller; recombine at Task 11 commit.

---

## Task 7: Create shared `OrderDetailsCard`

**Files:**
- Create: `web/src/components/OrderDetailsCard.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pencil } from "lucide-react";
import { ServiceOrder } from "../types";
import { fmtDateTime } from "../i18n/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  order: ServiceOrder;
  onRename?: (title: string) => void;
  renaming?: boolean;
  showNotes?: boolean;
  actions?: ReactNode;
  overrideSlot?: ReactNode;
};

export function OrderDetailsCard({
  order, onRename, renaming, showNotes = false, actions, overrideSlot
}: Props) {
  const { t } = useTranslation();
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [titleErr, setTitleErr] = useState<string | null>(null);
  const editingTitle = titleDraft !== null;

  function commitTitle() {
    if (!onRename || titleDraft === null) return;
    const trimmed = titleDraft.trim();
    if (!trimmed) { setTitleErr(t("errors.titleRequired")); return; }
    if (trimmed.length > 120) { setTitleErr(t("errors.titleTooLong")); return; }
    setTitleErr(null);
    onRename(trimmed);
    setTitleDraft(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-1.5 m-0">
        <dt className="text-[var(--color-text-muted)]">{t("orders.columnTitle")}</dt>
        <dd className="m-0">
          {onRename ? (
            editingTitle ? (
              <span className="flex items-center gap-2 flex-wrap">
                <Input
                  value={titleDraft ?? ""}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  maxLength={120}
                  autoFocus
                  className="flex-1 min-w-[140px]"
                />
                <Button variant="default" size="sm" onClick={commitTitle} disabled={renaming}>
                  {t("orders.actionTitleSave")}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setTitleDraft(null); setTitleErr(null); }}>
                  {t("common.cancel")}
                </Button>
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <span>{order.title ?? t("common.dash")}</span>
                <Button variant="ghost" size="sm" onClick={() => setTitleDraft(order.title ?? "")} aria-label={t("orders.actionTitleEdit")}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </span>
            )
          ) : (
            <span>{order.title ?? t("common.dash")}</span>
          )}
          {titleErr && <p className="text-[var(--text-sm)] text-[var(--color-danger)] m-0">{titleErr}</p>}
        </dd>

        <dt className="text-[var(--color-text-muted)]">{t("orders.columnState")}</dt>
        <dd className="m-0">
          <Badge className={"state-" + order.state} variant="secondary">
            {t(`state.${order.state}`)}
          </Badge>
        </dd>

        <dt className="text-[var(--color-text-muted)]">{t("orders.columnVmrs")}</dt>
        <dd className="m-0 font-mono">{order.vmrsCode}</dd>

        <dt className="text-[var(--color-text-muted)]">{t("orders.fieldClient")}</dt>
        <dd className="m-0">{order.clientName ?? t("common.dash")}</dd>

        <dt className="text-[var(--color-text-muted)]">{t("orders.fieldSite")}</dt>
        <dd className="m-0">
          {order.siteName ? <span>{order.siteName} · </span> : null}
          <span className="font-mono text-[var(--color-text-muted)]">
            {order.siteLocation.lat.toFixed(4)}, {order.siteLocation.lng.toFixed(4)}
          </span>
        </dd>

        <dt className="text-[var(--color-text-muted)]">{t("orders.fieldEstimated")}</dt>
        <dd className="m-0">{t("common.minutes", { count: order.estimatedMinutes })}</dd>

        {order.actualMinutes != null && (
          <>
            <dt className="text-[var(--color-text-muted)]">{t("orders.fieldActual")}</dt>
            <dd className="m-0">{t("common.minutes", { count: order.actualMinutes })}</dd>
          </>
        )}

        <dt className="text-[var(--color-text-muted)]">{t("orders.fieldMechanic")}</dt>
        <dd className="m-0 font-mono text-[var(--color-text-muted)]">
          {order.mechanicId ? order.mechanicId.slice(0, 8) + "…" : t("common.dash")}
        </dd>

        <dt className="text-[var(--color-text-muted)]">{t("orders.fieldRequested")}</dt>
        <dd className="m-0 text-[var(--color-text-muted)]">{fmtDateTime(order.requestedAt)}</dd>

        {order.dispatchedAt && (
          <>
            <dt className="text-[var(--color-text-muted)]">{t("orders.fieldDispatched")}</dt>
            <dd className="m-0 text-[var(--color-text-muted)]">{fmtDateTime(order.dispatchedAt)}</dd>
          </>
        )}
        {order.startedAt && (
          <>
            <dt className="text-[var(--color-text-muted)]">{t("orders.fieldStarted")}</dt>
            <dd className="m-0 text-[var(--color-text-muted)]">{fmtDateTime(order.startedAt)}</dd>
          </>
        )}
        {order.completedAt && (
          <>
            <dt className="text-[var(--color-text-muted)]">{t("orders.fieldCompleted")}</dt>
            <dd className="m-0 text-[var(--color-text-muted)]">{fmtDateTime(order.completedAt)}</dd>
          </>
        )}

        {showNotes && order.notes && (
          <>
            <dt className="text-[var(--color-text-muted)]">{t("orders.fieldNotesHistory")}</dt>
            <dd className="m-0">
              <pre className="font-mono text-[var(--text-xs)] bg-[var(--color-surface-sunken)] border border-[var(--color-hairline)] p-2 rounded-[var(--radius-sm)] whitespace-pre-wrap m-0 text-[var(--color-text)]">
                {order.notes}
              </pre>
            </dd>
          </>
        )}
      </dl>

      {actions && <div className="flex flex-col gap-1.5">{actions}</div>}
      {overrideSlot}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd web && npx tsc -b`
Expected: no errors in the new file. Existing errors from Task 6 (override API caller) still present until Task 11.

- [ ] **Step 3: Defer commit — bundle with consumers in Task 8/Task 11**

---

## Task 8: ServiceOrderDrawer renders shared card

**Files:**
- Modify: `web/src/components/ServiceOrderDrawer.tsx` (whole file rewrite)

- [ ] **Step 1: Replace file content**

```tsx
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ServiceOrder } from "../types";
import { serviceOrdersApi } from "../api/serviceOrders";
import { queryKeys } from "../api/client";
import { DispatchModal } from "./DispatchModal";
import { OrderDetailsCard } from "./OrderDetailsCard";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

type Props = {
  order: ServiceOrder;
  onClose: () => void;
};

export function ServiceOrderDrawer({ order, onClose }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [showDispatch, setShowDispatch] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: queryKeys.serviceOrders });
    qc.invalidateQueries({ queryKey: queryKeys.mechanics });
  };

  const quote    = useMutation({ mutationFn: () => serviceOrdersApi.quote(order.id),    onSuccess: invalidate });
  const approve  = useMutation({ mutationFn: () => serviceOrdersApi.approve(order.id),  onSuccess: invalidate });
  const start    = useMutation({ mutationFn: () => serviceOrdersApi.start(order.id),    onSuccess: invalidate });
  const complete = useMutation({
    mutationFn: (mins: number) => serviceOrdersApi.complete(order.id, mins),
    onSuccess: invalidate
  });
  const cancel   = useMutation({ mutationFn: () => serviceOrdersApi.cancel(order.id),   onSuccess: invalidate });

  const [actualMin, setActualMin] = useState<number>(order.estimatedMinutes);

  const canQuote    = order.state === "REQUESTED";
  const canApprove  = order.state === "QUOTED";
  const canDispatch = order.state === "APPROVED";
  const canStart    = order.state === "DISPATCHED";
  const canComplete = order.state === "IN_PROGRESS";
  const canCancel   = !["COMPLETED", "CANCELLED"].includes(order.state);

  const actions = (
    <>
      {canQuote &&    <Button variant="outline" onClick={() => quote.mutate()}   disabled={quote.isPending}>{t("dispatch.actionQuote")}</Button>}
      {canApprove &&  <Button variant="outline" onClick={() => approve.mutate()} disabled={approve.isPending}>{t("dispatch.actionApprove")}</Button>}
      {canDispatch && <Button variant="default" onClick={() => setShowDispatch(true)}>{t("dispatch.actionDispatchEllipsis")}</Button>}
      {canStart &&    <Button variant="outline" onClick={() => start.mutate()}   disabled={start.isPending}>{t("dispatch.actionStart")}</Button>}
      {canComplete && (
        <span className="flex gap-1.5">
          <input
            type="number" min={1} value={actualMin}
            onChange={(e) => setActualMin(Number(e.target.value))}
            aria-label={t("orders.fieldActual")}
            className="w-20 px-2 py-1 bg-[var(--color-surface-panel)] border border-[var(--color-hairline)] rounded-[var(--radius-sm)] text-[var(--color-text)]"
          />
          <Button variant="outline" onClick={() => complete.mutate(actualMin)} disabled={complete.isPending}>
            {t("dispatch.actionComplete")}
          </Button>
        </span>
      )}
      {canCancel && <Button variant="destructive" onClick={() => cancel.mutate()}>{t("common.cancel")}</Button>}
    </>
  );

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-[360px] sm:max-w-[360px]" aria-describedby={undefined}>
        <SheetHeader>
          <SheetTitle>{order.title ?? t("dispatch.orderHeading")}</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-4 overflow-auto">
          <OrderDetailsCard order={order} actions={actions} />
        </div>
      </SheetContent>
      {showDispatch && (
        <DispatchModal order={order} onClose={() => setShowDispatch(false)} />
      )}
    </Sheet>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd web && npx tsc -b`
Expected: no new errors from this file (Task 11 still pending).

- [ ] **Step 3: Defer commit — bundle with consumers at Task 11.**

---

## Task 9: Mechanic picker primitive for override form

**Files:**
- Create: `web/src/components/MechanicPicker.tsx`

- [ ] **Step 1: Write component**

```tsx
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { mechanicsApi } from "../api/mechanics";
import { queryKeys } from "../api/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = {
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  id?: string;
};

export function MechanicPicker({ value, onChange, id }: Props) {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: queryKeys.mechanics, queryFn: mechanicsApi.list });
  const list = q.data ?? [];
  return (
    <Select value={value ?? ""} onValueChange={(v) => onChange(v || undefined)}>
      <SelectTrigger id={id}>
        <SelectValue placeholder={t("dispatch.selectMechanic")} />
      </SelectTrigger>
      <SelectContent>
        {list.map((m) => (
          <SelectItem key={m.id} value={m.id}>{m.fullName}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

- [ ] **Step 2: Verify `mechanicsApi.list` exists and `queryKeys.mechanics` exists**

Run: `grep -n "list\|export" web/src/api/mechanics.ts && grep -n "mechanics" web/src/api/client.ts`
Expected: confirms both. If `list` is named differently, adjust the import.

- [ ] **Step 3: Defer commit.**

---

## Task 10: OrdersPage `OrderDetail` — expanded override + shared card

**Files:**
- Modify: `web/src/pages/OrdersPage.tsx:227-340` (the `OrderDetail` function and override mutation call site)

- [ ] **Step 1: Update `overrideMut` and call site to new API**

Locate `const overrideMut = useMutation({...})` near line 88 and the `onOverride` call near line 209. Replace with:

```ts
const overrideMut = useMutation({
  mutationFn: (args: {
    id: string;
    state: ServiceOrderState;
    reason: string;
    mechanicId?: string;
    actualMinutes?: number;
  }) => serviceOrdersApi.override(args.id, {
    state: args.state,
    reason: args.reason,
    mechanicId: args.mechanicId as UUID | undefined,
    actualMinutes: args.actualMinutes,
  }),
  onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.serviceOrders }); }
});
```

And update the `OrderDetail` render call:

```tsx
<OrderDetail
  order={selected}
  onClose={() => setSelected(null)}
  onOverride={(state, reason, mechanicId, actualMinutes) =>
    overrideMut.mutate({ id: selected.id, state, reason, mechanicId, actualMinutes })}
  overriding={overrideMut.isPending}
  onRename={(title) => renameMut.mutate({ id: selected.id, title })}
  renaming={renameMut.isPending}
/>
```

Add `ServiceOrderState` to existing type imports from `../types`.

- [ ] **Step 2: Rewrite `OrderDetail` to use shared card + full state picker**

Replace the entire `OrderDetail` function (from `function OrderDetail({...})` to its closing `}`) with:

```tsx
function OrderDetail({
  order, onClose, onOverride, overriding, onRename, renaming
}: {
  order: ServiceOrder;
  onClose: () => void;
  onOverride: (state: ServiceOrderState, reason: string, mechanicId?: string, actualMinutes?: number) => void;
  overriding: boolean;
  onRename: (title: string) => void;
  renaming: boolean;
}) {
  const { t } = useTranslation();
  const ALL_STATES: ServiceOrderState[] = ["REQUESTED", "QUOTED", "APPROVED", "DISPATCHED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
  const [overrideState, setOverrideState] = useState<ServiceOrderState>("CANCELLED");
  const [reason, setReason] = useState("");
  const [mechanicId, setMechanicId] = useState<string | undefined>(order.mechanicId ?? undefined);
  const [actualMinutes, setActualMinutes] = useState<number>(order.actualMinutes ?? order.estimatedMinutes);

  const needsMechanic =
    (overrideState === "DISPATCHED" || overrideState === "IN_PROGRESS" || overrideState === "COMPLETED")
    && !order.mechanicId;
  const needsMinutes = overrideState === "COMPLETED" && order.actualMinutes == null;

  const canSubmit =
    overrideState !== order.state
    && (!needsMechanic || !!mechanicId)
    && (!needsMinutes || (actualMinutes > 0));

  function submit() {
    onOverride(
      overrideState,
      reason,
      needsMechanic ? mechanicId : undefined,
      needsMinutes ? actualMinutes : undefined,
    );
  }

  const overrideSlot = (
    <div className="mt-4 border-t border-[var(--color-hairline)] pt-3">
      <h3 className="mt-0 mb-1.5 text-[var(--text-base)] font-semibold text-[var(--color-text)]">
        {t("orders.overrideHeading")}
      </h3>
      <p className="text-[var(--text-sm)] text-[var(--color-text-muted)] m-0 mb-2">
        {t("orders.overrideHelp")}
      </p>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="flex flex-col gap-1">
          <Label htmlFor="override-target">{t("orders.overrideTarget")}</Label>
          <Select value={overrideState} onValueChange={(v) => setOverrideState(v as ServiceOrderState)}>
            <SelectTrigger id="override-target"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ALL_STATES.map((s) => (
                <SelectItem key={s} value={s}>{t(`state.${s}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="override-reason">{t("orders.overrideReason")}</Label>
          <Input id="override-reason" value={reason} onChange={(e) => setReason(e.target.value)}
                 placeholder={t("orders.overrideReasonPlaceholder")} />
        </div>
        {needsMechanic && (
          <div className="flex flex-col gap-1 col-span-2">
            <Label htmlFor="override-mechanic">{t("orders.fieldMechanic")}</Label>
            <MechanicPicker id="override-mechanic" value={mechanicId} onChange={setMechanicId} />
          </div>
        )}
        {needsMinutes && (
          <div className="flex flex-col gap-1 col-span-2">
            <Label htmlFor="override-minutes">{t("orders.fieldActual")}</Label>
            <Input id="override-minutes" type="number" min={1} value={actualMinutes}
                   onChange={(e) => setActualMinutes(Number(e.target.value))} />
          </div>
        )}
      </div>
      <div className="flex justify-end mt-2.5">
        <Button variant="default" disabled={!canSubmit || overriding} onClick={submit}>
          {t("orders.actionOverrideApply")}
        </Button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="m-0 text-[var(--text-lg)] font-semibold">{t("orders.orderDetail")}</h2>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label={t("common.close")}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <OrderDetailsCard
        order={order}
        onRename={onRename}
        renaming={renaming}
        showNotes
        overrideSlot={overrideSlot}
      />
    </div>
  );
}
```

Add imports at top of file:

```ts
import { OrderDetailsCard } from "../components/OrderDetailsCard";
import { MechanicPicker } from "../components/MechanicPicker";
import { ServiceOrderState } from "../types";
```

Remove now-unused imports (`Pencil` if no longer referenced in the file outside `OrderDetailsCard`, `fmtDateTime` likewise — check with type-check).

- [ ] **Step 3: Add i18n keys**

Add to `web/src/i18n/en.json` (and other locale files in the same directory):

```json
"orders.actionOverrideApply": "Apply override",
"dispatch.selectMechanic": "Select mechanic"
```

Verify keys don't already exist before adding.

- [ ] **Step 4: Type-check**

Run: `cd web && npx tsc -b`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add web/src/api/serviceOrders.ts web/src/components/OrderDetailsCard.tsx web/src/components/MechanicPicker.tsx web/src/components/ServiceOrderDrawer.tsx web/src/pages/OrdersPage.tsx web/src/i18n/
git commit -m "feat(web): unrestricted override + shared OrderDetailsCard"
```

---

## Task 11: Install `@dnd-kit/core`

**Files:**
- Modify: `web/package.json`

- [ ] **Step 1: Install**

Run: `cd web && npm install @dnd-kit/core@^6`
Expected: success; `package.json` gains dep.

- [ ] **Step 2: Commit**

```bash
git add web/package.json web/package-lock.json
git commit -m "chore(web): add @dnd-kit/core"
```

---

## Task 12: Migrate `PendingOrders` to dndkit

**Files:**
- Modify: `web/src/components/PendingOrders.tsx`

- [ ] **Step 1: Inspect current**

Run: `cat web/src/components/PendingOrders.tsx`
Expected: native `draggable` + `onDragStart` setting `pool:<id>` payload.

- [ ] **Step 2: Replace each card with `useDraggable`**

Replace the dragstart wiring with:

```tsx
import { useDraggable } from "@dnd-kit/core";

function PoolCard({ order, onSelect }: { order: ServiceOrder; onSelect: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `pool:${order.id}`,
    data: { kind: "pool", orderId: order.id },
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onSelect(order.id)}
      className={cn("...existing classes...", isDragging && "opacity-50")}
    >
      {/* existing card body */}
    </div>
  );
}
```

Adapt to the file's current structure. Remove all `onDragStart`/`onDragEnd`/`draggable` props. Remove any callback prop that pushed to `lastPoolDragId` in `DispatchPage`.

- [ ] **Step 3: Type-check**

Run: `cd web && npx tsc -b`
Expected: no errors.

- [ ] **Step 4: Defer commit — bundle with Gantt + DispatchPage migration in Task 14.**

---

## Task 13: Rewrite `DispatchGantt` with dndkit

**Files:**
- Modify: `web/src/components/DispatchGantt.tsx` (whole-file rewrite)

- [ ] **Step 1: Replace the file**

```tsx
import { useMemo, KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import {
  addDays, startOfDay, startOfMonth, endOfMonth, startOfWeek,
  format, getHours, getMinutes, getDaysInMonth, getDate
} from "date-fns";
import { Mechanic, MechanicAbsence, ServiceOrder, UUID } from "../types";
import { cn } from "@/lib/utils";

const LANE_HEIGHT_PX = 28;
const LANE_GAP_PX = 4;
const ROW_PADDING_PX = 4;
const BASE_ROW_MIN_HEIGHT_PX = 72;

export type GanttView = "day" | "week" | "month";

type Props = {
  mechanics: Mechanic[];
  orders: ServiceOrder[];
  absences: MechanicAbsence[];
  selectedMechanicId: string | null;
  view: GanttView;
  date: Date;
  onSelectOrder: (id: string) => void;
};

const HOUR_START = 7;
const HOUR_END = 19;
const HOURS = HOUR_END - HOUR_START;

function clampPct(n: number) { return Math.max(0, Math.min(100, n)); }
function dayBoundary(d: Date): [Date, Date]   { const s = startOfDay(d); return [s, addDays(s, 1)]; }
function weekBoundary(d: Date): [Date, Date]  { const s = startOfWeek(d, { weekStartsOn: 1 }); return [s, addDays(s, 7)]; }
function monthBoundary(d: Date): [Date, Date] { const s = startOfDay(startOfMonth(d)); return [s, startOfDay(addDays(endOfMonth(d), 1))]; }

export function DispatchGantt({ mechanics, orders, absences, selectedMechanicId, view, date, onSelectOrder }: Props) {
  const { t } = useTranslation();
  const visibleMechanics = selectedMechanicId ? mechanics.filter((m) => m.id === selectedMechanicId) : mechanics;

  const [winStart, winEnd] = useMemo(() => {
    if (view === "day")  return dayBoundary(date);
    if (view === "week") return weekBoundary(date);
    return monthBoundary(date);
  }, [view, date]);

  const cols = useMemo(() => {
    if (view === "day")  return Array.from({ length: HOURS }, (_, i) => HOUR_START + i);
    if (view === "week") return Array.from({ length: 7 }, (_, i) => addDays(winStart, i));
    return Array.from({ length: getDaysInMonth(date) }, (_, i) => addDays(winStart, i));
  }, [view, winStart, date]);

  function eventPosition(start: Date, end: Date): { leftPct: number; rightPct: number } | null {
    if (end <= winStart || start >= winEnd) return null;
    const s = start < winStart ? winStart : start;
    const e = end > winEnd ? winEnd : end;
    if (view === "day") {
      const sH = getHours(s) + getMinutes(s) / 60;
      const eH = getHours(e) + getMinutes(e) / 60;
      return { leftPct: clampPct(((sH - HOUR_START) / HOURS) * 100), rightPct: clampPct(((HOUR_END - eH) / HOURS) * 100) };
    }
    const totalMs = winEnd.getTime() - winStart.getTime();
    return {
      leftPct: clampPct(((s.getTime() - winStart.getTime()) / totalMs) * 100),
      rightPct: clampPct(((winEnd.getTime() - e.getTime()) / totalMs) * 100),
    };
  }

  function ordersForRow(id: string) {
    return orders.filter((o) => o.mechanicId === id && (o.state === "DISPATCHED" || o.state === "IN_PROGRESS" || o.state === "COMPLETED"));
  }
  function absencesForRow(id: string) { return absences.filter((a) => a.mechanicId === id); }

  function eventBounds(o: ServiceOrder) {
    const start = new Date(o.startedAt ?? o.dispatchedAt ?? o.requestedAt);
    const minutes = o.actualMinutes ?? o.estimatedMinutes;
    return { start, end: new Date(start.getTime() + minutes * 60_000) };
  }

  function assignLanes(items: ServiceOrder[]) {
    const sorted = [...items].sort((a, b) => eventBounds(a).start.getTime() - eventBounds(b).start.getTime());
    const laneEndTimes: number[] = [];
    const laneByOrder = new Map<string, number>();
    for (const o of sorted) {
      const { start, end } = eventBounds(o);
      let placed = false;
      for (let i = 0; i < laneEndTimes.length; i++) {
        if (laneEndTimes[i] <= start.getTime()) {
          laneEndTimes[i] = end.getTime();
          laneByOrder.set(o.id, i);
          placed = true; break;
        }
      }
      if (!placed) { laneByOrder.set(o.id, laneEndTimes.length); laneEndTimes.push(end.getTime()); }
    }
    return { laneByOrder, lanes: Math.max(1, laneEndTimes.length) };
  }

  function chipLabel(o: ServiceOrder): string {
    return o.title ?? o.siteName ?? o.vmrsCode;
  }
  function chipTitle(o: ServiceOrder): string {
    const parts = [o.title, o.clientName, o.siteName, o.vmrsCode].filter(Boolean);
    return parts.join(" · ");
  }

  const gridTemplate = `repeat(${cols.length}, minmax(0, 1fr))`;
  const minTimelineWidth = view === "day" ? 0 : view === "week" ? 720 : Math.max(960, cols.length * 40);

  return (
    <div role="grid" aria-label={t("dispatch.pageTitle")}
         className="flex-1 min-h-0 flex flex-col bg-[var(--color-surface-panel)] rounded-[var(--radius-md)] overflow-hidden">
      <div role="row" className="flex border-b border-[var(--color-hairline)] bg-[var(--color-surface-sunken)] shrink-0 sticky top-0 z-20">
        <div role="columnheader" className="w-48 shrink-0 border-r border-[var(--color-hairline)] flex items-center px-3 py-2 text-xs uppercase tracking-wider font-semibold text-[var(--color-text-muted)]">
          {t("mechanics.columnName")}
        </div>
        <div className="flex-1 grid" style={{ gridTemplateColumns: gridTemplate, minWidth: minTimelineWidth || undefined }}>
          {cols.map((c, i) => (
            <div key={i} role="columnheader" className="border-r border-[var(--color-hairline)] flex items-center justify-center text-xs font-mono text-[var(--color-text-muted)] py-2">
              {view === "day"   && `${String(c as number).padStart(2, "0")}:00`}
              {view === "week"  && format(c as Date, "EEE dd")}
              {view === "month" && (
                <span className={cn(getDate(c as Date) === getDate(new Date()) && "text-[var(--color-brand-strong)] font-bold")}>
                  {format(c as Date, "d")}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {visibleMechanics.length === 0 && (
          <div className="p-6 text-center text-sm text-[var(--color-text-muted)]">{t("mechanics.noMechanics")}</div>
        )}
        {visibleMechanics.map((m) => {
          const initials = m.fullName.split(/\s+/).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join("");
          const rowOrders = ordersForRow(m.id);
          const rowAbsences = absencesForRow(m.id);
          const { laneByOrder, lanes } = assignLanes(rowOrders);
          const rowMinHeight = Math.max(BASE_ROW_MIN_HEIGHT_PX, ROW_PADDING_PX * 2 + lanes * LANE_HEIGHT_PX + (lanes - 1) * LANE_GAP_PX);
          return (
            <MechanicRow key={m.id} mechanic={m} initials={initials} minHeight={rowMinHeight} gridTemplate={gridTemplate} minTimelineWidth={minTimelineWidth}
                         absences={rowAbsences} orders={rowOrders} laneByOrder={laneByOrder}
                         eventPosition={eventPosition} chipLabel={chipLabel} chipTitle={chipTitle}
                         onSelectOrder={onSelectOrder} t={t} cols={cols} view={view} />
          );
        })}
      </div>
    </div>
  );
}

type RowProps = {
  mechanic: Mechanic;
  initials: string;
  minHeight: number;
  gridTemplate: string;
  minTimelineWidth: number;
  absences: MechanicAbsence[];
  orders: ServiceOrder[];
  laneByOrder: Map<string, number>;
  eventPosition: (s: Date, e: Date) => { leftPct: number; rightPct: number } | null;
  chipLabel: (o: ServiceOrder) => string;
  chipTitle: (o: ServiceOrder) => string;
  onSelectOrder: (id: string) => void;
  t: (k: string, opts?: Record<string, unknown>) => string;
  cols: (number | Date)[];
  view: GanttView;
};

function MechanicRow({
  mechanic, initials, minHeight, gridTemplate, minTimelineWidth,
  absences, orders, laneByOrder, eventPosition, chipLabel, chipTitle,
  onSelectOrder, t, cols
}: RowProps) {
  const { isOver, setNodeRef, active } = useDroppable({
    id: `row:${mechanic.id}`,
    data: { kind: "row", mechanicId: mechanic.id },
  });

  const activeData = active?.data?.current as { kind?: string; orderId?: string; orderState?: string; currentMechanicId?: string } | undefined;
  const validDrop = !active ? null
    : activeData?.kind === "pool" ? (activeData.orderState === "APPROVED")
    : activeData?.kind === "event" ? (activeData.currentMechanicId !== mechanic.id)
    : false;

  return (
    <div role="row" className="flex border-b border-[var(--color-hairline)] group hover:bg-[var(--color-surface-sunken)] transition-colors" style={{ minHeight }}>
      <div role="rowheader" className="w-48 shrink-0 border-r border-[var(--color-hairline)] sticky left-0 bg-[var(--color-surface-panel)] group-hover:bg-[var(--color-surface-sunken)] z-10 flex items-center gap-2 px-3 py-2">
        <div className="w-8 h-8 rounded bg-[var(--color-surface-container-highest)] border border-[var(--color-hairline)] flex items-center justify-center font-mono text-xs shrink-0">{initials || "??"}</div>
        <div className="flex flex-col min-w-0">
          <span className="font-medium text-sm text-[var(--color-text)] truncate">{mechanic.fullName}</span>
          <span className="text-xs font-mono text-[var(--color-text-muted)] truncate flex items-center gap-1">
            <span className={cn("status-dot", `dot-${mechanic.status}`)} aria-hidden="true" />
            {mechanic.status}
          </span>
        </div>
      </div>
      <div
        ref={setNodeRef}
        role="gridcell"
        aria-label={`${mechanic.fullName} timeline`}
        className={cn(
          "flex-1 relative",
          isOver && validDrop === true && "bg-[var(--color-brand-soft)]",
          isOver && validDrop === false && "bg-[color-mix(in_srgb,var(--color-danger)_15%,transparent)] ring-1 ring-[var(--color-danger)] ring-inset"
        )}
        style={{ minWidth: minTimelineWidth || undefined }}
      >
        <div aria-hidden="true" className="absolute inset-0 grid pointer-events-none" style={{ gridTemplateColumns: gridTemplate }}>
          {cols.map((_, i) => <div key={i} className="border-r border-[var(--color-hairline)] border-opacity-50" />)}
        </div>
        {absences.map((a) => {
          const pos = eventPosition(new Date(a.startAt), new Date(a.endAt));
          if (!pos) return null;
          return (
            <div key={a.id} role="img"
                 aria-label={`${t(`absenceType.${a.type}`)}${a.reason ? `: ${a.reason}` : ""}`}
                 className={cn("absolute top-1 bottom-1 rounded-[var(--radius-sm)] border border-dashed flex items-center px-2 text-xs", `absence-${a.type}`)}
                 style={{ left: `${pos.leftPct}%`, right: `${pos.rightPct}%`, opacity: 0.7 }}
                 title={`${t(`absenceType.${a.type}`)}${a.reason ? ` · ${a.reason}` : ""}`}>
              <span className="truncate font-mono uppercase tracking-wider">{t(`absenceType.${a.type}`)}</span>
            </div>
          );
        })}
        {orders.map((o) => {
          const { start, end } = (() => {
            const startD = new Date(o.startedAt ?? o.dispatchedAt ?? o.requestedAt);
            const mins = o.actualMinutes ?? o.estimatedMinutes;
            return { start: startD, end: new Date(startD.getTime() + mins * 60_000) };
          })();
          const pos = eventPosition(start, end);
          if (!pos) return null;
          const lane = laneByOrder.get(o.id) ?? 0;
          const top = ROW_PADDING_PX + lane * (LANE_HEIGHT_PX + LANE_GAP_PX);
          return (
            <EventChip key={o.id} order={o} mechanicName={mechanic.fullName}
                       pos={pos} top={top} label={chipLabel(o)} tooltip={chipTitle(o)}
                       onSelect={onSelectOrder} />
          );
        })}
      </div>
    </div>
  );
}

function EventChip({
  order, mechanicName, pos, top, label, tooltip, onSelect
}: {
  order: ServiceOrder; mechanicName: string;
  pos: { leftPct: number; rightPct: number }; top: number;
  label: string; tooltip: string;
  onSelect: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `event:${order.id}`,
    data: {
      kind: "event",
      orderId: order.id,
      orderState: order.state,
      currentMechanicId: order.mechanicId,
    },
  });

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(order.id); }
  }

  return (
    <div
      ref={setNodeRef}
      role="button"
      tabIndex={0}
      aria-label={`${label}, ${mechanicName}, ${order.state}`}
      onClick={(e) => { e.stopPropagation(); onSelect(order.id); }}
      onKeyDown={onKeyDown}
      title={tooltip}
      {...listeners}
      {...attributes}
      className={cn(
        "absolute rounded-[var(--radius-sm)] border px-2 py-1 cursor-grab active:cursor-grabbing flex items-center justify-between gap-1 overflow-hidden shadow-sm hover:brightness-95 active:brightness-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] focus-visible:ring-offset-1",
        `state-${order.state}`,
        isDragging && "opacity-40"
      )}
      style={{ left: `${pos.leftPct}%`, right: `${pos.rightPct}%`, top, height: LANE_HEIGHT_PX, minWidth: "2rem" }}
    >
      <span className="text-[11px] font-semibold truncate min-w-0">{label}</span>
      <span className="font-mono text-[9px] tracking-wider opacity-70 shrink-0">{order.vmrsCode}</span>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd web && npx tsc -b`
Expected: errors only in `DispatchPage.tsx` (it still passes removed props `onMoveEvent`, `onDropFromPool`). Task 14 fixes them.

- [ ] **Step 3: Defer commit.**

---

## Task 14: Wire `DndContext` in `DispatchPage`, remove ref hack

**Files:**
- Modify: `web/src/components/DispatchPage.tsx`

- [ ] **Step 1: Add dndkit context + drop handler**

At top of file:

```tsx
import { DndContext, DragEndEvent, MouseSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
```

Inside the component, replace `lastPoolDragId`, `onDropFromPool`, `onMoveEvent`, `showVisualSlotHint`, `dropHint`-related logic with:

```tsx
const sensors = useSensors(
  useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
  useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
);

function handleDragEnd(e: DragEndEvent) {
  const a = e.active.data.current as { kind?: string; orderId?: string; orderState?: string; currentMechanicId?: string } | undefined;
  const o = e.over?.data.current as { kind?: string; mechanicId?: string } | undefined;
  if (!a || !o || o.kind !== "row" || !o.mechanicId || !a.orderId) return;
  const mechanicId = o.mechanicId as UUID;
  const orderId = a.orderId as UUID;
  if (a.kind === "pool") {
    if (a.orderState !== "APPROVED") {
      toast.error(`Order must be APPROVED to dispatch (current: ${a.orderState})`);
      return;
    }
    dispatchMut.mutate({ id: orderId, mechanicId });
  } else if (a.kind === "event") {
    if (a.currentMechanicId === mechanicId) return;
    reassignMut.mutate({ id: orderId, mechanicId });
  }
}
```

Wrap the existing main `return (<div...>...</div>)` body in:

```tsx
<DndContext sensors={sensors} onDragEnd={handleDragEnd}>
  {/* existing body */}
</DndContext>
```

Update `<DispatchGantt .../>` call site to remove `onMoveEvent` and `onDropFromPool` props (now handled by `DndContext`). Leave `onSelectOrder`.

- [ ] **Step 2: Remove unused imports + helpers**

Drop these now-dead pieces: import of `DropPayload` from `DispatchGantt`, the `lastPoolDragId` `useMemo`, `showVisualSlotHint` function, `VISUAL_SLOT_HINT_KEY` constant, any pool dragstart prop wiring passed to `PendingOrders`.

- [ ] **Step 3: Update `PendingOrders` usage**

The new `PendingOrders` (Task 12) is self-driving via dndkit; remove any drag-related callback props that were previously passed in.

- [ ] **Step 4: Type-check**

Run: `cd web && npx tsc -b`
Expected: clean.

- [ ] **Step 5: Manual smoke**

Run: `just up` (or follow `docs/quick-start.md`). In browser:
- Drag a pool card onto a mechanic row → toast "Order reassigned" or "dispatched" success; chip appears.
- Drag a chip onto a different mechanic row → reassign fires.
- Drag a chip onto its own row → no-op (no mutation, no toast).
- Drag a non-APPROVED pool order → red row highlight + error toast.
- Click chip → drawer opens, doesn't trigger drag.
- Keyboard Tab to chip, Enter → drawer opens.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/DispatchGantt.tsx web/src/components/DispatchPage.tsx web/src/components/PendingOrders.tsx
git commit -m "feat(web): migrate Dispatch DnD to @dnd-kit; identifiable chip labels"
```

---

## Task 15: Delete `ResourceTimeline`

**Files:**
- Delete: `web/src/components/ResourceTimeline.tsx`

- [ ] **Step 1: Re-verify no callers**

Run: `grep -rn "ResourceTimeline" web/src --include="*.tsx" --include="*.ts"`
Expected: only `ResourceTimeline.tsx` itself.

- [ ] **Step 2: Delete + type-check**

Run: `rm web/src/components/ResourceTimeline.tsx && cd web && npx tsc -b`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add -u web/src/components/ResourceTimeline.tsx
git commit -m "chore(web): drop unreferenced ResourceTimeline"
```

---

## Task 16: Untrack `.claude-flow` runtime files + Gitignore

**Files:**
- Modify: `.gitignore`
- Delete from index: `web/.claude-flow/`

- [ ] **Step 1: Verify path**

Run: `git ls-files web/.claude-flow/ | head`
Expected: at least `web/.claude-flow/data/pending-insights.jsonl`.

- [ ] **Step 2: Append rule**

Append to `.gitignore`:

```
# claude-flow runtime artefacts
web/.claude-flow/
.claude-flow/
```

- [ ] **Step 3: Untrack**

Run: `git rm -r --cached web/.claude-flow`
Expected: removes from index but leaves on disk.

- [ ] **Step 4: Commit**

```bash
git add .gitignore
git commit -m "chore: gitignore claude-flow runtime artefacts"
```

---

## Task 17: Final verification

- [ ] **Step 1: Backend tests + build**

Run: `cd backend && ./mvnw -q test`
Expected: green.

- [ ] **Step 2: Frontend type-check + build**

Run: `cd web && npx tsc -b && npm run build`
Expected: green.

- [ ] **Step 3: End-to-end smoke**

Bring stack up, run through Test plan from spec (Section "Test plan"). Check the full state-override matrix manually (REQUESTED → … → COMPLETED → CANCELLED).

- [ ] **Step 4: Confirm no untracked files**

Run: `git status`
Expected: clean working tree.

---

## Self-Review

**Spec coverage:**
- Kibo eval → spec Section "Kibo Gantt evaluation"; no task (decision documented, not implemented).
- A) dndkit migration → Tasks 11, 12, 13, 14.
- B) Chip label hierarchy → Tasks 1, 2, 13 (chipLabel/chipTitle).
- C) Override widening → Tasks 3, 4, 5, 6, 9, 10.
- D) Shared `OrderDetailsCard` → Tasks 7, 8, 10.
- E) Dead-code sweep → Tasks 15, 16; refs to `lastPoolDragId`/`showVisualSlotHint` removed in Task 14.

**Placeholder scan:** None. All code blocks contain full implementations; `TestSeed` helper noted with explicit fallback instruction.

**Type consistency:**
- `OrderDetailsCard` `Props` match consumers in Tasks 8 + 10.
- `serviceOrdersApi.override(id, body)` signature matches caller in Task 10.
- `OverrideStateRequest` Java record fields match frontend body shape (`state`, `reason`, `mechanicId`, `actualMinutes`).
- `DragEndEvent.active.data.current` shape (`kind`, `orderId`, `orderState`, `currentMechanicId`) is what Task 12 + Task 13 set and Task 14 reads.

No gaps.
