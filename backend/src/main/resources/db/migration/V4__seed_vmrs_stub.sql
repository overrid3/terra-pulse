-- Hardcoded VMRS subset for the POC. Codes follow the VMRS 9-digit convention
-- (3-digit system / 3-digit assembly / 3-digit component) stored digits-only.
-- Values are illustrative, not licensed VMRS data.
INSERT INTO vmrs_code (code, description, srt_minutes, difficulty_factor) VALUES
    ('013001001', 'Engine oil and filter change',         60,  1.00),
    ('013002005', 'Engine coolant hose replacement',     120,  1.10),
    ('042001010', 'Hydraulic hose replacement',          150,  1.20),
    ('042003002', 'Hydraulic pump replacement',          360,  1.30),
    ('033004001', 'Track tension adjustment',             90,  1.00),
    ('033005007', 'Track shoe replacement',              240,  1.25),
    ('060001003', 'Alternator replacement',              120,  1.10),
    ('060002001', 'Battery replacement',                  30,  1.00);
