# shadcn Migration Design

**Date:** 2026-05-15
**Status:** Approved

## Goal

Replace hand-rolled CSS components with shadcn/ui primitives backed by Tailwind CSS v4. Motivator: pre-built accessible components (Dialog, Select, Sheet) instead of custom implementations. Visual design (Precision Industrial, warm OKLCH tokens) is preserved — this is not a redesign.

## Stack Changes

| Before | After |
|---|---|
| Custom CSS (`styles.css`) | Tailwind CSS v4 (`index.css`) |
| No component library | shadcn/ui (Radix UI primitives) |
| Google Material Symbols (web font) | lucide-react (npm, tree-shakeable) |
| Hand-rolled Toast | Sonner |
| Native `<select>` | shadcn Select (Radix) |
| Native `<dialog>` pattern | shadcn Dialog (Radix) |

## Infrastructure

### New dependencies (`web/package.json`)

**Runtime:**
- `lucide-react`
- `class-variance-authority`
- `clsx`
- `tailwind-merge`
- `sonner`

**Dev:**
- `tailwindcss` (v4)
- `@tailwindcss/vite`

### Vite config

Add `@tailwindcss/vite` plugin:

```ts
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

### `index.html`

Remove Google Fonts `<link>` tags (Inter, JetBrains Mono, Material Symbols). Fonts become system fallbacks; Inter and JetBrains Mono can be added via `@fontsource/*` npm packages if needed.

### `src/styles.css` → `src/index.css`

Restructured as:

```css
@import "tailwindcss";

@theme {
  /* All existing OKLCH custom properties stay here */
  --color-accent: oklch(0.632 0.168 56);
  /* ... all tokens from current :root {} ... */
}

@layer base {
  /* Reset, body, focus-visible */
}

@layer utilities {
  /* Semantic state classes (dynamically applied via template literals) */
  .state-REQUESTED   { ... }
  .state-QUOTED      { ... }
  /* ... all .state-*, .status-*, .absence-* classes ... */
  /* ... status-dot variants ... */
}

/* react-big-calendar overrides (keep unchanged) */
/* react-leaflet overrides (if any) */
```

### `src/lib/utils.ts` (new)

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### shadcn init

```bash
npx shadcn@latest init
# style: new-york
# base color: neutral (tokens override via @theme)
# CSS variables: yes
```

## Component Migration Map

### shadcn components to install

| shadcn component | Replaces |
|---|---|
| `button` | `button`, `button.primary`, `button.danger`, `button.ghost` CSS classes |
| `input` | `.form-panel input`, `.address-row input`, `.client-list-search` |
| `label` | `.form-panel label` |
| `textarea` | `.form-panel textarea` |
| `select` | `.form-panel select`, `.filters select`, `.absence-picker select` |
| `dialog` | `.modal-backdrop` + `.modal` in `DispatchModal.tsx` |
| `sheet` | `.drawer.panel` in `ServiceOrderDrawer.tsx` |
| `table` | `.data-table` in Orders, Vehicles, Skills, Mechanics pages |
| `badge` | `.badge`, `.chip` |
| `card` | `.panel`, `.stat-card` |
| `toggle-group` | `.seg-control` |
| `separator` | hairline borders in a few places |
| `sonner` | `ToastProvider` / `ToastItem` in `Toast.tsx` |

### Button variants

Map current button classes to shadcn variants:

| Current | shadcn |
|---|---|
| `button.primary` | `variant="default"` |
| `button` (default) | `variant="outline"` |
| `button.ghost` | `variant="ghost"` |
| `button.danger` | `variant="destructive"` |
| `button` in row-actions (xs size) | `size="sm"` or custom `size="xs"` |

### Toast (`Toast.tsx` rewrite)

Replace custom `ToastProvider`/`ToastItem` with Sonner wrapper. The public API (`useToast()`, `push()`, `error()`, `success()`, `dismiss()`) stays identical — callers are unaffected.

`App.tsx` changes: remove `<ToastProvider>` wrapper, add `<Toaster />` from sonner.

The `error(e)` method that extracts `ApiError` messages is reimplemented as a thin wrapper around `sonner.toast.error()`.

### Select API change (risk)

Radix Select has a different prop API than native `<select>`:

```tsx
// Before (native)
<select value={val} onChange={e => setVal(e.target.value)}>

// After (shadcn)
<Select value={val} onValueChange={setVal}>
  <SelectTrigger><SelectValue /></SelectTrigger>
  <SelectContent>
    <SelectItem value="x">X</SelectItem>
  </SelectContent>
</Select>
```

All form selects in `MechanicsPage`, `VehiclesPage`, `OrdersPage`, `AbsenceCalendarPicker` must be updated.

## Lucide Icon Mapping

| Material Symbol | Lucide component |
|---|---|
| `route` | `Route` |
| `assignment` | `ClipboardList` |
| `engineering` | `HardHat` |
| `construction` | `Truck` |
| `workspace_premium` | `Award` |
| `group` | `Users` |
| `info` | `Info` |
| `check_circle` | `CheckCircle` |
| `warning` | `AlertTriangle` |
| `error` | `XCircle` |
| `add` | `Plus` |
| `edit` | `Pencil` |
| `delete` | `Trash2` |
| `close` | `X` |
| `chevron_right` | `ChevronRight` |
| `arrow_back` | `ArrowLeft` |
| `location_on` | `MapPin` |
| `calendar_month` | `Calendar` |
| `build` | `Wrench` |

## What Does NOT Change

- `react-big-calendar` integration and all `.rbc-*` CSS overrides
- `react-leaflet` / Leaflet map components
- `AddressLookup.tsx` autocomplete list — converted to Tailwind utilities, not shadcn Command
- `AbsenceCalendarPicker.tsx` calendar wrapper — converted to Tailwind utilities only
- Layout structure (`app-shell`, `dispatch` grid, `page-grid`, `clients-layout` split-pane, resize logic)
- All API / hooks / query logic — zero changes to `src/api/`, `src/hooks/`, `src/i18n/`
- Semantic state classes (`.state-REQUESTED`, `.status-IDLE`, etc.) — stay as `@layer utilities` since applied dynamically

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Select API change across many files | Update all Select usages in one pass; TypeScript will catch missing props |
| Sonner `toast()` API differs from custom `useToast()` | Keep `useToast()` hook as facade; internals swap to sonner |
| shadcn default token names clash with existing tokens | Use `@theme` to define tokens under our names; override shadcn CSS vars in `@layer base` |
| react-big-calendar `var(--color-*)` refs still valid | Tailwind v4 `@theme` emits standard CSS custom props — all `var()` references work unchanged |
| Icon names are best-effort matches | Review each icon visually before shipping; adjust as needed |

## Out of Scope

Per `docs/scope-fence.md`: OptaPlanner, MQTT, Flutter mobile, multi-tenant auth, offline mode.
