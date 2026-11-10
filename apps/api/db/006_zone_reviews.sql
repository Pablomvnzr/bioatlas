CREATE TABLE zone_reviews (
  zone_id text PRIMARY KEY REFERENCES zones(id),
  status text NOT NULL DEFAULT 'proposed' CHECK(status IN ('proposed','in_review','validated')),
  habitat text NOT NULL DEFAULT '',
  evidence_url text NOT NULL DEFAULT '',
  reviewer text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  boundary_checked boolean NOT NULL DEFAULT false,
  habitat_checked boolean NOT NULL DEFAULT false,
  field_checked boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE zone_review_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  zone_id text NOT NULL REFERENCES zones(id),
  user_id bigint NOT NULL REFERENCES users(id),
  decision jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- A review cannot remain valid after its geographic evidence changes.
CREATE FUNCTION reset_zone_review() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT ST_Equals(OLD.boundary,NEW.boundary)
    OR OLD.kind IS DISTINCT FROM NEW.kind
    OR OLD.parent_id IS DISTINCT FROM NEW.parent_id
    OR OLD.source IS DISTINCT FROM NEW.source
    OR OLD.source_url IS DISTINCT FROM NEW.source_url THEN
  UPDATE zone_reviews SET status='proposed',boundary_checked=false,
   habitat_checked=false,field_checked=false,version=version+1,updated_at=now()
   WHERE zone_id=NEW.id OR zone_id IN (SELECT id FROM zones WHERE parent_id=NEW.id);
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER zone_review_geometry_changed AFTER UPDATE ON zones
 FOR EACH ROW EXECUTE FUNCTION reset_zone_review();
