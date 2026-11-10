import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { inaturalistRecordSchema, zoneDetailsSchema } from '@bioatlas/contracts';
import { importInaturalist } from '../src/import-inaturalist.ts';
import { createApp } from '../src/app.ts';
import { createRepository } from '../src/repository.ts';
const record = {
  id: 900000000001,
  geojson: { type: 'Point', coordinates: [-73.21, -39.81] },
  taxon: { name: 'BioAtlas test taxon' },
  user: { login: 'test-observer' },
  license_code: 'cc-by',
  quality_grade: 'research',
  obscured: false,
  geoprivacy: null,
  taxon_geoprivacy: 'open',
  observed_on: '2026-01-01',
  positional_accuracy: 10,
};
test('iNaturalist rejects obscured coordinates and missing reuse license', () => {
  assert.ok(inaturalistRecordSchema.safeParse(record).success);
  for (const change of [
    { obscured: true },
    { geoprivacy: 'private' },
    { taxon_geoprivacy: 'obscured' },
    { license_code: null },
  ])
    assert.equal(inaturalistRecordSchema.safeParse({ ...record, ...change }).success, false);
});
test(
  'iNaturalist import keeps attribution and updates without duplicating',
  { skip: !process.env.DATABASE_URL },
  async () => {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      await db.query(
        `INSERT INTO zones(id,name,color,kind,source,boundary) VALUES('inat-import-test','Test','#123456','macrozone','test',ST_GeomFromText('MULTIPOLYGON(((-73.22 -39.82,-73.20 -39.82,-73.20 -39.80,-73.22 -39.80,-73.22 -39.82)))',4326))`,
      );
      assert.equal((await importInaturalist([record], db)).imported, 1);
      await importInaturalist([{ ...record, taxon: { name: 'BioAtlas updated taxon' } }], db);
      const r = await db.query(
        "SELECT scientific_name,observer_name,source_url FROM observations WHERE source='iNaturalist' AND source_id=$1",
        [String(record.id)],
      );
      assert.equal(r.rowCount, 1);
      assert.equal(r.rows[0].observer_name, 'test-observer');
      assert.equal(r.rows[0].scientific_name, 'BioAtlas updated taxon');
      assert.equal(
        (
          await importInaturalist(
            [{ ...record, id: 900000000002, geojson: { type: 'Point', coordinates: [0, 0] } }],
            db,
          )
        ).imported,
        0,
      );
    } finally {
      await db.query('ROLLBACK');
      db.release();
      await pool.end();
    }
  },
);
test(
  'zone detail summaries validate and unknown zones return 404',
  { skip: !process.env.DATABASE_URL },
  async () => {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    const app = createApp(createRepository(pool), false, pool);
    try {
      assert.equal((await app.inject('/v1/zones/not-a-real-zone/details')).statusCode, 404);
      const zone = (await pool.query('SELECT id FROM zones ORDER BY id LIMIT 1')).rows[0];
      if (zone) {
        const response = await app.inject(`/v1/zones/${zone.id}/details`);
        assert.equal(response.statusCode, 200, response.body);
        assert.ok(zoneDetailsSchema.safeParse(response.json()).success);
      }
    } finally {
      await app.close();
      await pool.end();
    }
  },
);
