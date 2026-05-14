-- ============================================================================
-- Mnemonic title for service orders. Human-readable handle so dispatchers can
-- refer to an order without quoting the UUID + VMRS code.
--
-- Strategy:
--   1. Add column with a sentinel DEFAULT so the NOT NULL add is non-blocking
--      on existing rows.
--   2. Backfill every existing row with a deterministic placeholder built
--      from VMRS description (truncated) and the vehicle serial-number suffix.
--   3. Drop the DEFAULT so future inserts must supply a value explicitly
--      (the application layer auto-generates via TitleGenerator).
--   4. Add a case-insensitive btree index on lower(title) for search.
-- ============================================================================

ALTER TABLE service_order
    ADD COLUMN title VARCHAR(120) NOT NULL DEFAULT '?';

-- Backfill: "<VMRS-SHORT> · <SERIAL-SUFFIX>" e.g. "Engine oil + filter · A4F2"
UPDATE service_order so
SET title = trim(both ' ' FROM substring(c.description, 1, 30))
            || ' · '
            || upper(right(v.serial_number, 4))
FROM vehicle v, vmrs_code c
WHERE so.vehicle_id = v.id
  AND so.vmrs_code = c.code;

ALTER TABLE service_order
    ALTER COLUMN title DROP DEFAULT;

CREATE INDEX service_order_title_lower_idx ON service_order (lower(title));
