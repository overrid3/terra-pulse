# shadcn Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `web/` from custom CSS + native HTML controls to Tailwind CSS v4 + shadcn/ui components while preserving the Precision Industrial visual design.

**Architecture:** Tailwind v4 reads existing OKLCH design tokens via `@theme {}` in CSS — no `tailwind.config.js` needed. shadcn primitives (Radix UI under the hood) replace hand-rolled Dialog/Sheet/Select/Toast. Layout/grid CSS converts to Tailwind utilities inline. Semantic state classes (`.state-REQUESTED`, etc.) stay as `@layer utilities` since they're applied dynamically via template literals.

**Tech Stack:** Vite, React 18, TypeScript, Tailwind CSS v4, shadcn/ui (new-york style), Radix UI, lucide-react, Sonner, class-variance-authority, clsx, tailwind-merge.

**Spec:** [`docs/superpowers/specs/2026-05-15-shadcn-migration-design.md`](../specs/2026-05-15-shadcn-migration-design.md)

---

## Parallelisation Strategy (claude-flow / ruflo)

This plan has **four phases**. Phases 1, 2, 4 are sequential. **Phase 3 is parallelisable** — six independent component clusters with no shared file scope.

**When executing Phase 3, use claude-flow swarm orchestration:**

```
mcp__claude-flow__swarm_init({ topology: "mesh", maxAgents: 6, strategy: "parallel" })
```

Then spawn one `coder` agent per cluster (Tasks 3.A through 3.F), all in a single message with parallel tool calls. Each agent receives:
- The cluster's task spec (verbatim from this plan)
- Read-only references to `web/src/lib/utils.ts`, `web/src/index.css`, shared shadcn components in `web/src/components/ui/`
- Write scope limited to the files listed in that cluster

After all six agents complete, run Phase 4 sequentially. **Do NOT parallelise Phases 1, 2, or 4** — they touch shared infrastructure files.

Alternative: if not using claude-flow, execute Phase 3 sequentially in cluster order (A → F).

---

## File Structure

**New files:**
- `web/src/lib/utils.ts` — `cn()` helper
- `web/src/index.css` — Tailwind v4 entry + `@theme {}` tokens + `@layer` blocks (replaces `styles.css`)
- `web/src/components/ui/` — directory for shadcn components (auto-created by CLI):
  - `button.tsx`, `input.tsx`, `label.tsx`, `textarea.tsx`, `select.tsx`
  - `dialog.tsx`, `sheet.tsx`, `table.tsx`, `badge.tsx`, `card.tsx`
  - `toggle-group.tsx`, `toggle.tsx`, `separator.tsx`, `sonner.tsx`

**Modified files:**
- `web/package.json` — new deps
- `web/vite.config.ts` — Tailwind v4 plugin
- `web/index.html` — remove Google Fonts links
- `web/src/main.tsx` — import path change (`styles.css` → `index.css`)
- `web/src/App.tsx` — Sonner Toaster instead of custom ToastProvider
- `web/src/components/Toast.tsx` — rewrite as Sonner facade (keep public API)
- All `web/src/components/*.tsx` and `web/src/pages/*.tsx` — utility class migration + shadcn component swaps

**Deleted files:**
- `web/src/styles.css` (content moved to `index.css`)

---

# Phase 1 — Foundation (sequential)

## Task 1.1: Install dependencies

**Files:**
- Modify: `web/package.json` (via npm)

- [ ] **Step 1: Install runtime + dev dependencies**

Run:
```bash
cd web && npm install \
  class-variance-authority@^0.7.0 \
  clsx@^2.1.0 \
  tailwind-merge@^2.5.0 \
  lucide-react@^0.460.0 \
  sonner@^1.7.0
```

```bash
cd web && npm install -D \
  tailwindcss@^4.0.0 \
  @tailwindcss/vite@^4.0.0
```

Expected: deps appear in `package.json`. No build run yet.

- [ ] **Step 2: Verify install**

Run: `cd web && npm ls tailwindcss lucide-react sonner clsx`
Expected: each prints version, no `UNMET DEPENDENCY` warnings.

- [ ] **Step 3: Commit**

```bash
git add web/package.json web/package-lock.json
git commit -m "chore(web): add tailwind v4, shadcn deps, lucide-react, sonner"
```

---

## Task 1.2: Configure Vite for Tailwind v4

**Files:**
- Modify: `web/vite.config.ts`

- [ ] **Step 1: Update vite.config.ts**

Replace contents of `web/vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173 }
});
```

- [ ] **Step 2: Commit**

```bash
git add web/vite.config.ts
git commit -m "chore(web): register tailwindcss vite plugin"
```

---

## Task 1.3: Create `web/src/index.css` with Tailwind v4 + tokens

**Files:**
- Create: `web/src/index.css`

- [ ] **Step 1: Create index.css**

Create `web/src/index.css` with:

```css
@import "tailwindcss";

/* ============================================================
   Design tokens — Precision Industrial (OKLCH)
   ============================================================ */
@theme {
  /* Amber accent */
  --color-accent: oklch(0.632 0.168 56);
  --color-accent-strong: oklch(0.483 0.145 51);
  --color-accent-soft: oklch(0.962 0.032 60);

  /* Text hierarchy */
  --color-ink: oklch(0.185 0.004 155);
  --color-ink-elevated: oklch(0.28 0.006 155);
  --color-ink-soft: oklch(0.86 0.006 78);
  --color-ink-muted: oklch(0.72 0.006 78);
  --color-text: oklch(0.185 0.004 155);
  --color-text-muted: oklch(0.382 0.042 44);
  --color-text-subtle: oklch(0.566 0.038 50);

  /* Surfaces */
  --color-surface-app: oklch(0.972 0.006 80);
  --color-surface-panel: oklch(0.999 0.001 80);
  --color-surface-elev: oklch(0.999 0.001 80);
  --color-surface-sunken: oklch(0.958 0.007 80);
  --color-surface-container: oklch(0.943 0.007 78);
  --color-surface-container-high: oklch(0.929 0.007 76);
  --color-surface-container-highest: oklch(0.914 0.007 76);

  /* Hairlines */
  --color-hairline: oklch(0.822 0.032 52);
  --color-hairline-strong: oklch(0.566 0.038 50);

  /* Semantic state pairs */
  --color-danger-fg: oklch(0.509 0.185 25);
  --color-danger-bg: oklch(0.928 0.046 20);
  --color-danger-hairline: oklch(0.84 0.07 25);
  --color-warn-fg: oklch(0.50 0.13 82);
  --color-warn-bg: oklch(0.95 0.06 85);
  --color-success-fg: oklch(0.45 0.13 150);
  --color-success-bg: oklch(0.93 0.06 150);
  --color-info-fg: oklch(0.46 0.12 230);
  --color-info-bg: oklch(0.94 0.035 225);
  --color-neutral-fg: oklch(0.566 0.038 50);
  --color-neutral-bg: oklch(0.943 0.007 78);
  --color-quoted-fg: oklch(0.44 0.15 295);
  --color-quoted-bg: oklch(0.93 0.05 295);

  /* Type scale */
  --text-xs: 0.72rem;
  --text-sm: 0.85rem;
  --text-base: 0.875rem;
  --text-lg: 1.05rem;

  /* Radii */
  --radius-sm: 2px;
  --radius-md: 4px;
  --radius-pill: 999px;

  /* Overlay + shadow */
  --color-overlay-scrim: oklch(0.185 0.004 155 / 0.5);
  --shadow-modal: 0 8px 24px oklch(0.185 0.004 155 / 0.18);

  /* Motion */
  --motion-duration: 160ms;
  --motion-easing: cubic-bezier(0.22, 1, 0.36, 1);

  /* Font families (system stack — no Google Fonts) */
  --font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
}

/* ============================================================
   Base layer — reset, body, focus
   ============================================================ */
@layer base {
  * { box-sizing: border-box; }

  html, body, #root { height: 100%; margin: 0; }

  body {
    font-family: var(--font-sans);
    font-size: var(--text-base);
    line-height: 1.45;
    color: var(--color-text);
    background: var(--color-surface-app);
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }

  :focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
    border-radius: var(--radius-sm);
  }
}

/* ============================================================
   Utilities layer — semantic state classes applied dynamically
   These are referenced via template literals like
   `state-${order.state}` and cannot be expressed as Tailwind
   utilities at compile time.
   ============================================================ */
@layer utilities {
  /* Service-order states */
  .state-REQUESTED   { background: var(--color-warn-bg);    color: var(--color-warn-fg); }
  .state-QUOTED      { background: var(--color-quoted-bg);  color: var(--color-quoted-fg); }
  .state-APPROVED    { background: var(--color-success-bg); color: var(--color-success-fg); }
  .state-DISPATCHED  { background: var(--color-info-bg);    color: var(--color-info-fg); }
  .state-IN_PROGRESS { background: var(--color-success-bg); color: var(--color-success-fg); }
  .state-COMPLETED   { background: var(--color-neutral-bg); color: var(--color-neutral-fg); }
  .state-CANCELLED   { background: var(--color-danger-bg);  color: var(--color-danger-fg); }

  /* Mechanic statuses */
  .status-IDLE         { background: var(--color-info-bg);    color: var(--color-info-fg); }
  .status-EN_ROUTE     { background: var(--color-warn-bg);    color: var(--color-warn-fg); }
  .status-IN_PROGRESS  { background: var(--color-success-bg); color: var(--color-success-fg); }
  .status-OFF_DUTY     { background: var(--color-neutral-bg); color: var(--color-neutral-fg); }

  /* Vehicle statuses */
  .status-AVAILABLE    { background: var(--color-success-bg); color: var(--color-success-fg); }
  .status-RESERVED     { background: var(--color-warn-bg);    color: var(--color-warn-fg); }
  .status-IN_SERVICE   { background: var(--color-info-bg);    color: var(--color-info-fg); }
  .status-OUT_OF_ORDER { background: var(--color-danger-bg);  color: var(--color-danger-fg); }

  /* Absences */
  .absence-VACATION { background: var(--color-info-bg);    color: var(--color-info-fg); }
  .absence-SICK     { background: var(--color-danger-bg);  color: var(--color-danger-fg); }
  .absence-TRAINING { background: var(--color-warn-bg);    color: var(--color-warn-fg); }
  .absence-OTHER    { background: var(--color-neutral-bg); color: var(--color-neutral-fg); }

  /* Status dot */
  .status-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .status-dot.dot-IDLE, .status-dot.dot-AVAILABLE   { background: var(--color-info-fg); }
  .status-dot.dot-EN_ROUTE, .status-dot.dot-RESERVED { background: var(--color-warn-fg); }
  .status-dot.dot-IN_PROGRESS                       { background: var(--color-success-fg); }
  .status-dot.dot-IN_SERVICE                        { background: var(--color-info-fg); }
  .status-dot.dot-OFF_DUTY, .status-dot.dot-COMPLETED { background: var(--color-neutral-fg); }
  .status-dot.dot-OUT_OF_ORDER, .status-dot.dot-CANCELLED, .status-dot.dot-SICK {
    background: var(--color-danger-fg);
  }
  .status-dot.dot-has-orders { background: var(--color-accent); }
  .status-dot.dot-has-sites  { background: oklch(0.65 0.14 145); }
  .status-dot.dot-inactive   { background: var(--color-hairline); }
}

/* ============================================================
   react-big-calendar overrides (keep — third-party CSS)
   ============================================================ */
.rbc-calendar { font-size: var(--text-sm); color: var(--color-text); }

.rbc-toolbar { color: var(--color-text); margin-bottom: 8px; }
.rbc-toolbar button {
  color: var(--color-text);
  background: var(--color-surface-panel);
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-sm);
}
.rbc-toolbar button:hover,
.rbc-toolbar button:focus { background: var(--color-surface-sunken); }
.rbc-toolbar button.rbc-active {
  background: var(--color-accent-soft);
  color: var(--color-accent-strong);
  border-color: var(--color-accent);
  box-shadow: none;
}

.rbc-month-view, .rbc-time-view, .rbc-agenda-view {
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-sm);
  background: var(--color-surface-panel);
}

.rbc-header, .rbc-time-header-content, .rbc-time-content,
.rbc-time-header, .rbc-day-bg, .rbc-day-slot, .rbc-time-slot,
.rbc-timeslot-group, .rbc-month-row, .rbc-row-content, .rbc-row,
.rbc-day-bg + .rbc-day-bg {
  border-color: var(--color-hairline) !important;
}

.rbc-header {
  color: var(--color-text-subtle);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-size: var(--text-xs);
  padding: 6px 4px;
  font-weight: 600;
}
.rbc-today { background: var(--color-accent-soft); }
.rbc-off-range-bg { background: var(--color-surface-sunken); }
.rbc-current-time-indicator { background: var(--color-accent); height: 1px; }

.rbc-event {
  background: var(--color-accent);
  border: 1px solid var(--color-accent-strong);
  color: var(--color-surface-panel);
  border-radius: var(--radius-sm);
  box-shadow: none;
  padding: 2px 6px;
  font-size: var(--text-xs);
}
.rbc-event.rbc-selected { background: var(--color-accent-strong); }

.rbc-event.is-absence {
  opacity: 0.78;
  background-image: repeating-linear-gradient(
    135deg,
    transparent 0 4px,
    oklch(0.999 0.001 80 / 0.20) 4px 5px
  );
}

.rbc-event.state-REQUESTED,
.rbc-event.status-RESERVED,
.rbc-event.status-EN_ROUTE,
.rbc-event.absence-TRAINING {
  background: var(--color-warn-bg);
  color: var(--color-warn-fg);
  border-color: var(--color-warn-fg);
}
.rbc-event.state-QUOTED {
  background: var(--color-quoted-bg);
  color: var(--color-quoted-fg);
  border-color: var(--color-quoted-fg);
}
.rbc-event.state-APPROVED,
.rbc-event.state-IN_PROGRESS,
.rbc-event.status-AVAILABLE,
.rbc-event.status-IN_PROGRESS {
  background: var(--color-success-bg);
  color: var(--color-success-fg);
  border-color: var(--color-success-fg);
}
.rbc-event.state-DISPATCHED,
.rbc-event.status-IDLE,
.rbc-event.status-IN_SERVICE,
.rbc-event.absence-VACATION {
  background: var(--color-info-bg);
  color: var(--color-info-fg);
  border-color: var(--color-info-fg);
}
.rbc-event.state-CANCELLED,
.rbc-event.status-OUT_OF_ORDER,
.rbc-event.absence-SICK {
  background: var(--color-danger-bg);
  color: var(--color-danger-fg);
  border-color: var(--color-danger-fg);
}
.rbc-event.state-COMPLETED,
.rbc-event.status-OFF_DUTY,
.rbc-event.absence-OTHER {
  background: var(--color-neutral-bg);
  color: var(--color-neutral-fg);
  border-color: var(--color-text-muted);
}

.ds-cal-event-editing {
  outline: 1.5px solid var(--color-accent);
  outline-offset: -1px;
}

/* ============================================================
   Reduced motion
   ============================================================ */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}

/* ============================================================
   Body class used by JS during column resize
   ============================================================ */
body.clients-resizing { cursor: col-resize !important; user-select: none; }
body.clients-resizing * { cursor: col-resize !important; }
```

- [ ] **Step 2: Update `web/src/main.tsx` to import new CSS**

Replace `import "./styles.css";` with `import "./index.css";`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./i18n";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "leaflet/dist/leaflet.css";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, staleTime: 5_000 } }
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
```

- [ ] **Step 3: Verify dev server boots**

Run: `cd web && npm run dev`
Expected: Vite reports `Local: http://localhost:5173`, no Tailwind config errors. Tokens render (background is warm off-white).
Kill the dev server (Ctrl-C) before continuing.

- [ ] **Step 4: Commit**

```bash
git add web/src/index.css web/src/main.tsx
git commit -m "feat(web): tailwind v4 + @theme tokens, replace styles.css base"
```

---

## Task 1.4: Create `lib/utils.ts`

**Files:**
- Create: `web/src/lib/utils.ts`

- [ ] **Step 1: Create utils.ts**

Create `web/src/lib/utils.ts`:

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 2: Verify TypeScript build**

Run: `cd web && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/lib/utils.ts
git commit -m "chore(web): add cn() utility for tailwind class merging"
```

---

## Task 1.5: Initialise shadcn

**Files:**
- Create: `web/components.json` (via CLI)
- Modify: `web/tsconfig.json` (add path alias)

- [ ] **Step 1: Add `@/*` path alias in `tsconfig.json`**

Read current `web/tsconfig.json` and add to `compilerOptions`:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

Also add same in `web/tsconfig.node.json` if it references paths.

- [ ] **Step 2: Add Vite alias in `vite.config.ts`**

Update `web/vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  server: { port: 5173 }
});
```

- [ ] **Step 3: Run shadcn init**

Run interactively:
```bash
cd web && npx shadcn@latest init
```

Answer prompts:
- Which style: **new-york**
- Base color: **neutral**
- CSS variables: **yes**
- TypeScript: **yes**
- Components alias: `@/components`
- Utils alias: `@/lib/utils`
- CSS file: `src/index.css`
- React Server Components: **no**

Expected: creates `web/components.json`, may inject shadcn CSS variables into `src/index.css`. If it inserts a `:root { --background: ... }` block, **leave it** — our `@theme` block overrides where needed; the shadcn defaults coexist as fallbacks.

- [ ] **Step 4: Verify build still works**

Run: `cd web && npm run build`
Expected: build succeeds, output in `dist/`.

- [ ] **Step 5: Commit**

```bash
git add web/components.json web/tsconfig.json web/tsconfig.node.json web/vite.config.ts web/src/index.css
git commit -m "chore(web): shadcn init (new-york, neutral base, @ alias)"
```

---

## Task 1.6: Install all shadcn primitives

**Files:**
- Create: `web/src/components/ui/*.tsx` (via CLI)

- [ ] **Step 1: Install components**

Run:
```bash
cd web && npx shadcn@latest add \
  button input label textarea select \
  dialog sheet table badge card \
  toggle-group toggle separator sonner
```

Expected: files created under `web/src/components/ui/`.

- [ ] **Step 2: Verify file list**

Run: `ls web/src/components/ui/`
Expected output includes: `button.tsx input.tsx label.tsx textarea.tsx select.tsx dialog.tsx sheet.tsx table.tsx badge.tsx card.tsx toggle-group.tsx toggle.tsx separator.tsx sonner.tsx`.

- [ ] **Step 3: Verify build**

Run: `cd web && npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/ui/ web/package.json web/package-lock.json
git commit -m "feat(web): install shadcn primitives (button, dialog, sheet, table, ...)"
```

---

## Task 1.7: Customise shadcn Button variants to match design

**Files:**
- Modify: `web/src/components/ui/button.tsx`

- [ ] **Step 1: Update button variants to use design tokens**

Open `web/src/components/ui/button.tsx`. Locate the `buttonVariants` cva definition. Replace the `variants` block with:

```ts
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--color-accent)] text-[var(--color-surface-panel)] border border-[var(--color-accent)] hover:bg-[var(--color-accent-strong)] hover:border-[var(--color-accent-strong)]",
        outline:
          "bg-[var(--color-surface-panel)] text-[var(--color-text)] border border-[var(--color-hairline)] hover:bg-[var(--color-surface-container)] hover:border-[var(--color-hairline-strong)]",
        ghost:
          "bg-transparent border border-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface-container)] hover:text-[var(--color-text)]",
        destructive:
          "bg-[var(--color-surface-panel)] text-[var(--color-danger-fg)] border border-[var(--color-danger-hairline)] hover:bg-[var(--color-danger-bg)] hover:border-[var(--color-danger-fg)]",
      },
      size: {
        default: "h-9 px-3 py-2 text-[var(--text-sm)] rounded-[var(--radius-sm)]",
        sm: "h-7 px-2 text-[var(--text-xs)] rounded-[var(--radius-sm)]",
        xs: "h-6 px-2 text-[var(--text-xs)] rounded-[var(--radius-sm)]",
        icon: "h-9 w-9 rounded-[var(--radius-sm)]",
      },
    },
    defaultVariants: {
      variant: "outline",
      size: "default",
    },
  }
);
```

Note: `variant: "outline"` is the new default to match the current bare `<button>` styling.

- [ ] **Step 2: Verify TypeScript build**

Run: `cd web && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/ui/button.tsx
git commit -m "style(web): map Button variants to OKLCH design tokens"
```

---

# Phase 2 — Shared foundational components (sequential)

## Task 2.1: Rewrite Toast.tsx as Sonner facade

**Files:**
- Modify: `web/src/components/Toast.tsx`

- [ ] **Step 1: Replace Toast.tsx contents**

Replace entire `web/src/components/Toast.tsx`:

```tsx
import { ReactNode, useCallback, useMemo } from "react";
import { toast as sonnerToast } from "sonner";
import { ApiError } from "../api/client";
import { Toaster } from "./ui/sonner";

export type ToastKind = "info" | "success" | "warning" | "error";
export type ToastAction = { label: string; onClick: () => void };
export type ToastInput = {
  kind?: ToastKind;
  title?: string;
  message: string;
  durationMs?: number | null;
  action?: ToastAction;
};

type ToastCtx = {
  push: (t: ToastInput) => void;
  error: (e: unknown, opts?: { title?: string; action?: ToastAction }) => void;
  success: (message: string, opts?: { title?: string }) => void;
  dismiss: (id: string | number) => void;
};

function pushImpl(t: ToastInput): string | number {
  const kind = t.kind ?? "info";
  const duration = t.durationMs === undefined ? (kind === "error" ? 8000 : 5000) : t.durationMs ?? Infinity;
  const opts = {
    description: t.title ? t.message : undefined,
    duration,
    action: t.action
      ? { label: t.action.label, onClick: t.action.onClick }
      : undefined,
  };
  const label = t.title ?? t.message;
  switch (kind) {
    case "success": return sonnerToast.success(label, opts);
    case "warning": return sonnerToast.warning(label, opts);
    case "error":   return sonnerToast.error(label, opts);
    default:        return sonnerToast.info(label, opts);
  }
}

function errorImpl(e: unknown, opts?: { title?: string; action?: ToastAction }): void {
  let title = opts?.title ?? "Error";
  let message = "Something went wrong";
  if (e instanceof ApiError) {
    message = e.message;
    if (e.status === 409 && !opts?.title) title = "Conflict";
    else if (e.status === 404 && !opts?.title) title = "Not found";
    else if (e.status >= 500 && !opts?.title) title = "Server error";
  } else if (e instanceof Error) {
    message = e.message;
  } else if (typeof e === "string") {
    message = e;
  }
  pushImpl({ kind: "error", title, message, action: opts?.action });
}

export function useToast(): ToastCtx {
  const push = useCallback(pushImpl, []);
  const error = useCallback(errorImpl, []);
  const success = useCallback(
    (message: string, opts?: { title?: string }) =>
      pushImpl({ kind: "success", title: opts?.title, message }),
    []
  );
  const dismiss = useCallback((id: string | number) => sonnerToast.dismiss(id), []);
  return useMemo(() => ({ push, error, success, dismiss }), [push, error, success, dismiss]);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Toaster richColors closeButton position="top-right" />
    </>
  );
}
```

Note: `useToast` no longer requires a Provider in context (sonner is global), but `ToastProvider` is kept as a no-op wrapper that mounts the `<Toaster />` so `App.tsx` doesn't need restructuring.

- [ ] **Step 2: Verify TypeScript build**

Run: `cd web && npx tsc -b --noEmit`
Expected: no errors. Callers of `useToast()` still compile because the API surface is identical.

- [ ] **Step 3: Boot dev server, fire a toast manually**

Run: `cd web && npm run dev`
Trigger any UI action that produces a toast (e.g., delete an entity via the dispatch UI, or fire an intentional API error). Verify the toast appears in the top-right corner.
Kill the dev server.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/Toast.tsx
git commit -m "feat(web): rewrite ToastProvider as sonner facade, preserve useToast API"
```

---

## Task 2.2: Convert NavBar.tsx to Tailwind + Lucide icons

**Files:**
- Modify: `web/src/components/NavBar.tsx`

- [ ] **Step 1: Replace NavBar.tsx**

Replace `web/src/components/NavBar.tsx`:

```tsx
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Route, ClipboardList, HardHat, Truck, Award, Users, type LucideIcon } from "lucide-react";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { cn } from "@/lib/utils";

const NAV_LINKS: { to: string; icon: LucideIcon; key: string }[] = [
  { to: "/dispatch",  icon: Route,          key: "nav.dispatch" },
  { to: "/orders",    icon: ClipboardList,  key: "nav.orders" },
  { to: "/mechanics", icon: HardHat,        key: "nav.mechanics" },
  { to: "/vehicles",  icon: Truck,          key: "nav.vehicles" },
  { to: "/skills",    icon: Award,          key: "nav.skills" },
  { to: "/clients",   icon: Users,          key: "nav.clients" },
];

export function NavBar() {
  const { t } = useTranslation();
  return (
    <aside className="w-64 min-w-[256px] h-full border-r border-[var(--color-hairline)] bg-[var(--color-surface-panel)] flex flex-col overflow-y-auto z-10 shrink-0">
      <div className="flex items-center gap-2.5 p-4 border-b border-[var(--color-hairline)]">
        <svg width="36" height="36" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="shrink-0">
          <rect x="15" y="10" width="70" height="13" rx="2" fill="#c4622a"/>
          <rect x="43" y="10" width="14" height="40" rx="1.5" fill="#1e2438"/>
          <path d="M 38,50 A 12,12 0 0,1 62,50" fill="none" stroke="#1e2438" strokeWidth="5.5" strokeLinecap="round"/>
          <path d="M 27,50 A 23,23 0 0,1 73,50" fill="none" stroke="#1e2438" strokeWidth="5.5" strokeLinecap="round"/>
          <path d="M 16,50 A 34,34 0 0,1 84,50" fill="none" stroke="#1e2438" strokeWidth="5.5" strokeLinecap="round"/>
        </svg>
        <div className="flex flex-col overflow-hidden">
          <span className="text-[0.8rem] font-bold tracking-[0.08em] uppercase text-[var(--color-accent-strong)] leading-tight whitespace-nowrap">
            TerraPulse
          </span>
          <span className="font-mono text-[0.65rem] text-[var(--color-text-subtle)] tracking-[0.05em] uppercase whitespace-nowrap">
            Fleet Ops
          </span>
        </div>
      </div>

      <nav className="flex-1 px-1 py-2 flex flex-col gap-0.5">
        {NAV_LINKS.map(({ to, icon: Icon, key }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3.5 py-2.5 rounded-[var(--radius-sm)] text-[var(--text-sm)] no-underline border-l-4 border-transparent transition-colors",
                isActive
                  ? "bg-[var(--color-surface-container-high)] text-[var(--color-accent-strong)] font-semibold border-l-[var(--color-accent)] pl-2.5"
                  : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-container)] hover:text-[var(--color-text)]"
              )
            }
          >
            <Icon className="w-[18px] h-[18px] shrink-0" />
            {t(key)}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-[var(--color-hairline)] px-4 py-3 flex items-center justify-between gap-2">
        <span className="text-[var(--text-xs)] text-[var(--color-text-subtle)]">{t("app.tagline")}</span>
        <LanguageSwitcher />
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Verify visually**

Run: `cd web && npm run dev`. Navigate to `/dispatch`. The sidebar should look identical to before (warm off-white panel, amber active border, uppercase brand). Click between routes — active state highlights correctly.
Kill dev server.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/NavBar.tsx
git commit -m "refactor(web): convert NavBar to tailwind utilities + lucide icons"
```

---

## Task 2.3: Update App.tsx (sanity check + page wrapper)

**Files:**
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Update App.tsx to use Tailwind classes for app-shell**

Replace `web/src/App.tsx`:

```tsx
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { NavBar } from "./components/NavBar";
import { DispatchPage } from "./components/DispatchPage";
import { ClientsPage } from "./pages/ClientsPage";
import { MechanicsPage } from "./pages/MechanicsPage";
import { OrdersPage } from "./pages/OrdersPage";
import { VehiclesPage } from "./pages/VehiclesPage";
import { SkillsPage } from "./pages/SkillsPage";
import { ToastProvider } from "./components/Toast";
import { useDispatchSocket } from "./hooks/useDispatchSocket";

export default function App() {
  useDispatchSocket();
  return (
    <ToastProvider>
      <BrowserRouter>
        <div className="flex flex-row h-full overflow-hidden">
          <NavBar />
          <div className="flex-1 min-w-0 h-full overflow-y-auto bg-[var(--color-surface-app)] flex flex-col">
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
        </div>
      </BrowserRouter>
    </ToastProvider>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/App.tsx
git commit -m "refactor(web): convert app-shell to tailwind utilities"
```

---

# Phase 3 — Component clusters (PARALLELISABLE)

**Each cluster below is independent. Use claude-flow swarm to dispatch them in parallel:**

```
mcp__claude-flow__swarm_init({ topology: "mesh", maxAgents: 6, strategy: "parallel" })
```

Then spawn six `coder` agents, one per cluster (3.A → 3.F), each receiving its cluster spec verbatim. Each cluster commits independently.

---

## Task 3.A: Cluster A — Dispatch page (DispatchPage + 5 sub-components)

**Files (write scope for this cluster):**
- Modify: `web/src/components/DispatchPage.tsx`
- Modify: `web/src/components/MechanicList.tsx`
- Modify: `web/src/components/PendingOrders.tsx`
- Modify: `web/src/components/ResourceTimeline.tsx`
- Modify: `web/src/components/ServiceOrderDrawer.tsx`
- Modify: `web/src/components/DispatchModal.tsx`
- Modify: `web/src/components/SiteMap.tsx`

**Mapping reference (apply to every file in this cluster):**

| CSS class | Replacement |
|---|---|
| `<button className="primary">` | `<Button variant="default">` (from `@/components/ui/button`) |
| `<button className="danger">` | `<Button variant="destructive">` |
| `<button className="ghost">` | `<Button variant="ghost">` |
| `<button>` (default) | `<Button variant="outline">` |
| `.panel` | `<Card>...</Card>` — Card uses `p-4` (`14px` equivalent) by default after our customisation; if too tight, wrap in `<div className="p-3.5">` |
| `.dispatch` grid | `<div className="grid grid-cols-[280px_minmax(0,1fr)_auto] gap-3 p-3 flex-1 min-h-0 min-w-0">` |
| `.center` | `<div className="flex flex-col gap-3 min-h-0 min-w-0">` |
| `.mechanic-list` ul/li | inline Tailwind: `<ul className="list-none p-0 m-0">` and items `<li className={cn("flex gap-2.5 p-2 rounded-[var(--radius-sm)] cursor-pointer transition-colors hover:bg-[var(--color-surface-sunken)]", selected && "bg-[var(--color-accent-soft)]")}>` |
| `.modal-backdrop` + `.modal` | shadcn `<Dialog>` (see DispatchModal sample below) |
| `.drawer.panel` | shadcn `<Sheet>` with `side="right"` (see ServiceOrderDrawer sample below) |
| `.pending` `<ul>` with chips | flex-wrap container, each `<li>` becomes `<Button variant="outline" size="sm">` |
| `<span className="badge state-XXX">` | `<Badge className={cn("state-" + state)}>` |
| `material-symbols-outlined` icon spans | Lucide icon components (see icon map below) |

**Icon map for this cluster:**
- `route` → `Route`, `location_on` → `MapPin`, `close` → `X`, `arrow_back` → `ArrowLeft`, `assignment_ind` → `UserCheck`

**Dialog replacement sample (apply pattern to DispatchModal.tsx):**

```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Replace any `<div className="modal-backdrop"><div className="modal">...` with:
<Dialog open={open} onOpenChange={(v) => !v && onClose()}>
  <DialogContent className="max-w-[480px]">
    <DialogHeader>
      <DialogTitle>{title}</DialogTitle>
    </DialogHeader>
    {/* body */}
    <DialogFooter>
      <Button variant="ghost" onClick={onClose}>Cancel</Button>
      <Button variant="default" onClick={onConfirm}>Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Sheet replacement sample (apply pattern to ServiceOrderDrawer.tsx):**

```tsx
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

<Sheet open={!!order} onOpenChange={(v) => !v && onClose()}>
  <SheetContent side="right" className="w-[320px] sm:max-w-[320px]">
    <SheetHeader>
      <SheetTitle>{order?.code}</SheetTitle>
    </SheetHeader>
    <dl className="grid grid-cols-[110px_1fr] gap-x-2 gap-y-1 my-2">
      <dt className="text-[var(--color-text-muted)]">State</dt>
      <dd className="m-0"><Badge className={"state-" + order.state}>{order.state}</Badge></dd>
      {/* etc. */}
    </dl>
    {/* actions */}
  </SheetContent>
</Sheet>
```

**Steps:**

- [ ] **Step 1: Read every file in the cluster**

Read each of the 7 files listed above in full. Note all CSS classes referenced.

- [ ] **Step 2: Convert each file in order**

For each file, replace:
1. Native buttons with `<Button>` variants per mapping table
2. `material-symbols-outlined` spans with Lucide icons
3. Layout/utility classes with Tailwind utilities
4. `.panel` containers with `<Card>` where structural; convert decorative panels to `<div>` with Tailwind border/bg
5. `.modal-*` → `<Dialog>` (DispatchModal.tsx only)
6. `.drawer.panel` → `<Sheet>` (ServiceOrderDrawer.tsx only)
7. Badges: `<span className="badge state-XXX">X</span>` → `<Badge className={"state-" + x}>X</Badge>`

Preserve all behavior. Do not change any imports from `../api/*`, `../hooks/*`, or `../types`.

- [ ] **Step 3: Verify TypeScript build**

Run: `cd web && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 4: Verify visually**

Run: `cd web && npm run dev`. Open `/dispatch`. Verify:
- Sidebar list of mechanics renders
- Calendar timeline shows events with correct state colors
- Pending orders chips clickable
- Click a mechanic → drawer slides in from right (Sheet)
- Click "Dispatch nearest" or equivalent → modal opens (Dialog)
- All button styles match prior design

Kill dev server.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/DispatchPage.tsx web/src/components/MechanicList.tsx \
  web/src/components/PendingOrders.tsx web/src/components/ResourceTimeline.tsx \
  web/src/components/ServiceOrderDrawer.tsx web/src/components/DispatchModal.tsx \
  web/src/components/SiteMap.tsx
git commit -m "refactor(web): convert Dispatch cluster to shadcn (Dialog, Sheet, Button, Badge)"
```

---

## Task 3.B: Cluster B — Orders page + AddressLookup

**Files (write scope for this cluster):**
- Modify: `web/src/pages/OrdersPage.tsx`
- Modify: `web/src/components/AddressLookup.tsx`

**Component swaps:**
- `<table className="data-table">` → shadcn `<Table>`:
  ```tsx
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Code</TableHead>
        {/* ... */}
      </TableRow>
    </TableHeader>
    <TableBody>
      {orders.map((o) => (
        <TableRow
          key={o.id}
          onClick={() => select(o)}
          className={cn("cursor-pointer", selectedId === o.id && "bg-[var(--color-accent-soft)]")}
        >
          <TableCell>{o.code}</TableCell>
          {/* ... */}
        </TableRow>
      ))}
    </TableBody>
  </Table>
  ```
- `.filters select` → shadcn `<Select>`:
  ```tsx
  import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

  <Select value={stateFilter} onValueChange={setStateFilter}>
    <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
    <SelectContent>
      <SelectItem value="">All states</SelectItem>
      <SelectItem value="REQUESTED">Requested</SelectItem>
      {/* ... */}
    </SelectContent>
  </Select>
  ```
  Note: native `<select>` uses `onChange={e => setX(e.target.value)}`. Radix Select uses `onValueChange={setX}` (already unwrapped). Empty string is allowed as a value but must be on a `<SelectItem value="" />` — if shadcn complains, use a sentinel like `"__all"` and map it back to `""` in state.
- `.form-panel input` → `<Input>` from `@/components/ui/input`
- `.form-panel textarea` → `<Textarea>`
- `.form-panel label` → `<Label>`
- `.badge state-XXX` → `<Badge className={"state-" + state}>`
- Buttons → `<Button>` variants per mapping table
- `.toolbar`, `.filters`, `.form-row`, `.form-actions` → Tailwind flex/grid utilities
- `.page-header`, `.page-grid` → Tailwind utilities

**Icon map for this cluster:**
- `add` → `Plus`, `edit` → `Pencil`, `delete` → `Trash2`, `search` → `Search`, `location_on` → `MapPin`

**AddressLookup specifics:**
- `<input>` → `<Input>`
- Hit list `<ul>` stays a styled `<ul>` with Tailwind — do NOT replace with shadcn Command/Combobox (out of scope)

**Steps:**

- [ ] **Step 1: Read both files in full**

Read `web/src/pages/OrdersPage.tsx` (15KB) and `web/src/components/AddressLookup.tsx`.

- [ ] **Step 2: Convert AddressLookup.tsx**

Replace native `<input>` and buttons; convert layout to Tailwind. Preserve all handlers.

- [ ] **Step 3: Convert OrdersPage.tsx**

Replace in this order: filters Select → table → form inputs → buttons → badges → layout utilities.

- [ ] **Step 4: Verify TypeScript build**

Run: `cd web && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 5: Verify visually**

Run: `cd web && npm run dev`. Open `/orders`. Verify:
- Table renders, rows selectable, hover/selected colors correct
- State filter dropdown opens, filters table
- Create-order form: inputs typeable, address lookup returns hits, submit works
- Edit/delete row actions work

Kill dev server.

- [ ] **Step 6: Commit**

```bash
git add web/src/pages/OrdersPage.tsx web/src/components/AddressLookup.tsx
git commit -m "refactor(web): convert Orders page to shadcn Table/Select/Input"
```

---

## Task 3.C: Cluster C — Mechanics page + Absences

**Files (write scope for this cluster):**
- Modify: `web/src/pages/MechanicsPage.tsx`
- Modify: `web/src/components/AbsenceCalendarPicker.tsx`
- Modify: `web/src/components/AbsencesPanel.tsx`

**Component swaps (same patterns as Cluster B):**
- `.stat-grid` + `.stat-card` → `<div className="grid grid-cols-4 gap-2.5 mb-3"><Card>...</Card></div>` — keep the mono font for `.stat-card-value`: `font-mono text-2xl font-medium`
- `.data-table` → `<Table>`
- Native `<select>` (status filter, skill filter) → `<Select>`
- `.form-panel` inputs → `<Input>`, `<Label>`, `<Textarea>`
- `.seg-control` (view toggle) → `<ToggleGroup type="single" value={view} onValueChange={setView}><ToggleGroupItem value="grid">Grid</ToggleGroupItem>...</ToggleGroup>`
- Badges → `<Badge className={"status-" + status}>`
- `.page-grid.three-row` grid-template-areas → use Tailwind arbitrary grid: `<div className="grid gap-3.5 p-3.5" style={{ gridTemplateColumns: "1.6fr 1fr", gridTemplateAreas: "'list form' 'absences absences'" }}>` and on children `style={{ gridArea: "list" }}`

**AbsenceCalendarPicker.tsx:**
- Native inputs → `<Input>`, `<Select>`
- Toggle button → `<Button variant="ghost" size="sm">`
- Calendar wrapper `.absence-picker-cal` → keep CSS class (it sizes the react-big-calendar inside)

**AbsencesPanel.tsx:**
- Table → `<Table>`, form inputs → shadcn equivalents
- Date inputs (`<input type="date">`) → keep native `<Input type="date">` — Radix doesn't ship a DatePicker

**Icon map for this cluster:**
- `engineering` → `HardHat`, `calendar_month` → `Calendar`, `add` → `Plus`, `edit` → `Pencil`, `delete` → `Trash2`, `event_busy` → `CalendarX`

**Steps:**

- [ ] **Step 1: Read all three files in full**

- [ ] **Step 2: Convert AbsenceCalendarPicker.tsx and AbsencesPanel.tsx first**

Smaller files; do these as warm-up.

- [ ] **Step 3: Convert MechanicsPage.tsx**

- [ ] **Step 4: Verify TypeScript build**

Run: `cd web && npx tsc -b --noEmit`

- [ ] **Step 5: Verify visually**

Run: `cd web && npm run dev`. Open `/mechanics`. Verify:
- Stat cards show 4 numbers
- Table renders with status badges
- Filters work
- Click a mechanic → form populates
- Absences section: calendar picker renders, can add an absence, table updates

Kill dev server.

- [ ] **Step 6: Commit**

```bash
git add web/src/pages/MechanicsPage.tsx web/src/components/AbsenceCalendarPicker.tsx web/src/components/AbsencesPanel.tsx
git commit -m "refactor(web): convert Mechanics + Absences to shadcn (Table, Select, Card, ToggleGroup)"
```

---

## Task 3.D: Cluster D — Vehicles page

**Files (write scope for this cluster):**
- Modify: `web/src/pages/VehiclesPage.tsx`

**Component swaps:** same patterns as Cluster B and C — `.data-table` → `<Table>`, native `<select>` → `<Select>`, `.form-panel` → `<Input>`/`<Label>`/`<Textarea>`, buttons → `<Button>`, badges → `<Badge>`, layout to Tailwind.

**Vehicle-specific status badge classes:** `status-AVAILABLE`, `status-RESERVED`, `status-IN_SERVICE`, `status-OUT_OF_ORDER` — these stay as `@layer utilities` classes; pass via `<Badge className={"status-" + v.status}>`.

**Icon map for this cluster:**
- `construction` → `Truck`, `add` → `Plus`, `edit` → `Pencil`, `delete` → `Trash2`, `build` → `Wrench`

**Steps:**

- [ ] **Step 1: Read VehiclesPage.tsx in full**

- [ ] **Step 2: Convert in order:** filters → table → form → page layout.

- [ ] **Step 3: Verify TypeScript build**

Run: `cd web && npx tsc -b --noEmit`

- [ ] **Step 4: Verify visually**

Run: `cd web && npm run dev`. Open `/vehicles`. Verify:
- Status filter works
- Table renders, row selection drives form
- Form CRUD works (create/update/delete a vehicle)

Kill dev server.

- [ ] **Step 5: Commit**

```bash
git add web/src/pages/VehiclesPage.tsx
git commit -m "refactor(web): convert Vehicles page to shadcn Table/Select/Input"
```

---

## Task 3.E: Cluster E — Clients page

**Files (write scope for this cluster):**
- Modify: `web/src/pages/ClientsPage.tsx` (28KB — largest file)

**Component swaps:**
- `.clients-layout` (master-detail flex) → Tailwind: `<div className="flex-1 flex flex-row min-h-0 p-3.5 gap-0 relative">`
- `.client-list-panel` → `<div className="w-[var(--clients-list-width,320px)] min-w-[240px] max-w-[560px] shrink-0 flex flex-col gap-2 bg-[var(--color-surface-panel)] border border-[var(--color-hairline)] rounded-[var(--radius-md)] p-3.5 overflow-hidden">`
- `.client-detail-panel` → analogous Tailwind classes
- `.client-list-search` `<input>` → `<Input>` from shadcn
- `.client-card` (each row in left list) → `<button>` (semantic) or `<div role="button">` styled with Tailwind; preserve `selected` and `inactive` states via `cn(... selected && "bg-... border-[var(--color-accent)]", inactive && "opacity-60")`
- `.client-detail-header` → Tailwind flex
- `.client-state-badge--active` / `--inactive` → `<Badge variant="outline" className={cn(active ? "border-[var(--color-accent)] text-[var(--color-accent)] bg-[oklch(0.962_0.032_60)]" : "border-[var(--color-hairline-strong)] text-[var(--color-text-muted)] bg-[var(--color-surface-sunken)]")}>`
- `.sites-grid` → `<div className="grid grid-cols-2 gap-2.5">`
- `.site-card` → `<Card>` with `<CardHeader>` and `<CardContent>`; or for tighter layout, manual `<div className="border border-[var(--color-hairline)] rounded-[var(--radius-sm)] p-3 bg-[var(--color-surface-panel)]">`
- `.detail-empty-state` → flex center with Lucide icon (`<Users className="w-12 h-12 opacity-40" />`)
- `.form-panel-header` / `.form-panel-body` → Tailwind utility wrappers
- `.site-detail-back` → `<Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" />Back</Button>`
- `.site-map-empty` → dashed border placeholder via Tailwind
- `.clients-mobile-back` → `<Button variant="ghost" size="sm" className="md:hidden">...`
- `.clients-split-handle` (column resizer) → keep CSS class for the visual handle (`::before` pseudo); the handle's behavior is in JS — leave that untouched
- `.clients-resizing` body class — already kept in `index.css`

**Native form elements:**
- All `<input>` → `<Input>`
- All `<select>` → `<Select>` (note `onValueChange` vs `onChange`)
- All buttons → `<Button>` variants

**Icon map for this cluster:**
- `group` → `Users`, `business` → `Building2`, `place` → `MapPin`, `add` → `Plus`, `edit` → `Pencil`, `delete` → `Trash2`, `chevron_right` → `ChevronRight`, `arrow_back` → `ArrowLeft`, `domain` → `Building`, `location_on` → `MapPin`

**Responsive behavior (`@media max-width: 768px`):**
The `.clients-layout.mobile-detail` toggle and mobile back button rely on a `mobile-detail` class on the layout root. Keep this conditional class application — Tailwind doesn't replace conditional class toggles. For responsive utilities:
- `flex-col md:flex-row` instead of media query for `clients-layout`
- `hidden md:flex` and `flex md:hidden` for showing/hiding list vs detail on mobile

**Steps:**

- [ ] **Step 1: Read ClientsPage.tsx in full**

This is the largest file (28KB). Read entirely before editing.

- [ ] **Step 2: Convert in vertical slices**

Convert sections in this order:
1. Top-level layout (`.clients-layout`, panels)
2. Left list panel (search, scroll, cards)
3. Detail header
4. Sites grid + site cards
5. Site detail view (back button, map placeholder)
6. Edit form panel
7. Mobile back button + responsive toggles

- [ ] **Step 3: Verify TypeScript build**

Run: `cd web && npx tsc -b --noEmit`

- [ ] **Step 4: Verify visually**

Run: `cd web && npm run dev`. Open `/clients`. Verify:
- Left list renders with search; typing filters
- Click a client → detail shows on right
- Sites grid renders, click a site → site detail (back button works)
- Add client, edit client, delete client all work
- Add/edit site works
- Map renders when site has coordinates
- Resize handle between list and detail still works (column resize via drag)
- At <768px viewport: list and detail stack, mobile back button appears

Kill dev server.

- [ ] **Step 5: Commit**

```bash
git add web/src/pages/ClientsPage.tsx
git commit -m "refactor(web): convert Clients master-detail page to shadcn primitives"
```

---

## Task 3.F: Cluster F — Skills page + LanguageSwitcher

**Files (write scope for this cluster):**
- Modify: `web/src/pages/SkillsPage.tsx`
- Modify: `web/src/components/LanguageSwitcher.tsx`

**Component swaps:**
- `.data-table` → `<Table>`
- `<input>` → `<Input>`
- `<select>` (LanguageSwitcher) → `<Select>` with compact `<SelectTrigger>` styling (no chrome)
- Buttons → `<Button>` variants

**LanguageSwitcher specifics:**

Current LanguageSwitcher uses a small native `<select>` with the `.lang-switcher` class. Replace with shadcn Select:

```tsx
import { useTranslation } from "react-i18next";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  return (
    <Select value={i18n.language} onValueChange={(v) => i18n.changeLanguage(v)}>
      <SelectTrigger className="h-7 px-2 text-[var(--text-xs)] w-auto">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="en">EN</SelectItem>
        <SelectItem value="it">IT</SelectItem>
      </SelectContent>
    </Select>
  );
}
```

**Icon map for this cluster:**
- `workspace_premium` → `Award`, `add` → `Plus`, `edit` → `Pencil`, `delete` → `Trash2`

**Steps:**

- [ ] **Step 1: Read both files in full**

- [ ] **Step 2: Convert LanguageSwitcher.tsx**

- [ ] **Step 3: Convert SkillsPage.tsx**

- [ ] **Step 4: Verify TypeScript build**

Run: `cd web && npx tsc -b --noEmit`

- [ ] **Step 5: Verify visually**

Run: `cd web && npm run dev`. Verify:
- `/skills` page: table renders, CRUD works
- LanguageSwitcher (in sidebar footer): clicking opens dropdown with EN/IT, switching updates UI strings

Kill dev server.

- [ ] **Step 6: Commit**

```bash
git add web/src/pages/SkillsPage.tsx web/src/components/LanguageSwitcher.tsx
git commit -m "refactor(web): convert Skills page + LanguageSwitcher to shadcn"
```

---

# Phase 4 — Cleanup and verification (sequential)

## Task 4.1: Remove old `styles.css` and Material Symbols web font

**Files:**
- Delete: `web/src/styles.css`
- Modify: `web/index.html`

- [ ] **Step 1: Verify styles.css is no longer imported**

Run: `grep -rn "styles.css" web/src/ web/index.html`
Expected: no matches (only the historical commit log mentions it).

- [ ] **Step 2: Delete styles.css**

```bash
rm web/src/styles.css
```

- [ ] **Step 3: Remove Google Fonts links from index.html**

Replace `web/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <title>TerraPulse Fleet Operations</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Verify build**

Run: `cd web && npm run build`
Expected: build succeeds; `dist/` is produced.

- [ ] **Step 5: Commit**

```bash
git add -u web/src/styles.css web/index.html
git commit -m "chore(web): drop styles.css and Google Fonts CDN (replaced by tailwind + system fonts)"
```

---

## Task 4.2: Final type-check and lint pass

**Files:**
- None (verification only)

- [ ] **Step 1: Type-check**

Run: `cd web && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 2: Production build**

Run: `cd web && npm run build`
Expected: success, no warnings about Tailwind classes or shadcn components.

- [ ] **Step 3: Inspect bundle size**

Run: `cd web && du -sh dist/assets/*.css dist/assets/*.js`
Expected: CSS bundle smaller than the pre-migration `dist/assets/index-CkBIbO6U.css` (~current size). Note delta.

- [ ] **Step 4: Search for stragglers**

Run:
```bash
grep -rn "material-symbols-outlined" web/src/ web/index.html
grep -rn "className=\"badge" web/src/
grep -rn "className=\"button" web/src/
grep -rn "modal-backdrop\|drawer\.panel" web/src/
```
Expected: no matches (all converted).

- [ ] **Step 5: Commit (if any cleanup made in this task)**

If straggler grep returned matches and you fixed them:
```bash
git add web/src/
git commit -m "chore(web): clean up shadcn migration stragglers"
```

If no changes, skip commit.

---

## Task 4.3: End-to-end smoke test against running backend

**Files:**
- None (manual verification)

- [ ] **Step 1: Boot full stack**

Run: `just up`
Expected: db + backend + web all up.

- [ ] **Step 2: Walk through all routes**

Open browser at `http://localhost:5173`. For each route, verify:

| Route | Verify |
|---|---|
| `/dispatch` | mechanic list, calendar timeline events, click mechanic opens Sheet drawer, click pending order, modal dispatch works |
| `/orders` | filter, create, edit, delete, address lookup works |
| `/mechanics` | stat cards, filter, CRUD, absences add/list works |
| `/vehicles` | filter, CRUD |
| `/skills` | CRUD |
| `/clients` | search, master-detail, add client, add site, map, mobile responsive |

- [ ] **Step 3: Verify toasts**

Trigger an intentional error (e.g., create a duplicate skill, or delete a referenced entity) — verify a Sonner toast appears in the top-right with correct style (red border for errors).

- [ ] **Step 4: Verify keyboard focus**

Tab through the dispatch page — focus rings should be amber 2px outlines around every interactive element.

- [ ] **Step 5: Verify dark mode (if applicable)**

We did not implement dark mode (not in scope). Confirm light-only behavior is preserved.

- [ ] **Step 6: Tear down**

Run: `just down`

- [ ] **Step 7: Final commit message**

No commit if all clean. If small fixes needed, commit them with `fix(web): post-migration smoke-test corrections`.

---

# Self-Review Notes

**Spec coverage check:**
- Phase 1 covers Tailwind v4 install, vite plugin, `@theme` tokens, `lib/utils.ts`, shadcn init, primitives install, Button variant customisation. ✓
- Phase 2 covers Toast (Sonner facade preserving useToast API), NavBar (Lucide icons), App.tsx shell. ✓
- Phase 3 covers all 18 source files split across 6 parallelisable clusters. ✓
- Phase 4 covers styles.css deletion, Google Fonts removal, type-check, smoke test. ✓
- Spec risks addressed: Select API change documented in 3.B (with sentinel-value workaround); Sonner facade preserves caller contract (2.1); shadcn token clash handled by `@theme` order (1.5 step 3 note); icon mapping table per cluster.

**Placeholder scan:** No TBD/TODO. Each step shows the actual code or command.

**Type consistency:** `useToast()` signature stable across plan; `Button` variant names (`default`/`outline`/`ghost`/`destructive`) used consistently across clusters; `cn()` import path `@/lib/utils` consistent.

**Parallelisation invariant:** Each Phase 3 cluster's write scope is disjoint — no two clusters edit the same file. Verified against file list.
