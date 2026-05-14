# Domain model

## Entities

| Entity            | Key fields                                                       | Notes                                       |
|-------------------|------------------------------------------------------------------|---------------------------------------------|
| `Vehicle`         | make, model, serial_number, vehicle_class, engine_hours, status  | Class enum: EXCAVATOR/DOZER/LOADER/GRADER/DUMP_TRUCK |
| `Mechanic`        | full_name, skills (TEXT[]), status, location (Point,4326)        | Status: IDLE/EN_ROUTE/IN_PROGRESS/OFF_DUTY  |
| `Client`          | name, email (unique), phone, vat_number, billing address fields  | B2B-shape; email enforced unique via partial index `lower(email)` |
| `Reservation` (abstract, JOINED) | vehicle, client, start_at, end_at, hire_type, status | CHECK `end_at > start_at`; app-level overlap check |
| `DryHireReservation` | daily_rate                                                    | Client supplies operator                    |
| `WetHireReservation` | hourly_rate, operator_mechanic                                | Provider supplies certified operator        |
| `ServiceOrder`    | vehicle, mechanic (nullable), client (nullable), vmrs_code, state, site_location, estimated/actual minutes | State machine below |
| `VmrsCode`        | code (PK, 9 digits), description, srt_minutes, difficulty_factor | Stub — 8 hardcoded rows in V4 migration     |

All entity primary keys are `UUID` with `GenerationType.UUID` (Hibernate 6 generator). Timestamps are `TIMESTAMPTZ`.

## Reservation paradigms

| Aspect              | Dry hire                            | Wet hire                                 |
|---------------------|-------------------------------------|------------------------------------------|
| Resource locked     | Vehicle only                        | Vehicle **and** certified mechanic       |
| Pricing             | Daily rate                          | Hourly rate (includes operator + insurance) |
| Operator validation | Client side                         | System verifies mechanic skill (POC: skip)|

## Service order state machine

```
REQUESTED ──► QUOTED ──► APPROVED ──► DISPATCHED ──► IN_PROGRESS ──► COMPLETED
   │            │            │             │              │             ▲
   └────────────┴────────────┴─────────────┴──────────────┘             │
                          CANCELLED (terminal)                          │
                                                                        │
                  override-state (admin only) ──────────────────────────┘
                  • only target CANCELLED or REQUESTED
                  • REQUESTED clears mechanic + all lifecycle timestamps
                  • every override appends an audit line to `notes`
```

### Per-target guards (normal transitions)

| Target       | Guard                                                  |
|--------------|--------------------------------------------------------|
| `QUOTED`     | `estimated_minutes` set                                |
| `DISPATCHED` | `mechanic` non-null; auto-sets `dispatched_at`         |
| `IN_PROGRESS`| auto-sets `started_at`                                 |
| `COMPLETED`  | `actual_minutes` set; auto-sets `completed_at`         |

Invalid transitions throw `IllegalStateTransitionException` → HTTP 409.

### Override semantics

`POST /api/service-orders/{id}/override-state` with body `{ "state": "CANCELLED" | "REQUESTED", "reason": "…" }`.

- Bypasses all guards above.
- Rejects every other target value with HTTP 400.
- On `REQUESTED`: clears `mechanic`, `dispatched_at`, `started_at`, `completed_at`, `actual_minutes`. This is a hard reopen — the order re-enters the normal workflow from scratch.
- Always appends `[override <isoTs>] <from> -> <to>: <reason>` to `notes`.
- Emits `SERVICE_ORDER_STATE_CHANGED` event with `override=true, reason=…` in the payload.

## VMRS stub

`vmrs_code` table holds 8 illustrative codes (digits-only 9-char keys). Real VMRS data is licensed; do not import it without sorting out terms.

`EstimationService.estimateMinutes(code) = ceil(srt_minutes * difficulty_factor)`. Same value is used at creation (REQUESTED default) and recomputed on transition to QUOTED. Per-vehicle difficulty modifiers are out of scope.

## WS event types

See `docs/api.md` § "WebSocket events" for payload shapes.

- `SERVICE_ORDER_CREATED` — fired on `POST /service-orders`
- `SERVICE_ORDER_STATE_CHANGED` — every transition (incl. override). Payload includes `fromState`, `toState`, and optional `override: true` + `reason`.
- `MECHANIC_LOCATION_UPDATED` — `PATCH /mechanics/{id}` with location, or `POST /dev/simulate-move`
- `MECHANIC_STATUS_CHANGED` — `PATCH /mechanics/{id}` when status changes
