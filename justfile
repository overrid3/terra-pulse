# TerraPulse — local dev recipes
# Usage: `just <recipe>`. `just` alone lists everything.

set shell := ["bash", "-cu"]

# Resolved at recipe time; falls back to system java if 21 isn't installed via SDKMAN.
java_home := `[ -d "$HOME/.sdkman/candidates/java/25.0.2-zulu" ] && echo "$HOME/.sdkman/candidates/java/25.0.2-zulu" || echo "$JAVA_HOME"`

default:
    @just --list

# Boot full stack (postgis + backend + web)
up: db _backend _web
    @echo ""
    @echo "==> Stack up"
    @echo "    API      http://localhost:8080/api"
    @echo "    Swagger  http://localhost:8080/q/swagger-ui"
    @echo "    WS       ws://localhost:8080/ws/dispatch"
    @echo "    Web      http://localhost:5173"
    @echo ""
    @echo "    tail -f /tmp/terrapulse-backend.log"
    @echo "    tail -f /tmp/terrapulse-web.log"

# Stop everything started by `up`
down:
    -pkill -f "quarkus:dev"     || true
    -pkill -f "vite"             || true
    docker compose down

# Postgres + PostGIS container only (waits for healthy)
db:
    docker compose up -d postgis
    @until docker exec terrapulse-postgis pg_isready -U terrapulse > /dev/null 2>&1; do sleep 1; done
    @echo "postgis ready on :5432"

# Drop schema and let backend re-apply Flyway migrations on next boot (DESTRUCTIVE).
db-reset: db
    docker exec terrapulse-postgis psql -U terrapulse -d terrapulse \
        -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO terrapulse;"
    @echo "schema cleared — restart backend (\`just _backend\`) to re-run migrations"

# Push the demo scenario via REST (requires backend up)
seed:
    bash infra/seed.sh

# --- private helpers (used by `up`) -----------------------------------

_backend:
    @echo "starting backend (Quarkus dev, Java 25)…"
    cd backend && JAVA_HOME="{{java_home}}" PATH="{{java_home}}/bin:$PATH" \
        nohup ./mvnw quarkus:dev > /tmp/terrapulse-backend.log 2>&1 & disown
    @# wait until http server listens, max 90s
    @for i in $(seq 1 90); do \
        curl -sf http://localhost:8080/api/ping > /dev/null && echo "backend ready" && exit 0; \
        sleep 1; \
    done; \
    echo "backend did not become ready — see /tmp/terrapulse-backend.log" && exit 1

_web:
    @echo "starting web (Vite)…"
    cd web && nohup npm run dev > /tmp/terrapulse-web.log 2>&1 & disown
    @for i in $(seq 1 30); do \
        curl -sf http://localhost:5173/ > /dev/null && echo "web ready" && exit 0; \
        sleep 1; \
    done; \
    echo "web did not become ready — see /tmp/terrapulse-web.log" && exit 1
