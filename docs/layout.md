# Repo layout

| Dir        | Purpose                                                          |
|------------|------------------------------------------------------------------|
| `backend/` | Quarkus 3.31 (Java **25**), Hibernate ORM 7.2 + Spatial          |
| `web/`     | Vite + React 18 + TS, react-router-dom, react-big-calendar       |
| `infra/`   | Docker Compose support files + `seed.sh`                         |
| `mobile/`  | Flutter app — deferred (stub README only)                        |
| `docs/`    | Topic deep-dives                                                 |

## Web routes (`web/src/App.tsx`)

- `/dispatch`  — live board: header (Day/Week/Month toggle + prev/today/next + range label + search + mechanic filter + refresh), **custom `DispatchGantt`** (mechanic rows × time columns) + right Unassigned Pool sidebar. Mechanic rows stay horizontal in all three views (Day = 07–19 hourly, Week = 7 day cols, Month = day-of-month cols). **Drag from pool onto a mechanic row to dispatch** (state must be `APPROVED`). **Drag an existing event onto another mechanic row to reassign** (`POST /service-orders/{id}/reassign`). Time-axis moves emit a toast — backend stores no scheduled time. No RBC for dispatch.
- `/orders`    — master-detail: status segmented filter (Open/All/Requested/Dispatched/In-Progress/Completed), search by title/VMRS/client, industrial table + right detail panel for inspect/override/rename
- `/mechanics` — master-detail: stat cards (Total/In Field/Available/Off Duty), status segmented filter, search, table (avatar + status dot + skill chips + assignment + location). OOO mgmt opens in right Sheet drawer via row action (CalendarOff icon)
- `/vehicles`  — master-detail: status segmented filter, type Select, search by serial/make/model, side panel for form + history
- `/skills`    — master-detail: search, table + rename/delete actions
- `/clients`   — CRUD (B2B fields)

## Shared UI components (`web/src/components/`)

- `SearchInput` — token-styled input with leading magnifier + clear-on-value-present X. Used by Vehicles, Skills, Orders, Mechanics, Dispatch.
- `AbsencesPanel` — full OOO table + calendar picker. Embedded in Mechanics page Sheet drawer.
