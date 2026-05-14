# Repo layout

| Dir        | Purpose                                                          |
|------------|------------------------------------------------------------------|
| `backend/` | Quarkus 3.31 (Java **25**), Hibernate ORM 7.2 + Spatial          |
| `web/`     | Vite + React 18 + TS, react-router-dom, react-big-calendar       |
| `infra/`   | Docker Compose support files + `seed.sh`                         |
| `mobile/`  | Flutter app — deferred (stub README only)                        |
| `docs/`    | Topic deep-dives                                                 |

## Web routes (`web/src/App.tsx`)

- `/dispatch`  — live board (mechanics × time, react-big-calendar)
- `/orders`    — workflow + history + admin override
- `/mechanics` — CRUD
- `/clients`   — CRUD (B2B fields)
