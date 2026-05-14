-- Migrate reservation.client_name (free text) to reservation.client_id FK.
-- Strategy: backfill one Client row per distinct client_name with placeholder
-- contact details, then promote client_id to NOT NULL and drop the old column.

ALTER TABLE reservation
    ADD COLUMN client_id UUID REFERENCES client(id);

INSERT INTO client (id, name, email)
SELECT gen_random_uuid(),
       sub.distinct_name,
       lower(replace(sub.distinct_name, ' ', '.')) || '@migrated.local'
  FROM (SELECT DISTINCT client_name AS distinct_name
          FROM reservation
         WHERE client_name IS NOT NULL) sub
ON CONFLICT DO NOTHING;

UPDATE reservation r
   SET client_id = c.id
  FROM client c
 WHERE r.client_name = c.name
   AND r.client_id IS NULL;

ALTER TABLE reservation
    ALTER COLUMN client_id SET NOT NULL,
    DROP COLUMN client_name;
