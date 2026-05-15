CREATE TABLE site (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id       UUID          NOT NULL REFERENCES client(id) ON DELETE CASCADE,
    name            VARCHAR(255)  NOT NULL,
    lat             DOUBLE PRECISION,
    lng             DOUBLE PRECISION,
    location_label  VARCHAR(512),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX site_client_idx ON site (client_id);
