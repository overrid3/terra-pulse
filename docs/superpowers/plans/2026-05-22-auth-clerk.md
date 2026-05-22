# Auth (Clerk + Quarkus OIDC) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Clerk-based authentication — all REST endpoints require a valid JWT; dev mode and existing tests remain unaffected.

**Architecture:** Frontend wraps in `ClerkProvider`, gates UI with `<SignedIn>`, injects Bearer token on every API call via a module-level token getter. Backend adds `quarkus-oidc` (prod profile only), annotates all REST resources with `@Authenticated`, disables security enforcement in dev/test via profile config and `@TestSecurity`. WS endpoint stays unauthenticated in v1 (server-push only; no sensitive writes through WS).

**Tech Stack:** `@clerk/clerk-react`, `quarkus-oidc`, `quarkus-test-security`, Quarkus profile properties (`%dev`, `%prod`, `%test`).

---

### Task 1: Add backend auth dependencies

**Files:**
- Modify: `backend/pom.xml`

- [ ] **Step 1: Add quarkus-oidc and quarkus-test-security to pom.xml**

Find the `<!-- Test -->` block and add after `rest-assured`:

```xml
        <dependency>
            <groupId>io.quarkus</groupId>
            <artifactId>quarkus-oidc</artifactId>
        </dependency>

        <!-- Test -->
        <dependency>
            <groupId>io.quarkus</groupId>
            <artifactId>quarkus-junit5</artifactId>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>io.rest-assured</groupId>
            <artifactId>rest-assured</artifactId>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>io.quarkus</groupId>
            <artifactId>quarkus-test-security</artifactId>
            <scope>test</scope>
        </dependency>
```

- [ ] **Step 2: Verify dependencies resolve**

```bash
cd backend && ./mvnw dependency:resolve -q
```

Expected: `BUILD SUCCESS` with no missing artifact errors.

- [ ] **Step 3: Commit**

```bash
git add backend/pom.xml
git commit -m "chore(auth): add quarkus-oidc + quarkus-test-security deps"
```

---

### Task 2: Configure OIDC in application.properties

**Files:**
- Modify: `backend/src/main/resources/application.properties`

Context: `%dev` profile = `just up` (local dev). `%prod` profile = Docker on Oracle VM. `%test` profile = `mvn verify`. All three need different security behavior.

- [ ] **Step 1: Write failing test to confirm unauthenticated request is rejected in prod config**

This step is a documentation test — no automated test exists for profile-based config. Proceed directly to implementation.

- [ ] **Step 2: Add OIDC configuration blocks to application.properties**

Append to `backend/src/main/resources/application.properties`:

```properties
# --- Security ---
# Dev: disable all auth enforcement so `just up` works without Clerk.
%dev.quarkus.security.auth.enabled-in-dev-mode=false

# Prod: OIDC Bearer token validation against Clerk.
# Set QUARKUS_OIDC_AUTH_SERVER_URL and optionally QUARKUS_HTTP_CORS_ORIGINS via env.
%prod.quarkus.oidc.application-type=service
%prod.quarkus.oidc.auth-server-url=${CLERK_ISSUER_URL}
%prod.quarkus.oidc.token.verify-audience=false
%prod.quarkus.http.cors.origins=${CORS_ORIGIN:http://localhost:5173}
```

`CLERK_ISSUER_URL` format: `https://<your-clerk-subdomain>.clerk.accounts.dev`
Quarkus fetches JWKS from `<CLERK_ISSUER_URL>/.well-known/openid-configuration` automatically.

`token.verify-audience=false` is required because Clerk JWTs carry `azp` (authorized party), not an `aud` matching your client ID.

- [ ] **Step 3: Verify backend still starts in dev mode**

```bash
just up
```

Expected: backend starts, `curl http://localhost:8080/api/ping` returns `{"status":"ok",...}` without a token.

- [ ] **Step 4: Kill backend**

```bash
just down
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/resources/application.properties
git commit -m "feat(auth): configure quarkus-oidc for prod, disable in dev"
```

---

### Task 3: Add @Authenticated to REST resources

**Files:**
- Modify: `backend/src/main/java/com/terrapulse/api/ClientResource.java`
- Modify: `backend/src/main/java/com/terrapulse/api/EstimationResource.java`
- Modify: `backend/src/main/java/com/terrapulse/api/GeoResource.java`
- Modify: `backend/src/main/java/com/terrapulse/api/MechanicAbsenceResource.java`
- Modify: `backend/src/main/java/com/terrapulse/api/MechanicResource.java`
- Modify: `backend/src/main/java/com/terrapulse/api/ReservationResource.java`
- Modify: `backend/src/main/java/com/terrapulse/api/ServiceOrderResource.java`
- Modify: `backend/src/main/java/com/terrapulse/api/SiteResource.java`
- Modify: `backend/src/main/java/com/terrapulse/api/SitesResource.java`
- Modify: `backend/src/main/java/com/terrapulse/api/SkillResource.java`
- Modify: `backend/src/main/java/com/terrapulse/api/VehicleResource.java`
- Modify: `backend/src/main/java/com/terrapulse/api/VmrsResource.java`

**NOT modified:** `PingResource` (health/liveness check, must stay open), `DevResource` (`@IfBuildProfile("dev")` — dev-only, no auth needed).

- [ ] **Step 1: Add @Authenticated import and annotation to each resource class**

For each of the 12 files listed above, add the import and the annotation on the class. Pattern (example on `MechanicResource`):

```java
import io.quarkus.security.Authenticated;

@Path("/api/mechanics")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Authenticated   // ← add this line
public class MechanicResource {
```

Repeat for all 12 files. The annotation placement is at class level (before `public class`). The import is `import io.quarkus.security.Authenticated;`.

- [ ] **Step 2: Verify compilation**

```bash
cd backend && ./mvnw compile -q
```

Expected: `BUILD SUCCESS`.

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/terrapulse/api/
git commit -m "feat(auth): protect all REST resources with @Authenticated"
```

---

### Task 4: Fix existing tests with @TestSecurity

`@Authenticated` rejects unauthenticated requests in the test profile too. Add `@TestSecurity(authorizationEnabled = false)` to each API integration test.

**Files:**
- Modify: `backend/src/test/java/com/terrapulse/api/EstimationResourceTest.java`
- Modify: `backend/src/test/java/com/terrapulse/api/NearestMechanicTest.java`
- Modify: `backend/src/test/java/com/terrapulse/api/ServiceOrderCreateTest.java`
- Modify: `backend/src/test/java/com/terrapulse/api/ServiceOrderOverrideTest.java`
- Modify: `backend/src/test/java/com/terrapulse/api/ServiceOrderRescheduleTest.java`
- Modify: `backend/src/test/java/com/terrapulse/api/ServiceOrderScheduleTest.java`
- Modify: `backend/src/test/java/com/terrapulse/api/VmrsResourceTest.java`

**NOT modified:** `ServiceOrderStateMachineTest`, `EstimationParserTest`, `TitleGeneratorTest` — these are unit tests, not HTTP tests.

- [ ] **Step 1: Add the annotation to all 7 API test classes**

Pattern (example on `VmrsResourceTest`):

```java
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import org.junit.jupiter.api.Test;

@QuarkusTest
@TestSecurity(authorizationEnabled = false)
class VmrsResourceTest {
```

Repeat for all 7 files: add `import io.quarkus.test.security.TestSecurity;` and `@TestSecurity(authorizationEnabled = false)` on the class.

- [ ] **Step 2: Run tests to verify they still pass**

```bash
just db
cd backend && ./mvnw test -q
```

Expected: all tests pass, no 401 errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/test/
git commit -m "test(auth): add @TestSecurity to API tests after @Authenticated"
```

---

### Task 5: Frontend — install Clerk + ClerkProvider + auth gate

**Files:**
- Modify: `web/package.json` (via npm install)
- Create: `web/src/lib/auth.ts`
- Create: `web/src/components/ClerkSync.tsx`
- Modify: `web/src/main.tsx`
- Modify: `web/src/App.tsx`
- Create: `web/.env.local` (gitignored)

- [ ] **Step 1: Install Clerk React SDK**

```bash
cd web && npm install @clerk/clerk-react
```

Expected: `@clerk/clerk-react` appears in `web/package.json` dependencies.

- [ ] **Step 2: Create auth.ts module (token getter singleton)**

Create `web/src/lib/auth.ts`:

```typescript
let _getToken: (() => Promise<string | null>) | null = null;

export function setTokenGetter(fn: () => Promise<string | null>): void {
  _getToken = fn;
}

export function getToken(): Promise<string | null> {
  return _getToken ? _getToken() : Promise.resolve(null);
}
```

- [ ] **Step 3: Create ClerkSync component**

Create `web/src/components/ClerkSync.tsx`:

```typescript
import { useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import { setTokenGetter } from "@/lib/auth";

export function ClerkSync() {
  const { getToken } = useAuth();
  useEffect(() => {
    setTokenGetter(() => getToken());
  }, [getToken]);
  return null;
}
```

- [ ] **Step 4: Wrap main.tsx with ClerkProvider**

Replace `web/src/main.tsx` content:

```typescript
import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./i18n";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "leaflet/dist/leaflet.css";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, staleTime: 5_000 } }
});

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!PUBLISHABLE_KEY) throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ClerkProvider>
  </React.StrictMode>
);
```

- [ ] **Step 5: Add SignedIn/SignedOut gate + ClerkSync to App.tsx**

Replace `web/src/App.tsx` content:

```typescript
import { SignedIn, SignedOut, RedirectToSignIn } from "@clerk/clerk-react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { NavBar } from "./components/NavBar";
import { DispatchPage } from "./components/DispatchPage";
import { ClientsPage } from "./pages/ClientsPage";
import { MechanicsPage } from "./pages/MechanicsPage";
import { OrdersPage } from "./pages/OrdersPage";
import { VehiclesPage } from "./pages/VehiclesPage";
import { SkillsPage } from "./pages/SkillsPage";
import { ToastProvider } from "./components/Toast";
import { TooltipProvider } from "./components/ui/tooltip";
import { useDispatchSocket } from "./hooks/useDispatchSocket";
import { ClerkSync } from "./components/ClerkSync";

export default function App() {
  useDispatchSocket();
  return (
    <>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
      <SignedIn>
        <ClerkSync />
        <ToastProvider>
          <TooltipProvider>
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
          </TooltipProvider>
        </ToastProvider>
      </SignedIn>
    </>
  );
}
```

- [ ] **Step 6: Create .env.local for dev**

Create `web/.env.local` (already gitignored by Vite default):

```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_<your-clerk-publishable-key>
```

Get this key from Clerk Dashboard → API Keys.

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd web && npm run build
```

Expected: `BUILD SUCCESS`, no type errors.

- [ ] **Step 8: Commit**

```bash
git add web/src/lib/auth.ts web/src/components/ClerkSync.tsx web/src/main.tsx web/src/App.tsx web/package.json web/package-lock.json
git commit -m "feat(auth): add ClerkProvider, SignedIn gate, ClerkSync token bridge"
```

---

### Task 6: Inject Bearer token on every API call

**Files:**
- Modify: `web/src/api/client.ts`

- [ ] **Step 1: Update request() to inject Authorization header**

Replace the `request` function in `web/src/api/client.ts`:

```typescript
import { UUID } from "../types";
import { getToken } from "@/lib/auth";

const BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8080/api";

export class ApiError extends Error {
  status: number;
  statusText: string;
  code: string | null;
  details: Record<string, unknown>;

  constructor(status: number, statusText: string, code: string | null, message: string, details: Record<string, unknown>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.statusText = statusText;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getToken();
  const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${BASE}${path}`, {
    headers: { "content-type": "application/json", ...authHeader, ...(init?.headers ?? {}) },
    ...init
  });
  if (!res.ok) {
    const raw = await res.text();
    let code: string | null = null;
    let message = `${res.status} ${res.statusText}`;
    let details: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        details = parsed;
        if (typeof parsed.error === "string") code = parsed.error;
        if (typeof parsed.message === "string") message = parsed.message;
      } else if (raw) {
        message = raw;
      }
    } catch {
      if (raw) message = raw;
    }
    throw new ApiError(res.status, res.statusText, code, message, details);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get:   <T>(p: string)                  => request<T>(p),
  post:  <T>(p: string, body?: unknown)  => request<T>(p, { method: "POST",  body: body == null ? undefined : JSON.stringify(body) }),
  put:   <T>(p: string, body?: unknown)  => request<T>(p, { method: "PUT",   body: body == null ? undefined : JSON.stringify(body) }),
  patch: <T>(p: string, body?: unknown)  => request<T>(p, { method: "PATCH", body: body == null ? undefined : JSON.stringify(body) }),
  delete:<T>(p: string)                  => request<T>(p, { method: "DELETE" })
};

export const queryKeys = {
  mechanics:    ["mechanics"] as const,
  serviceOrders:["serviceOrders"] as const,
  vehicles:     ["vehicles"] as const,
  clients:      ["clients"] as const,
  skills:       ["skills"] as const,
  absences:     ["absences"] as const,
  vmrs:         ["vmrs"] as const,
  sites:        (clientId: UUID) => ["sites", clientId] as const,
  sitesAll:     ["sites", "all"] as const
};
```

- [ ] **Step 2: Verify build**

```bash
cd web && npm run build
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/api/client.ts
git commit -m "feat(auth): inject Bearer token on all API calls"
```

---

### Task 7: Make WebSocket URL protocol-aware for production

The WS URL is currently hardcoded to `ws://localhost:8080`. In production behind nginx on port 80/443, the URL must derive from `window.location`. WS auth (token on WS handshake) is deferred to v2.

**Files:**
- Modify: `web/src/ws/dispatchSocket.ts`

- [ ] **Step 1: Update connectDispatchSocket to derive URL from window.location**

Replace `web/src/ws/dispatchSocket.ts`:

```typescript
export type DispatchEvent = {
  type:
    | "SERVICE_ORDER_CREATED"
    | "SERVICE_ORDER_STATE_CHANGED"
    | "SERVICE_ORDER_SCHEDULE_CHANGED"
    | "MECHANIC_LOCATION_UPDATED"
    | "MECHANIC_STATUS_CHANGED";
  occurredAt: string;
  payload: Record<string, unknown>;
};

type Listener = (e: DispatchEvent) => void;

function resolveWsUrl(): string {
  if (import.meta.env.VITE_WS_BASE) {
    return `${import.meta.env.VITE_WS_BASE}/dispatch`;
  }
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws/dispatch`;
}

export function connectDispatchSocket(onEvent: Listener): () => void {
  const url = resolveWsUrl();
  let ws: WebSocket | null = null;
  let closed = false;
  let backoffMs = 500;

  const open = () => {
    ws = new WebSocket(url);
    ws.onopen = () => { backoffMs = 500; };
    ws.onmessage = (m) => {
      try { onEvent(JSON.parse(m.data) as DispatchEvent); }
      catch (e) { console.warn("Bad WS payload", e); }
    };
    ws.onclose = () => {
      if (closed) return;
      setTimeout(open, backoffMs);
      backoffMs = Math.min(backoffMs * 2, 10_000);
    };
    ws.onerror = () => ws?.close();
  };
  open();

  return () => {
    closed = true;
    ws?.close();
  };
}
```

- [ ] **Step 2: Verify build**

```bash
cd web && npm run build
```

Expected: no errors.

- [ ] **Step 3: Smoke test locally (dev mode — no Clerk, WS connects to localhost)**

```bash
just up
```

Open `http://localhost:5173`. Since dev mode has `%dev.quarkus.security.auth.enabled-in-dev-mode=false`, the app should load (Clerk auth UI will appear because `VITE_CLERK_PUBLISHABLE_KEY` is set in `.env.local`). Sign in with a test account.

Expected: app loads, dispatch board renders, WS events arrive.

- [ ] **Step 4: Commit**

```bash
git add web/src/ws/dispatchSocket.ts
git commit -m "feat(auth): make WS URL protocol-aware for prod deploy"
```
