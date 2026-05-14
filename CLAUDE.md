# TerraPulse — Claude guide

POC earthmoving fleet management. Quarkus + PostGIS backend, React dispatch UI. Mobile + MQTT deferred.

**Read [docs/scope-fence.md](docs/scope-fence.md) before suggesting hardening.**

## Table of contents

### Operating the repo
- [docs/quick-start.md](docs/quick-start.md) — `just up` / `just seed` / `just down`
- [docs/dev-setup.md](docs/dev-setup.md) — Java 25 via SDKMAN, justfile recipes, troubleshooting
- [docs/layout.md](docs/layout.md) — directories + web routes
- [docs/commit-style.md](docs/commit-style.md) — conventional commits, one concern per commit

### Rules (read before changing code)
- [docs/non-negotiables.md](docs/non-negotiables.md) — Java 25, Flyway-owned schema, state-machine guards, DevResource gating, Client FK rules
- [docs/stack-quirks.md](docs/stack-quirks.md) — WS broadcast API, Postgres NULL param inference, react-big-calendar resource view
- [docs/scope-fence.md](docs/scope-fence.md) — what stays out of the POC

### Reference deep-dives
- [docs/architecture.md](docs/architecture.md) — backend layers, WS flow, why each tech
- [docs/domain.md](docs/domain.md) — entities, state machine, hire types, override semantics
- [docs/api.md](docs/api.md) — REST endpoint catalog + WS event envelope

### Design context
- [PRODUCT.md](PRODUCT.md) — users, brand, anti-references, design principles
- [DESIGN.md](DESIGN.md) — color tokens, typography, components, motion
- `Pre plan prompt 1.md` — original blueprint with full target architecture (OptaPlanner, MQTT, Flutter)
