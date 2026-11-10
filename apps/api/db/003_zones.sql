CREATE TABLE zones (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  color text NOT NULL CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  kind text NOT NULL DEFAULT 'macrozone' CHECK (kind IN ('macrozone','biotope','reference_area')),
  parent_id text REFERENCES zones(id),
  source text NOT NULL,
  source_url text,
  boundary geometry(MultiPolygon,4326) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ST_IsValid(boundary) AND NOT ST_IsEmpty(boundary))
);
CREATE INDEX zones_boundary_idx ON zones USING gist(boundary);
