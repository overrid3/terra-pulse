CREATE TABLE client (
    id              UUID         PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    email           VARCHAR(255) NOT NULL,
    phone           VARCHAR(32),
    vat_number      VARCHAR(32),
    address_line1   VARCHAR(255),
    address_line2   VARCHAR(255),
    city            VARCHAR(128),
    postal_code     VARCHAR(16),
    country         VARCHAR(64),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX client_name_idx ON client (name);
CREATE UNIQUE INDEX client_email_unique ON client (lower(email));
