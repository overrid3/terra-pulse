# Mobile Responsive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** All pages usable on phones (≥ 320px). The Gantt swaps to a flat order list on mobile; nav sidebar becomes a bottom bar; tables reflow to stacked cards.

**Architecture:** `useIsMobile` already exists in `useResizableSplit.ts` — no new hook file needed. `DispatchPage` conditionally renders `<DispatchOrderList>` instead of `<Gantt>` + aside pool. `NavBar` hides on mobile; `BottomNav` renders fixed at bottom. Page tables use CSS-only responsive reflow. Global layout in `App.tsx` stacks vertically on mobile.

**Tech Stack:** Tailwind CSS v4 (`@media` in `index.css`), `useIsMobile` from `@/hooks/useResizableSplit`, existing `ServiceOrderDrawer`, existing `ServiceOrder`/`Mechanic`/`Vehicle` types.

---

### Task 1: Responsive global layout and NavBar → BottomNav

**Files:**
- Modify: `web/src/App.tsx`
- Modify: `web/src/components/NavBar.tsx`
- Create: `web/src/components/BottomNav.tsx`
- Modify: `web/src/index.css`

- [ ] **Step 1: Create BottomNav component**

Create `web/src/components/BottomNav.tsx`:

```typescript
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Route, ClipboardList, HardHat, Truck, Award, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_LINKS: { to: string; icon: LucideIcon; key: string }[] = [
  { to: "/dispatch",  icon: Route,         key: "nav.dispatch" },
  { to: "/orders",    icon: ClipboardList, key: "nav.orders" },
  { to: "/mechanics", icon: HardHat,       key: "nav.mechanics" },
  { to: "/vehicles",  icon: Truck,         key: "nav.vehicles" },
  { to: "/skills",    icon: Award,         key: "nav.skills" },
  { to: "/clients",   icon: Users,         key: "nav.clients" },
];

export function BottomNav() {
  const { t } = useTranslation();
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-20 bg-[var(--color-surface-panel)] border-t border-[var(--color-hairline)] flex"
      aria-label="Main navigation"
    >
      {NAV_LINKS.map(({ to, icon: Icon, key }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              "flex-1 flex flex-col items-center gap-0.5 py-2 px-1 text-[0.6rem] font-medium no-underline transition-colors",
              isActive
                ? "text-[var(--color-brand-strong)]"
                : "text-[var(--color-text-muted)]"
            )
          }
        >
          <Icon className="w-5 h-5 shrink-0" />
          <span className="leading-none truncate max-w-full">{t(key)}</span>
        </NavLink>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Update App.tsx to conditionally render BottomNav vs NavBar**

Replace `web/src/App.tsx` content (preserving any Clerk wrappers already added in the auth plan — if auth plan is not done yet, use the pre-auth version):

```typescript
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { NavBar } from "./components/NavBar";
import { BottomNav } from "./components/BottomNav";
import { DispatchPage } from "./components/DispatchPage";
import { ClientsPage } from "./pages/ClientsPage";
import { MechanicsPage } from "./pages/MechanicsPage";
import { OrdersPage } from "./pages/OrdersPage";
import { VehiclesPage } from "./pages/VehiclesPage";
import { SkillsPage } from "./pages/SkillsPage";
import { ToastProvider } from "./components/Toast";
import { TooltipProvider } from "./components/ui/tooltip";
import { useDispatchSocket } from "./hooks/useDispatchSocket";
import { useIsMobile } from "./hooks/useResizableSplit";

export default function App() {
  useDispatchSocket();
  const isMobile = useIsMobile();
  return (
    <ToastProvider>
      <TooltipProvider>
        <BrowserRouter>
          <div className={isMobile ? "flex flex-col h-full" : "flex flex-row h-full overflow-hidden"}>
            {!isMobile && <NavBar />}
            <div
              className="flex-1 min-w-0 overflow-y-auto bg-[var(--color-surface-app)] flex flex-col"
              style={isMobile ? { paddingBottom: "56px" } : { height: "100%" }}
            >
              <Routes>
                <Route path="/" element={<Navigate to="/dispatch" replace />} />
                <Route path="/dispatch" element={<DispatchPage />} />
                <Route path="/orders" element={<OrdersPage />} />
                <Route path="/mechanics" element={<MechanicsPage />} />
                <Route path="/vehicles" element={<VehiclesPage />} />
                <Route path="/skills" element={<SkillsPage />} />
                <Route path="/clients" element={<ClientsPage />} />
              </Routes>
            </div>
            {isMobile && <BottomNav />}
          </div>
        </BrowserRouter>
      </TooltipProvider>
    </ToastProvider>
  );
}
```

Note: if the auth plan has already been applied, preserve `<SignedIn>`, `<SignedOut>`, `<ClerkSync>` wrappers from the auth plan's version of `App.tsx` — only replace the inner layout portion.

- [ ] **Step 3: Verify NavBar is unchanged on desktop, BottomNav appears on mobile**

```bash
just up
```

Open `http://localhost:5173`. At desktop width: left sidebar shows. Resize browser to < 768px: sidebar hides, bottom nav appears.

- [ ] **Step 4: Commit**

```bash
git add web/src/App.tsx web/src/components/BottomNav.tsx
git commit -m "feat(mobile): replace sidebar nav with bottom nav on phones"
```

---

### Task 2: Responsive table CSS for CRUD pages

All four pages (MechanicsPage, VehiclesPage, ClientsPage, OrdersPage) use `<table>` or similar. On mobile, table rows reflow to stacked card blocks via CSS. No React component changes.

**Files:**
- Modify: `web/src/index.css`

- [ ] **Step 1: Add responsive table rules to index.css**

Append to the end of `web/src/index.css`:

```css
/* ============================================================
   Responsive — phone breakpoint (< 768px)
   ============================================================ */

@media (max-width: 767px) {
  /* Tables: reflow rows to stacked cards */
  .tp-responsive-table thead {
    display: none;
  }

  .tp-responsive-table tbody tr {
    display: block;
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-md);
    margin-bottom: 0.5rem;
    padding: 0.75rem;
    background: var(--color-surface-panel);
  }

  .tp-responsive-table tbody td {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 0.25rem 0;
    border: none;
  }

  .tp-responsive-table tbody td::before {
    content: attr(data-label);
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--color-text-subtle);
    letter-spacing: 0.04em;
    margin-right: 0.5rem;
    flex-shrink: 0;
  }

  /* Modals and drawers: full-width on mobile */
  [role="dialog"],
  .sheet-content {
    max-width: 100vw !important;
    width: 100vw !important;
  }

  /* Page headers: stack vertically */
  .tp-page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }

  /* Hide non-essential columns on mobile */
  .tp-col-desktop-only {
    display: none;
  }
}
```

- [ ] **Step 2: Add class tp-responsive-table to MechanicsPage table**

Open `web/src/pages/MechanicsPage.tsx`. Find the `<table` element and add `tp-responsive-table` to its className. Also add `data-label="..."` attributes to each `<td>` matching the corresponding `<th>` text.

Search for the table tag: `<table` and add the class:
```tsx
<table className="... tp-responsive-table">
```

For each `<td>` in the table body, add `data-label` matching its column header. Example pattern:
```tsx
<td data-label="Name" className="...">
  {mechanic.fullName}
</td>
<td data-label="Status" className="...">
  <StatusBadge ... />
</td>
```

- [ ] **Step 3: Repeat for VehiclesPage, ClientsPage, OrdersPage**

Apply the same `tp-responsive-table` class and `data-label` attributes to the table in each of:
- `web/src/pages/VehiclesPage.tsx`
- `web/src/pages/ClientsPage.tsx`
- `web/src/pages/OrdersPage.tsx`

- [ ] **Step 4: Build and verify**

```bash
cd web && npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 5: Visual check in browser**

```bash
just up
```

Open `http://localhost:5173/mechanics`. At < 768px (browser DevTools device mode): table collapses to card list.

- [ ] **Step 6: Commit**

```bash
git add web/src/index.css web/src/pages/MechanicsPage.tsx web/src/pages/VehiclesPage.tsx web/src/pages/ClientsPage.tsx web/src/pages/OrdersPage.tsx
git commit -m "feat(mobile): responsive table reflow for CRUD pages"
```

---

### Task 3: DispatchOrderList — mobile Gantt replacement

**Files:**
- Create: `web/src/components/DispatchOrderList.tsx`

- [ ] **Step 1: Create DispatchOrderList component**

Create `web/src/components/DispatchOrderList.tsx`:

```typescript
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { ChevronDown, ChevronRight, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { Mechanic, ServiceOrder, Vehicle, UUID } from "../types";

type Props = {
  mechanics: Mechanic[];
  orders: ServiceOrder[];
  vehicles: Map<string, Vehicle>;
  onSelectOrder: (id: UUID) => void;
};

const PENDING_STATES = new Set(["REQUESTED", "QUOTED", "APPROVED"]);

function OrderRow({
  order,
  vehicles,
  onSelect,
}: {
  order: ServiceOrder;
  vehicles: Map<string, Vehicle>;
  onSelect: () => void;
}) {
  const vehicle = order.vehicleId ? vehicles.get(order.vehicleId) : undefined;
  const timeLabel = order.scheduledStartAt
    ? format(new Date(order.scheduledStartAt), "dd/MM HH:mm")
    : order.startedAt
    ? format(new Date(order.startedAt), "dd/MM HH:mm")
    : null;

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className="w-full text-left px-3 py-2.5 border-b border-[var(--color-hairline)] flex items-center gap-3 hover:bg-[var(--color-surface-container)] active:bg-[var(--color-surface-container-high)] transition-colors"
      >
        <span className={cn("px-1.5 py-0.5 rounded-[var(--radius-sm)] text-xs font-medium shrink-0", `state-${order.state}`)}>
          {order.state}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-[var(--color-text)] truncate">
            {order.title ?? order.vmrsDescription ?? order.vmrsCode}
          </div>
          <div className="text-xs text-[var(--color-text-subtle)] truncate">
            {vehicle ? `${vehicle.make} ${vehicle.model}` : order.vehicleId}
            {order.clientName ? ` · ${order.clientName}` : null}
          </div>
        </div>
        {timeLabel && (
          <span className="text-xs font-mono text-[var(--color-text-muted)] shrink-0">
            {timeLabel}
          </span>
        )}
      </button>
    </li>
  );
}

function MechanicSection({
  mechanic,
  orders,
  vehicles,
  onSelectOrder,
}: {
  mechanic: Mechanic;
  orders: ServiceOrder[];
  vehicles: Map<string, Vehicle>;
  onSelectOrder: (id: UUID) => void;
}) {
  const [open, setOpen] = useState(true);
  if (orders.length === 0) return null;

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-[var(--color-surface-sunken)] border-b border-[var(--color-hairline)] text-left"
      >
        {open ? (
          <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)]" />
        ) : (
          <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)]" />
        )}
        <span className="text-sm font-semibold text-[var(--color-text)]">
          {mechanic.fullName}
        </span>
        <span className="ml-auto text-xs font-mono bg-[var(--color-surface-container-highest)] px-1.5 py-0.5 rounded-[var(--radius-sm)]">
          {orders.length}
        </span>
      </button>
      {open && (
        <ul className="list-none m-0 p-0">
          {orders.map((o) => (
            <OrderRow
              key={o.id}
              order={o}
              vehicles={vehicles}
              onSelect={() => onSelectOrder(o.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

export function DispatchOrderList({ mechanics, orders, vehicles, onSelectOrder }: Props) {
  const { t } = useTranslation();

  const unassigned = useMemo(
    () => orders.filter((o) => o.mechanicId === null && PENDING_STATES.has(o.state)),
    [orders]
  );

  const byMechanic = useMemo(() => {
    const map = new Map<string, ServiceOrder[]>();
    for (const o of orders) {
      if (!o.mechanicId) continue;
      if (!map.has(o.mechanicId)) map.set(o.mechanicId, []);
      map.get(o.mechanicId)!.push(o);
    }
    return map;
  }, [orders]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      {/* Unassigned pool */}
      {unassigned.length > 0 && (
        <section>
          <div className="flex items-center gap-2 px-3 py-2 bg-[var(--color-surface-sunken)] border-b border-[var(--color-hairline)]">
            <Inbox className="w-4 h-4 text-[var(--color-text-muted)]" />
            <span className="text-sm font-semibold text-[var(--color-text)]">
              {t("dispatch.unassignedPool")}
            </span>
            <span className="ml-auto text-xs font-mono bg-[var(--color-surface-container-highest)] px-1.5 py-0.5 rounded-[var(--radius-sm)]">
              {unassigned.length}
            </span>
          </div>
          <ul className="list-none m-0 p-0">
            {unassigned.map((o) => (
              <OrderRow
                key={o.id}
                order={o}
                vehicles={vehicles}
                onSelect={() => onSelectOrder(o.id)}
              />
            ))}
          </ul>
        </section>
      )}

      {/* Per-mechanic sections */}
      {mechanics.map((m) => (
        <MechanicSection
          key={m.id}
          mechanic={m}
          orders={byMechanic.get(m.id) ?? []}
          vehicles={vehicles}
          onSelectOrder={onSelectOrder}
        />
      ))}

      {unassigned.length === 0 && mechanics.every((m) => (byMechanic.get(m.id) ?? []).length === 0) && (
        <p className="text-center text-[var(--color-text-muted)] text-sm py-10">
          {t("dispatch.pendingNone")}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd web && npm run build
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/DispatchOrderList.tsx
git commit -m "feat(mobile): add DispatchOrderList for mobile Gantt replacement"
```

---

### Task 4: Wire DispatchOrderList into DispatchPage on mobile

**Files:**
- Modify: `web/src/components/DispatchPage.tsx`

- [ ] **Step 1: Import DispatchOrderList**

In `web/src/components/DispatchPage.tsx`, add the import near the top with other local imports:

```typescript
import { DispatchOrderList } from "./DispatchOrderList";
```

- [ ] **Step 2: Locate the mobile render path in DispatchPage**

`isMobile` is already computed at line 110. Locate the `return (` statement and find the `<main>` element (around line 446) that contains `<section>` (Gantt) + aside (pool).

Replace the `<main>` block contents with a conditional:

```tsx
<main className="flex-1 min-h-0 min-w-0 p-3 flex flex-row gap-0">
  {isMobile ? (
    <DispatchOrderList
      mechanics={mechanicsQ.data ?? []}
      orders={filteredOrders}
      vehicles={vehicleById}
      onSelectOrder={setSelectedOrderId}
    />
  ) : (
    <>
      <section className="flex-1 min-w-0 border border-[var(--color-hairline)] rounded-[var(--radius-md)] flex flex-col min-h-0 overflow-hidden">
        <div
          key={`${view}-${winStart.toISOString()}`}
          className={cn(
            "flex-1 min-h-0 flex flex-col",
            navDir === "next" && "tp-gantt-anim-next",
            navDir === "prev" && "tp-gantt-anim-prev",
            navDir === "fade" && "tp-gantt-anim-fade",
          )}
        >
          <Gantt
            mechanics={mechanicsQ.data ?? []}
            orders={filteredOrders}
            absences={absencesQ.data ?? []}
            vehicleById={vehicleById}
            selectedMechanicId={selectedMechanicId}
            view={view}
            date={date}
            winStart={winStart}
            winEnd={winEnd}
            onSelectOrder={setSelectedOrderId}
            onEditOrder={setEditOrderId}
            onUnassignOrder={(id) => unassignMut.mutate(id as UUID)}
            onDeleteOrder={setDeleteOrderId}
            onAddAbsence={setAbsenceMechanicId}
            registerRow={registerRow}
          />
        </div>
      </section>

      <ResizableSplitHandle onStart={startPoolDrag} ariaLabel={t("dispatch.unassignedPool")} />

      <aside
        ref={poolPanelRef}
        style={{ width: poolInitialWidth }}
        className="shrink-0 min-w-[240px] max-w-[600px] bg-[var(--color-surface-panel)] border border-[var(--color-hairline)] rounded-[var(--radius-md)] flex flex-col min-h-0 overflow-hidden"
      >
        {/* existing pool content unchanged */}
      </aside>
    </>
  )}
</main>
```

**Important:** The existing pool `<aside>` content (the unassigned chip list) stays unchanged inside the `<>` desktop branch. Do not delete any of its internal JSX — only wrap the entire `<section> + ResizableSplitHandle + <aside>` block inside the `else` branch.

- [ ] **Step 3: Also simplify the toolbar header on mobile**

In the `<header>` section of `DispatchPage` (around line 370), the view toggle and date navigation make no sense on mobile. Wrap the gantt-specific controls in `{!isMobile && ...}`:

```tsx
{!isMobile && (
  <ToggleGroup ... >
    <ToggleGroupItem value="day">{t("dispatch.viewDay")}</ToggleGroupItem>
    <ToggleGroupItem value="week">{t("dispatch.viewWeek")}</ToggleGroupItem>
    <ToggleGroupItem value="month">{t("dispatch.viewMonth")}</ToggleGroupItem>
  </ToggleGroup>
)}
{!isMobile && (
  <div className="flex items-center gap-1">
    <Button variant="outline" size="sm" onClick={() => navigate(-1)} aria-label={t("common.previous")}>
      <ChevronLeft className="h-4 w-4" />
    </Button>
    <Button variant="outline" size="sm" onClick={jumpToday}>
      {t("dispatch.today")}
    </Button>
    <Button variant="outline" size="sm" onClick={() => navigate(1)} aria-label={t("common.next")}>
      <ChevronRight className="h-4 w-4" />
    </Button>
  </div>
)}
```

- [ ] **Step 4: Build**

```bash
cd web && npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 5: Smoke test on mobile viewport**

```bash
just up
```

Open `http://localhost:5173/dispatch`. DevTools → device mode (375px width). Expected: bottom nav visible, order list renders grouped by mechanic, tapping an order opens the existing `ServiceOrderDrawer`.

- [ ] **Step 6: Smoke test on desktop**

Same URL, full width. Expected: Gantt renders normally, sidebar nav shows, unassigned pool aside visible.

- [ ] **Step 7: Commit**

```bash
git add web/src/components/DispatchPage.tsx
git commit -m "feat(mobile): swap Gantt for DispatchOrderList on phone viewport"
```
