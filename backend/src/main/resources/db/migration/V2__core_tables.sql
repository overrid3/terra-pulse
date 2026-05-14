-- ============================================================================
-- TerraPulse core schema
-- All IDs are UUID. All timestamps are TIMESTAMPTZ (UTC). Enums stored as
-- VARCHAR with app-level validation (avoids Postgres enum migration friction).
-- ============================================================================

-- ----- VMRS reference (stub) ------------------------------------------------
CREATE TABLE vmrs_code (
    code               VARCHAR(9)    PRIMARY KEY,
    description        VARCHAR(255)  NOT NULL,
    srt_minutes        INT           NOT NULL CHECK (srt_minutes > 0),
    difficulty_factor  NUMERIC(3,2)  NOT NULL DEFAULT 1.00 CHECK (difficulty_factor > 0)
);

-- ----- Vehicle --------------------------------------------------------------
CREATE TABLE vehicle (
    id              UUID          PRIMARY KEY,
    make            VARCHAR(64)   NOT NULL,
    model           VARCHAR(64)   NOT NULL,
    serial_number   VARCHAR(64)   NOT NULL UNIQUE,
    vehicle_class   VARCHAR(32)   NOT NULL,
    engine_hours    NUMERIC(10,2) NOT NULL DEFAULT 0,
    status          VARCHAR(16)   NOT NULL,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX vehicle_status_idx ON vehicle (status);

-- ----- Mechanic -------------------------------------------------------------
CREATE TABLE mechanic (
    id                    UUID                    PRIMARY KEY,
    full_name             VARCHAR(128)            NOT NULL,
    phone                 VARCHAR(32),
    skills                TEXT[]                  NOT NULL DEFAULT ARRAY[]::TEXT[],
    status                VARCHAR(16)             NOT NULL,
    location              geometry(Point, 4326),
    location_updated_at   TIMESTAMPTZ,
    created_at            TIMESTAMPTZ             NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ             NOT NULL DEFAULT now()
);
CREATE INDEX mechanic_status_idx ON mechanic (status);

-- ----- Reservation (JOINED inheritance parent) ------------------------------
CREATE TABLE reservation (
    id            UUID         PRIMARY KEY,
    vehicle_id    UUID         NOT NULL REFERENCES vehicle(id),
    client_name   VARCHAR(255) NOT NULL,
    start_at      TIMESTAMPTZ  NOT NULL,
    end_at        TIMESTAMPTZ  NOT NULL,
    hire_type     VARCHAR(16)  NOT NULL,
    status        VARCHAR(16)  NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT reservation_window_chk CHECK (end_at > start_at)
);
CREATE INDEX reservation_vehicle_window_idx ON reservation (vehicle_id, start_at, end_at);

CREATE TABLE dry_hire_reservation (
    id          UUID          PRIMARY KEY REFERENCES reservation(id) ON DELETE CASCADE,
    daily_rate  NUMERIC(10,2) NOT NULL
);

CREATE TABLE wet_hire_reservation (
    id                    UUID          PRIMARY KEY REFERENCES reservation(id) ON DELETE CASCADE,
    hourly_rate           NUMERIC(10,2) NOT NULL,
    operator_mechanic_id  UUID          REFERENCES mechanic(id)
);

-- ----- Service Order --------------------------------------------------------
CREATE TABLE service_order (
    id                  UUID                  PRIMARY KEY,
    vehicle_id          UUID                  NOT NULL REFERENCES vehicle(id),
    mechanic_id         UUID                  REFERENCES mechanic(id),
    vmrs_code           VARCHAR(9)            NOT NULL REFERENCES vmrs_code(code),
    state               VARCHAR(16)           NOT NULL,
    estimated_minutes   INT                   NOT NULL CHECK (estimated_minutes > 0),
    actual_minutes      INT                   CHECK (actual_minutes IS NULL OR actual_minutes > 0),
    site_location       geometry(Point, 4326) NOT NULL,
    requested_at        TIMESTAMPTZ           NOT NULL DEFAULT now(),
    dispatched_at       TIMESTAMPTZ,
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    notes               TEXT,
    created_at          TIMESTAMPTZ           NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ           NOT NULL DEFAULT now()
);
CREATE INDEX service_order_state_idx ON service_order (state);
CREATE INDEX service_order_mechanic_state_idx ON service_order (mechanic_id, state);
