-- ============================================================================
-- V14: scheduled window for service_order.
-- state column is VARCHAR(16) (per V2 convention) — no Postgres enum surgery.
-- Backfill DISPATCHED → SCHEDULED before the app's enum drops the value.
-- ============================================================================

UPDATE service_order
   SET state = 'SCHEDULED'
 WHERE state = 'DISPATCHED';

ALTER TABLE service_order
    ADD COLUMN scheduled_start_at TIMESTAMPTZ,
    ADD COLUMN scheduled_end_at   TIMESTAMPTZ,
    ADD CONSTRAINT sched_end_after_start CHECK (
        scheduled_end_at IS NULL OR scheduled_start_at IS NULL
        OR scheduled_end_at > scheduled_start_at
    );

CREATE INDEX service_order_schedule_idx
    ON service_order (mechanic_id, scheduled_start_at, scheduled_end_at)
 WHERE scheduled_start_at IS NOT NULL;
