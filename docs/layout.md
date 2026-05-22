# Repo layout

| Dir        | Purpose                                                          |
|------------|------------------------------------------------------------------|
| `backend/` | Quarkus 3.31 (Java **25**), Hibernate ORM 7.2 + Spatial          |
| `web/`     | Vite + React 18 + TS, react-router-dom, react-big-calendar       |
| `infra/`   | Docker Compose support files + `seed.sh`                         |
| `mobile/`  | Flutter app — deferred (stub README only)                        |
| `docs/`    | Topic deep-dives                                                 |

## Web routes (`web/src/App.tsx`)

- `/dispatch`  — live board: header (Day/Week/Month toggle + prev/today/next + range label + search + mechanic filter + refresh + **`+ New Order`** button), **custom `DispatchGantt`** (mechanic rows × time columns, each row header has an **`+ Absence`** button) + right Unassigned Pool sidebar. The split between gantt and pool is **drag-resizable** (`tp.dispatch.poolWidth`, 240–600px, localStorage-persisted). Mechanic rows stay horizontal in all three views (Day = 07–19 hourly, Week = 7 day cols, Month = day-of-month cols). **Drag from pool onto a mechanic row to schedule** (state must be `APPROVED`; calls `POST /{id}/schedule`); a snap-to-30min preview rectangle previews the landing span with HH:mm callouts on both endpoints. **Drag an existing event block to a new position or mechanic row to reschedule** (`PATCH /{id}/schedule`, 15min snap, vertical motion crosses mechanics); the DragOverlay ghost shows live start/end pills. **Drag either edge handle of a SCHEDULED block to resize its duration** (`PATCH /{id}/schedule`, 30min snap); the preview rectangle is anchored to the actual `scheduledStartAt`/`scheduledEndAt` (chip span follows planned dates, not estimation), with an HH:mm label on each end and a vertical guide line on the active edge. The estimated duration appears as a dashed ghost rectangle behind the chip when planned ≠ estimated. **Double-click** a chip or use the **right-click context menu** (View details / Edit / Unassign / Delete) for inline actions. Conflict highlights (amber) appear on overlapping blocks. No RBC for dispatch.
- `/orders`    — master-detail: status segmented filter (Open/All/Requested/Dispatched/In-Progress/Completed), search by title/VMRS/client, industrial table + right detail panel for inspect/override/rename
- `/mechanics` — master-detail: stat cards (Total/In Field/Available/Off Duty), status segmented filter, search, table (avatar + status dot + skill chips + assignment + location). OOO mgmt opens in right Sheet drawer via row action (CalendarOff icon)
- `/vehicles`  — master-detail: status segmented filter, type Select, search by serial/make/model, side panel for form + history
- `/skills`    — master-detail: search, table + rename/delete actions
- `/clients`   — CRUD (B2B fields)

## Shared UI components (`web/src/components/`)

- `SearchInput` — token-styled input with leading magnifier + clear-on-value-present X. Used by Vehicles, Skills, Orders, Mechanics, Dispatch.
- `AbsencesPanel` — full OOO table + calendar picker. Embedded in Mechanics page Sheet drawer.
