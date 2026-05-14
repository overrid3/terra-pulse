ALTER TABLE service_order
    ADD COLUMN client_id UUID REFERENCES client(id);

CREATE INDEX service_order_client_id_idx ON service_order (client_id);
