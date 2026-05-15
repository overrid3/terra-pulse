-- Add optional site assignment to vehicle
ALTER TABLE vehicle ADD COLUMN site_id UUID REFERENCES site(id);
CREATE INDEX vehicle_site_idx ON vehicle (site_id);

-- Add site_id to service_order (nullable first, promoted to NOT NULL after backfill)
ALTER TABLE service_order ADD COLUMN site_id UUID REFERENCES site(id);
CREATE INDEX service_order_site_idx ON service_order (site_id);

-- Create a "Default Site" for every existing client
INSERT INTO site (id, client_id, name)
SELECT gen_random_uuid(), c.id, 'Default Site'
FROM client c
WHERE NOT EXISTS (SELECT 1 FROM site s WHERE s.client_id = c.id);

-- Assign all existing service_orders (with client_id) to that client's default site
UPDATE service_order so
SET site_id = s.id
FROM site s
WHERE so.client_id = s.client_id
  AND so.site_id IS NULL;

-- Handle orphaned orders (null client_id): create a placeholder client + site
INSERT INTO client (id, name, email)
SELECT gen_random_uuid(), 'Unassigned', 'unassigned@placeholder.local'
WHERE EXISTS (SELECT 1 FROM service_order WHERE client_id IS NULL AND site_id IS NULL)
  AND NOT EXISTS (SELECT 1 FROM client WHERE email = 'unassigned@placeholder.local');

INSERT INTO site (id, client_id, name)
SELECT gen_random_uuid(), c.id, 'Default Site'
FROM client c
WHERE c.email = 'unassigned@placeholder.local'
  AND NOT EXISTS (SELECT 1 FROM site s WHERE s.client_id = c.id);

UPDATE service_order so
SET site_id = s.id,
    client_id = c.id
FROM client c
JOIN site s ON s.client_id = c.id
WHERE c.email = 'unassigned@placeholder.local'
  AND so.client_id IS NULL
  AND so.site_id IS NULL;

-- Promote to NOT NULL
ALTER TABLE service_order ALTER COLUMN site_id SET NOT NULL;
