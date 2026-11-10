ALTER TABLE observations ADD COLUMN taxon_group text;
CREATE TABLE observation_photos (
  observation_id bigint NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
  photo_id bigint NOT NULL,
  url text NOT NULL,
  attribution text NOT NULL,
  license text NOT NULL CHECK (license IN ('cc0','cc-by','cc-by-sa','cc-by-nc','cc-by-nc-sa')),
  PRIMARY KEY(observation_id,photo_id)
);
