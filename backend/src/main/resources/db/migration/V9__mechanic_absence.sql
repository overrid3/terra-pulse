-- V9: planned absences / OOO periods for mechanics.
-- Separate from MechanicStatus (which is current real-time state) — these are
-- known future windows: vacation, sick leave, training, etc.

CREATE TABLE mechanic_absence (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mechanic_id  UUID NOT NULL REFERENCES mechanic(id) ON DELETE CASCADE,
    start_at     TIMESTAMPTZ NOT NULL,
    end_at       TIMESTAMPTZ NOT NULL,
    type         VARCHAR(16) NOT NULL,
    reason       VARCHAR(255),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_absence_range CHECK (end_at > start_at)
);

CREATE INDEX idx_absence_mechanic_range
    ON mechanic_absence (mechanic_id, start_at, end_at);
