# TerraPulse

Earthmoving fleet management POC. Quarkus + PostGIS backend, React dispatch dashboard.

## Quick start

```bash
# 1. Database
docker compose up -d postgis

# 2. Backend (Quarkus dev mode, hot reload)
cd backend
./mvnw quarkus:dev
#   → API     http://localhost:8080/api
#   → OpenAPI http://localhost:8080/q/swagger-ui
#   → WS      ws://localhost:8080/ws/dispatch

# 3. Web (separate terminal)
cd web
npm install
npm run dev
#   → http://localhost:5173
```

Optional pgAdmin: `docker compose --profile tools up -d pgadmin` → http://localhost:5050.

## Layout

| Dir         | Purpose                                          |
|-------------|--------------------------------------------------|
| `backend/`  | Quarkus 3.20 (Java 21) + Hibernate Spatial       |
| `web/`      | Vite + React + TypeScript dispatch dashboard     |
| `infra/`    | Docker Compose support files (postgres, pgadmin) |
| `mobile/`   | Flutter app stub — deferred                      |

## Scope

POC vertical slice. OptaPlanner and VMRS are stubbed; MQTT and Flutter deferred. See `Pre plan prompt 1.md` for the full target architecture and `~/.claude/plans/i-want-to-create-jiggly-horizon.md` for the bootstrap plan.
