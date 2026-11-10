import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { zonePhotosSchema } from '@bioatlas/contracts';
import { licensedPhoto } from '../src/import-inaturalist.ts';
import { createApp } from '../src/app.ts';
import { createRepository } from '../src/repository.ts';
const photo = {
  id: 123,
  url: 'https://inaturalist-open-data.s3.amazonaws.com/photos/123/square.jpg',
  attribution: 'Example photographer (CC BY)',
  license_code: 'cc-by',
  hidden: false,
  flags: [],
  moderator_actions: [],
};
test('photo licensing is independent and unsafe or hidden sources are rejected', () => {
  assert.equal(
    licensedPhoto(photo)?.url,
    'https://inaturalist-open-data.s3.amazonaws.com/photos/123/medium.jpg',
  );
  for (const change of [
    { license_code: null },
    { license_code: 'all-rights-reserved' },
    { hidden: true },
    { flags: ['hidden'] },
    { url: 'http://127.0.0.1/internal' },
    { url: 'https://inaturalist-open-data.s3.amazonaws.com.evil.test/photos/123/square.jpg' },
    { url: 'https://inaturalist-open-data.s3.amazonaws.com/photos/124/square.jpg' },
  ])
    assert.equal(licensedPhoto({ ...photo, ...change }), null);
});
test(
  'zone photos respect polygons, plant filter and bounded pagination',
  { skip: !process.env.DATABASE_URL },
  async () => {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL }),
      app = createApp(createRepository(pool), false, pool);
    try {
      assert.equal((await app.inject('/v1/zones/unknown/photos')).statusCode, 404);
      assert.equal((await app.inject('/v1/zones/unknown/photos?offset=-1')).statusCode, 400);
      assert.equal((await app.inject('/v1/observation-photos/abc/1')).statusCode, 400);
      assert.equal((await app.inject('/v1/observation-photos/999999999999/1')).statusCode, 404);
      const zones = await pool.query('SELECT id FROM zones');
      for (const zone of zones.rows) {
        const response = await app.inject(`/v1/zones/${zone.id}/photos?group=plants`);
        assert.equal(response.statusCode, 200, response.body);
        const data = zonePhotosSchema.parse(response.json());
        assert.ok(data.items.length <= 12);
        for (const item of data.items) {
          assert.equal(item.taxonGroup, 'Plantae');
          const inside = await pool.query(
            'SELECT ST_Covers(z.boundary,o.location) inside FROM zones z, observations o WHERE z.id=$1 AND o.id=$2',
            [zone.id, item.observationId],
          );
          assert.equal(inside.rows[0].inside, true);
        }
      }
    } finally {
      await app.close();
      await pool.end();
    }
  },
);
