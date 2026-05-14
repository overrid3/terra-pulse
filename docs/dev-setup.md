# Dev setup

## Prerequisites

| Tool       | Version       | Purpose                              | Install                                                                |
|------------|---------------|--------------------------------------|------------------------------------------------------------------------|
| Java       | **25**        | Quarkus 3.31 backend (full JDK 25 support, incl. native image) | `sdk install java 25.0.2-zulu`                                         |
| Maven      | 3.9+          | Wrapper auto-downloads if missing    | bundled `./mvnw` in `backend/`                                         |
| Node       | 18+           | Vite dev server, web build           | `nvm install 18`                                                       |
| Docker     | 20+           | Postgres + PostGIS container         | Docker Desktop or OrbStack                                             |
| `just`     | 1.36+         | Task runner                          | `brew install just`                                                    |
| `jq`       | any           | `seed.sh` script                     | `brew install jq`                                                      |

### Why Java 25?

Quarkus 3.31 (Nov 2025) [added full Java 25 support](https://quarkus.io/blog/quarkus-3-31-released/) — runtime images and native image builds with Mandrel. Earlier Quarkus 3.20 was stuck on Java 21 because its bundled Byte Buddy rejected JDK 25 class files:

```
java.lang.IllegalArgumentException: Java 25 (69) is not supported by the current version of Byte Buddy ...
```

The repo's `backend/.sdkmanrc` pins `25.0.2-zulu`. If you use SDKMAN, `sdk env` in `backend/` switches automatically. Java 21 also works (Quarkus 3.31 still supports it) but no longer required.

## First run

```bash
just up          # postgis + backend + web
just seed        # demo data via REST
```

Open:

- http://localhost:5173/ — dispatch UI (default route redirects to `/dispatch`)
- http://localhost:8080/q/swagger-ui — OpenAPI explorer
- http://localhost:8080/api/ping — backend liveness

## Workflow recipes

```bash
just            # list recipes
just db         # postgis container only (faster than full up)
just db-reset   # destructive: drop public schema; restart backend to re-migrate
just down       # stop everything
just seed       # idempotent-ish: every run creates new rows. Pair with db-reset for a clean slate.
```

Backend logs: `tail -f /tmp/terrapulse-backend.log`. Web logs: `tail -f /tmp/terrapulse-web.log`.

## Hot reload

- **Backend**: Quarkus dev mode reloads on the next HTTP request after a file changes. `curl http://localhost:8080/api/ping` is the cheapest trigger.
- **Web**: Vite HMR is automatic.

## Common issues

| Symptom                                                            | Fix                                                                                       |
|--------------------------------------------------------------------|-------------------------------------------------------------------------------------------|
| `java.lang.IllegalArgumentException: Java 25 (69) is not supported`| You're on Quarkus 3.20 with JDK 25 — upgrade Quarkus to 3.31+ or downgrade to Java 21. Current pom is 3.31.1. |
| Flyway migration `Vx` marked failed in `flyway_schema_history`     | `just db-reset` then restart backend. (POC has no Flyway repair flow.)                    |
| `connect ECONNREFUSED 127.0.0.1:8080` from web                     | Backend isn't ready yet. Check `/tmp/terrapulse-backend.log`.                             |
| Reservation POST returns 400 `clientId required`                   | New requirement after V6 — create a `Client` first via `POST /api/clients`.               |
| `duplicate_email` (409) when re-running `just seed`                | Run `just db-reset` first, then restart backend (so Flyway re-applies migrations), then `just seed`. |
| `pip's --user is unsupported`                                      | Only matters if you want a WS smoke client. Use `python3 -m venv` instead.                |

## Testing the WebSocket

The repo doesn't bundle a WS smoke tool. Quickest path:

```bash
python3 -m venv /tmp/wsenv && /tmp/wsenv/bin/pip install -q websocket-client
/tmp/wsenv/bin/python - <<'PY'
import websocket
ws = websocket.WebSocket()
ws.connect("ws://localhost:8080/ws/dispatch")
while True:
    print(ws.recv())
PY
```

Trigger events from another shell via REST and watch them stream in.

## Architecture orientation

Once the stack is up, see `docs/architecture.md` for the request flow diagrams and `docs/domain.md` for the state machine.
