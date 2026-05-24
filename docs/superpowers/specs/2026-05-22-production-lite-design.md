# Production Lite — Design Spec

Date: 2026-05-22  
Status: approved  
Scope: Auth (Clerk), Mobile Responsive, Deployment + CI/CD (Oracle Always Free + GitHub Actions)

---

## 1. Auth — Clerk + Quarkus OIDC

### Decisions
- Identity provider: **Clerk** (SaaS, free tier, 10,000 MAU)
- Authorization model: **authenticated = full access** (no roles in v1)
- Clerk owns all identity; no user table in Terra Pulse DB

### Backend changes
- Add `quarkus-oidc` extension
- `application.properties`: configure `quarkus.oidc.auth-server-url` (Clerk JWKS endpoint) and `quarkus.oidc.client-id`
- Every REST resource class: add `@Authenticated` at class level
- WebSocket endpoint: add `@RolesAllowed({"**"})` — any valid token passes the handshake

### Frontend changes
- Add `@clerk/clerk-react` dependency
- Wrap `App.tsx` root in `<ClerkProvider publishableKey={...}>`
- Gate entire UI with `<SignedIn>` / `<SignedOut>` — unauthenticated users see Clerk hosted sign-in
- Add fetch/axios interceptor: inject `Authorization: Bearer <token>` on every API call via `useAuth().getToken()`
- WebSocket connection URL: append `?token=<token>` on upgrade (Quarkus reads it on handshake)

### Environment variables added
| Variable | Where |
|---|---|
| `CLERK_PUBLISHABLE_KEY` | Frontend build env |
| `CLERK_SECRET_KEY` | Backend / Docker secret |
| `quarkus.oidc.auth-server-url` | `application.properties` / env override |

---

## 2. Mobile Responsive

### Target
- All pages responsive at ≥ 320px (phone)
- Strategy: CSS-first; React-side logic only where CSS cannot handle it

### Navigation
- Current top nav: at `< 768px` collapses to a bottom navigation bar (thumb-reachable, fits ops-tool UX)
- Route icons + labels in bottom bar; active route highlighted

### Tables (mechanics, vehicles, clients, orders pages)
- `@media (max-width: 767px)`: each `<tr>` becomes a stacked card block via CSS `display: block`
- No new React components — CSS additions only

### Drawers / modals
- Already fixed-position; add `max-width: 100vw` cap + `padding` adjustment for small screens

### DispatchGantt — primary complexity
- New `useIsMobile.ts` hook wrapping `window.matchMedia('(max-width: 767px)')`
- `DispatchPage` renders `<DispatchGantt>` on desktop, `<DispatchOrderList>` on mobile
- `DispatchOrderList.tsx` (new): orders grouped by mechanic, each row shows order ID, vehicle, state badge, scheduled time. Tap opens existing `OrderDrawer`. No drag-and-drop.
- Unassigned pool on mobile: collapsible section at top of the list

### New files
- `web/src/components/DispatchOrderList.tsx`
- `web/src/hooks/useIsMobile.ts`

### What does NOT change
- Drawer internals (already work at any width)
- State badge component (already inline)
- Drag-and-drop: desktop only, no mobile equivalent in v1

---

## 3. Deployment + CI/CD

### Target infrastructure — Oracle Cloud Always Free (ARM VM)
- 1× Ampere A1 instance (4 OCPUs / 24 GB RAM, always-free tier)
- Single `docker-compose.yml` on the VM

```
nginx :80/:443
  ├── serves React static build (dist/)
  ├── proxies /api/* → quarkus:8080
  └── proxies /ws/*  → quarkus:8080

quarkus:8080 (JVM mode)
  └── JDBC → postgres:5432

postgres:16-postgis :5432
```

### Flyway
Runs automatically at Quarkus startup (`quarkus.flyway.migrate-at-start=true`). No separate migration step in pipeline.

### Docker images
| Image | Registry | Tag |
|---|---|---|
| `terra-pulse-backend` | `ghcr.io/<owner>/terra-pulse-backend` | `main-<sha>` + `latest` |
| `terra-pulse-web` | `ghcr.io/<owner>/terra-pulse-web` | `main-<sha>` + `latest` |

`terra-pulse-web` image = nginx base + React `dist/` baked in + nginx.conf with proxy rules.

### GitHub Actions — `pr-checks.yml`
Trigger: pull request to `main`

```
jobs:
  backend:
    - actions/setup-java (Java 25, Temurin)
    - mvn verify

  frontend:
    - actions/setup-node
    - npm ci
    - npm run type-check
    - npm run build
```

Both jobs must pass before merge.

### GitHub Actions — `deploy.yml`
Trigger: push to `main`

```
jobs:
  build-and-push:
    - Build backend Docker image (Dockerfile in backend/)
    - Build frontend (npm run build), bake into nginx image
    - Push both images to GHCR with sha + latest tags

  deploy:
    needs: build-and-push
    - SSH into Oracle VM (ORACLE_SSH_KEY secret)
    - docker compose pull
    - docker compose up -d --remove-orphans
```

### GitHub Secrets required
| Secret | Used by |
|---|---|
| `GHCR_TOKEN` | push images to GHCR |
| `ORACLE_SSH_KEY` | SSH deploy step |
| `ORACLE_HOST` | SSH deploy step |
| `CLERK_SECRET_KEY` | injected into backend container via docker-compose env |

### Oracle VM one-time setup (manual)
1. Provision Ampere A1 instance in OCI
2. Install Docker + Docker Compose
3. Open OCI ingress rules: TCP 80, 443
4. Create `/app/.env` with DB credentials + Clerk config
5. Place `docker-compose.yml` at `/app/docker-compose.yml`
6. Add deploy SSH key to `~/.ssh/authorized_keys`

### Dockerfiles needed (new)
- `backend/Dockerfile` — multistage: Maven build → JVM runtime image
- `web/Dockerfile` — multistage: npm build → nginx with custom config
- `docker-compose.prod.yml` at repo root — production only (db + backend + nginx/web)
- Existing `docker-compose.yml` stays unchanged (postgis + pgadmin for local dev). `just up/down` unaffected.
- Oracle VM and CI deploy step both reference `docker-compose.prod.yml` explicitly (`docker compose -f docker-compose.prod.yml ...`).
- `.env.prod` on the Oracle VM holds DB credentials + Clerk config; gitignored.

---

## Implementation order

1. **Auth** — backend OIDC config + `@Authenticated`, then frontend Clerk wrappers + token interceptor
2. **CI/CD** — `pr-checks.yml` + Dockerfiles + `deploy.yml` (can run without Oracle VM yet; just build + push)
3. **Mobile** — `useIsMobile`, `DispatchOrderList`, CSS responsive passes per page
4. **Deploy** — once Oracle VM is provisioned, run `docker compose up` and verify

---

## Out of scope (deferred to future iterations)
- Role-based access control (dispatcher vs admin)
- MQTT / mechanic GPS
- Native image (GraalVM)
- HTTPS / TLS termination (nginx config stub, cert provisioning deferred)
- Observability stack
