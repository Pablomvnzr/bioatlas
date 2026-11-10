ALTER TABLE observations ADD COLUMN observer_name text;
ALTER TABLE observations ADD COLUMN quality_grade text;
ALTER TABLE observations ADD COLUMN accuracy_m double precision;
ALTER TABLE observations ADD COLUMN imported_at timestamptz;
