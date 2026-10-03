CREATE EXTENSION IF NOT EXISTS postgis;
CREATE TABLE observations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source text NOT NULL,
  source_id text NOT NULL,
  scientific_name text NOT NULL CHECK (length(trim(scientific_name)) > 0),
  common_name text,
  location geometry(Point,4326) NOT NULL,
  source_url text,
  license text,
  event_date text,
  CONSTRAINT observations_source_unique UNIQUE(source,source_id),
  CONSTRAINT observations_coordinates CHECK (ST_X(location) BETWEEN -180 AND 180 AND ST_Y(location) BETWEEN -90 AND 90)
);
CREATE INDEX observations_location_idx ON observations USING gist(location);
