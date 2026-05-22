# CI/CD + Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** GitHub Actions pipeline with PR checks and auto-deploy to Oracle Always Free ARM VM via Docker Compose. Docker images pushed to GHCR. Local dev (`just up/down`) unaffected.

**Architecture:** Two Dockerfiles (backend JVM image, nginx + React static). `docker-compose.prod.yml` at repo root (separate from local `docker-compose.yml`). Two GitHub Actions workflows: `pr-checks.yml` (build + test on PR), `deploy.yml` (build images → push GHCR → SSH deploy on merge to main). PostGIS service container in CI for backend tests.

**Tech Stack:** Eclipse Temurin 25, Node 22, nginx:1.27-alpine, postgis/postgis:16-3.4, Docker Buildx, GHCR (`ghcr.io`), `appleboy/ssh-action`, GitHub Actions.

---

### Task 1: Backend Dockerfile

**Files:**
- Create: `backend/Dockerfile`

Context when building: repo root (`docker build -f backend/Dockerfile .`).

- [ ] **Step 1: Create backend/Dockerfile**

```dockerfile
FROM maven:3.9-eclipse-temurin-25 AS build
WORKDIR /workspace
COPY backend/pom.xml backend/pom.xml
COPY backend/src backend/src
WORKDIR /workspace/backend
RUN mvn package -DskipTests -q

FROM eclipse-temurin:25-jre-jammy
WORKDIR /app
COPY --from=build /workspace/backend/target/quarkus-app/lib/ /app/lib/
COPY --from=build /workspace/backend/target/quarkus-app/*.jar /app/
COPY --from=build /workspace/backend/target/quarkus-app/app/ /app/app/
COPY --from=build /workspace/backend/target/quarkus-app/quarkus/ /app/quarkus/
EXPOSE 8080
CMD ["java", "-jar", "quarkus-run.jar"]
```

- [ ] **Step 2: Build locally to verify**

From repo root:

```bash
docker build -f backend/Dockerfile -t terrapulse-backend:test .
```

Expected: image builds, `maven package` succeeds.

- [ ] **Step 3: Run the image against local DB to verify it starts**

```bash
just db
docker run --rm --network host \
  -e QUARKUS_DATASOURCE_JDBC_URL=jdbc:postgresql://localhost:5432/terrapulse \
  -e QUARKUS_DATASOURCE_USERNAME=terrapulse \
  -e QUARKUS_DATASOURCE_PASSWORD=terrapulse \
  terrapulse-backend:test
```

Expected: Quarkus starts, Flyway runs, `/api/ping` responds. Stop with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add backend/Dockerfile
git commit -m "chore(deploy): add backend JVM Dockerfile"
```

---

### Task 2: nginx config for web image

**Files:**
- Create: `web/nginx.conf`

This config serves React static files and reverse-proxies `/api/` and `/ws/` to the `backend` container (Docker Compose service name).

- [ ] **Step 1: Create web/nginx.conf**

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;
    client_max_body_size 10m;

    # React SPA — serve index.html for all non-asset routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend REST API
    location /api/ {
        proxy_pass http://backend:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_connect_timeout 10s;
        proxy_read_timeout 60s;
    }

    # WebSocket (server-push dispatch board)
    location /ws/ {
        proxy_pass http://backend:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add web/nginx.conf
git commit -m "chore(deploy): add nginx reverse-proxy config for web image"
```

---

### Task 3: Web (React + nginx) Dockerfile

**Files:**
- Create: `web/Dockerfile`

Context when building: `web/` directory (`docker build web/`).

The React build bakes `VITE_API_BASE=/api` so the frontend uses relative paths, routed by nginx. `VITE_WS_BASE` is left unset — `dispatchSocket.ts` derives `ws://` or `wss://` from `window.location` at runtime.

- [ ] **Step 1: Create web/Dockerfile**

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_API_BASE=/api
ENV VITE_API_BASE=$VITE_API_BASE
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

- [ ] **Step 2: Build locally to verify**

From repo root:

```bash
docker build -t terrapulse-web:test web/
```

Expected: image builds, `npm run build` (tsc + vite) succeeds.

- [ ] **Step 3: Verify nginx config is embedded**

```bash
docker run --rm terrapulse-web:test cat /etc/nginx/conf.d/default.conf
```

Expected: outputs the `nginx.conf` content from Task 2.

- [ ] **Step 4: Commit**

```bash
git add web/Dockerfile
git commit -m "chore(deploy): add web nginx Dockerfile"
```

---

### Task 4: docker-compose.prod.yml and .env.prod.example

**Files:**
- Create: `docker-compose.prod.yml`
- Create: `.env.prod.example`
- Modify: `.gitignore`

- [ ] **Step 1: Create docker-compose.prod.yml**

```yaml
name: terrapulse-prod

services:
  db:
    image: postgis/postgis:16-3.4
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - postgis-prod:/var/lib/postgresql/data
      - ./infra/postgres/init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d ${DB_NAME}"]
      interval: 10s
      timeout: 5s
      retries: 10

  backend:
    image: ghcr.io/${GHCR_OWNER}/terra-pulse-backend:latest
    restart: unless-stopped
    environment:
      QUARKUS_DATASOURCE_USERNAME: ${DB_USER}
      QUARKUS_DATASOURCE_PASSWORD: ${DB_PASSWORD}
      QUARKUS_DATASOURCE_JDBC_URL: jdbc:postgresql://db:5432/${DB_NAME}
      QUARKUS_OIDC_AUTH_SERVER_URL: ${CLERK_ISSUER_URL}
      QUARKUS_HTTP_CORS_ORIGINS: ${CORS_ORIGIN}
      QUARKUS_PROFILE: prod
    depends_on:
      db:
        condition: service_healthy

  web:
    image: ghcr.io/${GHCR_OWNER}/terra-pulse-web:latest
    restart: unless-stopped
    ports:
      - "80:80"
    depends_on:
      - backend

volumes:
  postgis-prod:
```

- [ ] **Step 2: Create .env.prod.example**

```bash
# Copy to .env.prod on the Oracle VM and fill in real values.
# .env.prod is gitignored — never commit it.
DB_USER=terrapulse
DB_PASSWORD=change-me
DB_NAME=terrapulse
GHCR_OWNER=<your-github-username-or-org>
CLERK_ISSUER_URL=https://<your-clerk-subdomain>.clerk.accounts.dev
CORS_ORIGIN=https://<your-domain-or-vm-ip>
```

- [ ] **Step 3: Gitignore .env.prod**

Open `.gitignore` and add:

```
.env.prod
```

- [ ] **Step 4: Verify docker-compose.prod.yml syntax**

```bash
docker compose -f docker-compose.prod.yml config --quiet
```

Expected: no syntax errors (will warn about missing env vars, that is expected).

- [ ] **Step 5: Commit**

```bash
git add docker-compose.prod.yml .env.prod.example .gitignore
git commit -m "chore(deploy): add production docker-compose and env example"
```

---

### Task 5: GitHub Actions — PR checks workflow

**Files:**
- Create: `.github/workflows/pr-checks.yml`

Backend tests require `postgis/postgis:16-3.4` as a service container. `V1__enable_postgis.sql` migration creates the PostGIS extension on startup — `postgis/postgis:16-3.4` has the extension available.

- [ ] **Step 1: Create .github/workflows/pr-checks.yml**

```yaml
name: PR Checks

on:
  pull_request:
    branches: [main]

jobs:
  backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgis/postgis:16-3.4
        env:
          POSTGRES_USER: terrapulse
          POSTGRES_PASSWORD: terrapulse
          POSTGRES_DB: terrapulse
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 10
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: "25"
          cache: maven

      - name: Run backend tests
        run: mvn -f backend/pom.xml verify -q
        env:
          QUARKUS_DATASOURCE_JDBC_URL: jdbc:postgresql://localhost:5432/terrapulse
          QUARKUS_DATASOURCE_USERNAME: terrapulse
          QUARKUS_DATASOURCE_PASSWORD: terrapulse

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm
          cache-dependency-path: web/package-lock.json

      - name: Install dependencies
        run: npm ci --prefix web

      - name: Build (includes type-check via tsc -b)
        run: npm run build --prefix web
        env:
          VITE_CLERK_PUBLISHABLE_KEY: pk_test_placeholder
          VITE_API_BASE: /api
```

`VITE_CLERK_PUBLISHABLE_KEY` is set to a placeholder so Vite doesn't throw `Missing VITE_CLERK_PUBLISHABLE_KEY` at build time (if the auth plan has been applied). If auth plan is not yet applied, remove that env var.

- [ ] **Step 2: Create .github directory if it doesn't exist**

```bash
mkdir -p .github/workflows
```

- [ ] **Step 3: Verify YAML syntax locally**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/pr-checks.yml'))" && echo "YAML OK"
```

Expected: `YAML OK`.

- [ ] **Step 4: Commit and push to a test branch to trigger the workflow**

```bash
git add .github/workflows/pr-checks.yml
git commit -m "ci: add PR checks workflow (backend tests + frontend build)"
git push origin HEAD
```

Open GitHub → Actions tab. Verify workflow triggers on the PR.

Expected: both `backend` and `frontend` jobs pass (green).

---

### Task 6: GitHub Actions — deploy workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

Requires these GitHub repository secrets (set at Settings → Secrets → Actions):
- `ORACLE_HOST` — public IP of the Oracle VM
- `ORACLE_SSH_KEY` — private SSH key (the corresponding public key must be in `~/.ssh/authorized_keys` on the VM)
- `GHCR_TOKEN` — not needed (workflow uses `GITHUB_TOKEN` for GHCR which is automatic)

- [ ] **Step 1: Create .github/workflows/deploy.yml**

```yaml
name: Deploy

on:
  push:
    branches: [main]

env:
  REGISTRY: ghcr.io
  BACKEND_IMAGE: ghcr.io/${{ github.repository_owner }}/terra-pulse-backend
  WEB_IMAGE: ghcr.io/${{ github.repository_owner }}/terra-pulse-web

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    outputs:
      sha: ${{ github.sha }}
    steps:
      - uses: actions/checkout@v4

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build and push backend image
        uses: docker/build-push-action@v6
        with:
          context: .
          file: backend/Dockerfile
          push: true
          tags: |
            ${{ env.BACKEND_IMAGE }}:latest
            ${{ env.BACKEND_IMAGE }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Build and push web image
        uses: docker/build-push-action@v6
        with:
          context: web
          file: web/Dockerfile
          push: true
          tags: |
            ${{ env.WEB_IMAGE }}:latest
            ${{ env.WEB_IMAGE }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          build-args: |
            VITE_API_BASE=/api

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Oracle VM
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.ORACLE_HOST }}
          username: ubuntu
          key: ${{ secrets.ORACLE_SSH_KEY }}
          script: |
            set -e
            cd /app
            docker compose -f docker-compose.prod.yml pull
            docker compose -f docker-compose.prod.yml up -d --remove-orphans
            docker image prune -f
            echo "Deploy complete: ${{ github.sha }}"
```

- [ ] **Step 2: Verify YAML syntax**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml'))" && echo "YAML OK"
```

Expected: `YAML OK`.

- [ ] **Step 3: Commit (do NOT push to main yet — VM must be provisioned first)**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add deploy workflow — build images, push GHCR, SSH deploy"
```

Note: this workflow will fail until the Oracle VM is provisioned and `ORACLE_HOST` + `ORACLE_SSH_KEY` secrets are set in GitHub. Push to main only after completing Task 7.

---

### Task 7: Oracle VM first-time setup (manual recipe)

This task is not automated. Follow these steps once after the Oracle Ampere A1 VM is provisioned.

**Prerequisites:**
- OCI Console: Ampere A1 instance running Ubuntu 22.04 LTS
- OCI Security List: ingress rules for TCP 22, 80 (add 443 later for TLS)
- SSH access to the VM

- [ ] **Step 1: Install Docker + Docker Compose on the VM**

SSH into the VM, then:

```bash
sudo apt-get update -q
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt-get update -q
sudo apt-get install -y docker-ce docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
docker --version
docker compose version
```

- [ ] **Step 2: Create the app directory and files**

```bash
sudo mkdir -p /app
sudo chown ubuntu:ubuntu /app
cd /app
```

Copy `docker-compose.prod.yml` and `infra/` from the repo to `/app/` on the VM. You can either:
- `scp docker-compose.prod.yml ubuntu@<host>:/app/`
- Or clone the repo: `git clone https://github.com/<owner>/terra-pulse.git /tmp/repo && cp /tmp/repo/docker-compose.prod.yml /app/ && cp -r /tmp/repo/infra /app/`

- [ ] **Step 3: Create .env.prod on the VM**

```bash
cat > /app/.env.prod << 'EOF'
DB_USER=terrapulse
DB_PASSWORD=<strong-random-password>
DB_NAME=terrapulse
GHCR_OWNER=<your-github-username-or-org>
CLERK_ISSUER_URL=https://<your-clerk-subdomain>.clerk.accounts.dev
CORS_ORIGIN=http://<vm-public-ip>
EOF
chmod 600 /app/.env.prod
```

- [ ] **Step 4: Add the deploy SSH key**

On your local machine, generate a dedicated deploy key:

```bash
ssh-keygen -t ed25519 -C "terra-pulse-deploy" -f ~/.ssh/terrapulse_deploy -N ""
```

Copy public key to VM:

```bash
ssh-copy-id -i ~/.ssh/terrapulse_deploy.pub ubuntu@<oracle-host>
```

Add private key to GitHub secrets:
- Go to repo → Settings → Secrets and variables → Actions
- Add secret `ORACLE_SSH_KEY` = contents of `~/.ssh/terrapulse_deploy`
- Add secret `ORACLE_HOST` = VM public IP

- [ ] **Step 5: Set GHCR_OWNER in .env.prod and log in to GHCR on VM**

On the VM:

```bash
echo "<github-pat-with-read:packages>" | docker login ghcr.io -u <github-username> --password-stdin
```

The deploy workflow uses `GITHUB_TOKEN` to push images, but the VM needs a PAT to pull them (unless the packages are public).

To make packages public: GitHub → your profile → Packages → terra-pulse-backend → Package settings → Change visibility → Public. Repeat for terra-pulse-web. If public, no VM login needed.

- [ ] **Step 6: First manual deploy to verify the stack**

On the VM:

```bash
cd /app
docker compose -f docker-compose.prod.yml --env-file .env.prod pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
docker compose -f docker-compose.prod.yml ps
```

Expected: three containers running (db, backend, web). Test:

```bash
curl http://localhost/api/ping
```

Expected: `{"status":"ok","service":"terrapulse-backend",...}`.

- [ ] **Step 7: Push to main to trigger automated deploy**

On your local machine:

```bash
git push origin main
```

Expected: GitHub Actions `deploy` workflow triggers, SSH step connects to VM, `docker compose pull && up` runs, new images deployed.

Check workflow logs in GitHub → Actions for success.
