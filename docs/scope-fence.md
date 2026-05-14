# Scope fence

Status: **POC**. Production concerns are intentionally deferred. Do not suggest hardening in these areas without checking first.

Out of scope for the POC:

- Auth / authn / authz
- MQTT (mechanic GPS faked via `POST /api/dev/simulate-move`)
- Flutter mobile app
- OptaPlanner scheduling
- Native image build
- CI / CD
- Observability stack

See [architecture.md](architecture.md) § "Deferred work" for the full list and the target architecture in `Pre plan prompt 1.md`.
