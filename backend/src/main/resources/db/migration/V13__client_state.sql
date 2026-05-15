ALTER TABLE client
    ADD COLUMN state VARCHAR(16) NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE client
    ADD CONSTRAINT client_state_check CHECK (state IN ('ACTIVE', 'INACTIVE'));

CREATE INDEX client_state_idx ON client (state);
