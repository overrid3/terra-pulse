# Dispatch view fixes — design

Date: 2026-05-15
Scope: Dispatch Gantt DnD reliability, event labels, unrestricted state override, order details consistency, dead-code sweep.

## Context

Dispatch page (`web/src/components/DispatchPage.tsx`) hosts a custom Gantt (`DispatchGantt.tsx`, 374 lines) with native HTML5 drag-and-drop. Users report intermittently failing drags (cannot move orders between mechanics, drop targets do not fire). Event chips show only the VMRS code, hiding the work identity. Order state changes are gated by a state machine; the override endpoint only accepts `CANCELLED | REQUESTED`. Order detail surfaces in the dispatch drawer and the Orders page differ in fields, layout, and styling.

## Goals

1. Reliable Gantt drag-and-drop (pool→row, event→row).
2. Identifiable event chips (title / site / VMRS, in that order).
3. Override any state with a reason (POC scope, with explicit audit trail).
4. Single shared order details component across Dispatch drawer and Orders page.
5. Remove dead code/files surfaced during the above.

## Non-goals

- Replace Gantt with a third-party library (Kibo evaluated, rejected — see below).
- Add scheduled-time persistence (still visual-only; existing toast remains).
- Mobile/touch DnD (POC scope).

## Kibo Gantt evaluation (rejected)

`https://www.kibo-ui.com/components/gantt`, MIT, shadcn registry (`npx kibo-ui add gantt`). Built on `dndkit` + `date-fns` + `jotai` + `lodash` + `usehooks` + `lucide`.

Public API (from `packages/gantt/index.tsx`):

```ts
Range = "daily" | "monthly" | "quarterly"
GanttFeature = { id, name, startAt, endAt, status, lane? }
GanttFeatureItem props: onMove(feature, newStart, newEnd)
GanttSidebarGroup: read-only group header
```

Misfit:

- No hour-of-day view. Current dispatcher view shows 07:00–19:00 hourly columns; quarterly/monthly/daily-only would regress intra-day scheduling visibility.
- `onMove` operates on time, not on row membership. Cross-row reassignment (mechanic A → B) is the primary dispatch action; modelling it as remove-from-group-A + add-to-group-B would require the same glue we have now.
- No drop-from-external-pool. `dndkit` under the hood supports it, but the wrapping work is the same.
- Six new dependencies for a component whose layout we'd still customise heavily.

**Decision**: keep custom Gantt, but adopt `@dnd-kit/core` directly to fix the underlying DnD reliability without dragging in Kibo's data model.

## Design

### A) Gantt DnD migration to `@dnd-kit/core`

**Problem in current code** (`DispatchGantt.tsx`, `DispatchPage.tsx`):

- `lastPoolDragId` ref (`DispatchPage.tsx:115`) bridges pool drag start → row drop because native DnD's `dataTransfer` is not consulted in `onDropFromPool`. Stale across rapid drag cancellations.
- `onDragLeave` on the row gridcell flips `hoverRow` on every child transition (`DispatchGantt.tsx:295`), causing flicker that can pre-empt drop validation.
- Native DnD on macOS/Safari with absolutely-positioned chips overlapping a grid is flaky (drop on chip vs. row ambiguous).
- No visible feedback for invalid drops (wrong order state, same mechanic).

**Replacement**:

- `DndContext` at `DispatchPage` level. One context covers pool + Gantt rows.
- Draggables: `PendingOrders` cards (`id="pool:<orderId>"`), Gantt event chips (`id="event:<orderId>"`).
- Droppables: Gantt rows (`id="row:<mechanicId>"`). The hour/day hint is computed from `event.activatorEvent` cursor position relative to the droppable rect inside `onDragEnd`, same math as current `dropHint`.
- `DragOverlay` for the dragged chip (replaces browser ghost; consistent look across OSes).
- `useDroppable.isOver` drives row highlight (no manual `hoverRow` state).
- Invalid drop visual: red ring + tooltip when `isOver && !canDrop(activeOrder, row)`. `canDrop` rules:
  - pool drag: order must be `APPROVED`
  - event drag: target row != current row (otherwise no-op) and order in `DISPATCHED | IN_PROGRESS | COMPLETED`
- Drop payload carried in `active.data.current` (typed), no ref hacks.

Keep: lane assignment, position math, absence rendering, sticky header, keyboard activation on chips.

### B) Event chip label

Current chip body shows only `vmrsCode`. Replace with hierarchy: `title ?? siteName ?? vmrsCode`, plus small secondary line for `clientName` if width allows.

Backend change: add `siteName` to `ServiceOrderDto` (already loads `so.site`; expose `so.site.name`).

```diff
 public record ServiceOrderDto(
     UUID id,
     String title,
     UUID vehicleId,
     UUID mechanicId,
     UUID clientId,
     String clientName,
     UUID siteId,
+    String siteName,
     ...
 )
```

Frontend: extend `ServiceOrder` type in `web/src/types.ts`, update chip rendering at `DispatchGantt.tsx:359-364`. The VMRS code moves to a small monospace badge in the corner.

`title` attribute (browser tooltip) keeps the long form: `title · client · site · VMRS`.

### C) Unrestricted state override

Backend `ServiceOrderResource.overrideState` (`backend/src/main/java/com/terrapulse/api/ServiceOrderResource.java:256`):

- Accept any `ServiceOrderState` (drop the CANCELLED|REQUESTED restriction).
- Continue requiring a reason (empty → "no reason given", existing behavior).
- Append a single audit line to `notes`: `[override <iso> ] <from> -> <target>: <reason>`.
- Per-target cleanup rules made explicit:

| Target | Side effects |
|---|---|
| REQUESTED | clear mechanic, dispatchedAt, startedAt, completedAt, actualMinutes |
| QUOTED | clear mechanic, dispatchedAt, startedAt, completedAt, actualMinutes |
| APPROVED | clear mechanic, dispatchedAt, startedAt, completedAt, actualMinutes |
| DISPATCHED | require mechanic in request body; set dispatchedAt=now if null; clear startedAt, completedAt, actualMinutes |
| IN_PROGRESS | require mechanic + dispatchedAt; set startedAt=now if null; clear completedAt, actualMinutes |
| COMPLETED | require mechanic + dispatchedAt + startedAt; require actualMinutes; set completedAt=now if null |
| CANCELLED | keep existing fields (audit trail) |

WS event continues with `override: true` flag.

Request DTO grows:

```java
record OverrideStateRequest(
    ServiceOrderState state,
    String reason,
    UUID mechanicId,        // optional, required for DISPATCHED/IN_PROGRESS/COMPLETED if order has none
    Integer actualMinutes   // optional, required for COMPLETED if order has none
) {}
```

Frontend (`OrdersPage.tsx` OrderDetail panel and shared component below):

- State `Select` lists all `ServiceOrderState` values.
- Conditional fields appear when target needs them:
  - mechanic picker when target ∈ {DISPATCHED, IN_PROGRESS, COMPLETED} and order has no mechanic
  - minutes input when target = COMPLETED and `order.actualMinutes == null`
- Reason input remains.
- Submit calls existing `serviceOrders.override` (extend signature to pass optional mechanicId / actualMinutes).

### D) Shared `OrderDetailsCard`

New `web/src/components/OrderDetailsCard.tsx`:

```ts
type Props = {
  order: ServiceOrder;
  onRename?: (title: string) => void;
  renaming?: boolean;
  showNotes?: boolean;       // false by default (drawer), true on Orders page
  showClient?: boolean;      // true by default
  showSite?: boolean;
  actions?: ReactNode;       // workflow buttons slot
  overrideSlot?: ReactNode;  // override form slot
};
```

Layout: shared `dl grid-cols-[120px_1fr]`, identical typography/spacing tokens (already defined in `DESIGN.md`). Renders:

- Title (inline rename when `onRename` provided)
- State badge
- VMRS code + description
- Client name
- Site name + coords
- Estimated/Actual minutes
- Mechanic id
- Lifecycle timestamps (requested/dispatched/started/completed)
- Notes history (when `showNotes`)

Consumers:

- `ServiceOrderDrawer.tsx` (`web/src/components/ServiceOrderDrawer.tsx:51`): replace inline `dl` + workflow buttons. Passes `actions` = workflow buttons (quote/approve/dispatch/start/complete/cancel). No `overrideSlot`.
- `OrdersPage.tsx` `OrderDetail` (`web/src/pages/OrdersPage.tsx:227`): passes `onRename`, `showNotes=true`, `overrideSlot` = override form.

Drawer no longer hand-rolls a 110px `dl`; Orders page no longer hand-rolls a borderless `dl`. Same fields, same order, same labels.

### E) Dead code sweep

Targets surfaced while exploring:

- `web/src/components/ResourceTimeline.tsx` — present in tree but unreferenced by Dispatch after the Gantt rewrite. Verify with grep, delete if unused.
- `web/src/components/DispatchModal.tsx` — verify still needed; if Gantt-side dispatch flow replaced it, drop.
- `web/.claude-flow/data/pending-insights.jsonl` — runtime artefact tracked accidentally; add to `.gitignore`, remove from tree.
- `docs/logo.png` (already `D` in git status) and `docs/logo2.png` swap — confirm intended.
- `lastPoolDragId` ref + `showVisualSlotHint` indirection in `DispatchPage.tsx` — removed by the dndkit migration.
- Unused i18n keys touched by the chip relabel.

Concrete deletions confirmed only after grep verification during execution (no preemptive removal of anything with a single remaining reference).

## Risks

- **dndkit migration regression** on keyboard / a11y path. Mitigation: keep `role="button" tabIndex=0 onKeyDown` on chips for Enter/Space → open drawer; dndkit `KeyboardSensor` only activates on a deliberate key combination, won't conflict.
- **Override side-effect rules** may surprise users (e.g. forcing COMPLETED clears times then sets `completedAt=now`). Mitigation: confirmation dialog summarising the side effects before submission.
- **Shared component refactor** risks visual regression. Mitigation: snapshot the two existing renders, diff after refactor.

## Test plan

Manual:

- Drag pool order to mechanic row → dispatch fires; chip appears.
- Drag chip across rows → reassign fires; chip moves; invalid same-row no-op.
- Drag chip during rapid pool-card cancel → no stale state.
- Override REQUESTED → QUOTED → APPROVED → DISPATCHED (with mechanic) → IN_PROGRESS → COMPLETED (with minutes) → CANCELLED, in arbitrary order; notes audit trail accumulates.
- Drawer + Orders detail render identical field set.

Automated:

- Backend unit test on `overrideState` for each target's side-effect rules.
- Frontend RTL test for `OrderDetailsCard` rendering both consumer configurations.

## Execution order

1. Backend: `siteName` on DTO, `overrideState` unrestricted + side-effect matrix + tests.
2. Frontend types: `siteName` on `ServiceOrder`; `override` API signature.
3. `OrderDetailsCard` extraction; migrate drawer + Orders page.
4. dndkit migration in Gantt + DispatchPage.
5. Event chip label hierarchy.
6. Dead-code sweep + `.gitignore` update.
7. Manual smoke + tests.
