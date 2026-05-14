-- V8: normalize mechanic skills.
-- Replaces the TEXT[] freeform list on `mechanic.skills` with a managed catalog
-- (`skill`) joined via `mechanic_skill`. Existing values are backfilled.

CREATE TABLE skill (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(64) NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed catalog from any distinct value currently stored on mechanic.skills.
INSERT INTO skill (name)
SELECT DISTINCT unnest(m.skills)
FROM mechanic m
WHERE m.skills IS NOT NULL AND array_length(m.skills, 1) > 0
ON CONFLICT (name) DO NOTHING;

CREATE TABLE mechanic_skill (
    mechanic_id UUID NOT NULL REFERENCES mechanic(id) ON DELETE CASCADE,
    skill_id    UUID NOT NULL REFERENCES skill(id)    ON DELETE CASCADE,
    PRIMARY KEY (mechanic_id, skill_id)
);

-- Backfill the join table from the legacy text[] column.
INSERT INTO mechanic_skill (mechanic_id, skill_id)
SELECT m.id, s.id
FROM mechanic m
CROSS JOIN LATERAL unnest(m.skills) AS sk(name)
JOIN skill s ON s.name = sk.name
ON CONFLICT DO NOTHING;

ALTER TABLE mechanic DROP COLUMN skills;
