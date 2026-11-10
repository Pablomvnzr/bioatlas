import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { searchSchema, zoneImportSchema } from '@bioatlas/contracts';
import { importZones } from '../src/zones.ts';
import { createRepository } from '../src/repository.ts';
import { readFile } from 'node:fs/promises';

test('supplied KMZ conversion preserves twelve named and colored macrozones', async () => {
  const file = JSON.parse(
    await readFile(new URL('../fixtures/valdivia-macrozones.geojson', import.meta.url), 'utf8'),
  );
  const data = zoneImportSchema.parse(file);
  assert.equal(data.features.length, 12);
  assert.equal(new Set(data.features.map((f) => f.properties.id)).size, 12);
  assert.ok(data.features.some((f) => f.properties.name === 'TEJA'));
  assert.ok(data.features.every((f) => f.properties.kind === 'macrozone'));
});
test(
  'polygon filtering excludes points in bounding rectangle but outside real boundary',
  { skip: !process.env.DATABASE_URL },
  async () => {
    const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();
    const tag = 'test-zone-' + Date.now();
    try {
      await db.query('BEGIN');
      await importZones(
        {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {
                id: tag,
                name: 'Test triangle',
                description: 'Test only',
                color: '#245C50',
                kind: 'biotope',
                parentId: null,
                source: 'integration test',
                sourceUrl: null,
              },
              geometry: {
                type: 'MultiPolygon',
                coordinates: [
                  [
                    [
                      [-73.4, -40],
                      [-73, -40],
                      [-73.4, -39.6],
                      [-73.4, -40],
                    ],
                  ],
                ],
              },
            },
          ],
        },
        db,
      );
      for (const [id, lon, lat] of [
        ['inside', -73.35, -39.95],
        ['outside', -73.05, -39.65],
      ] as const) {
        await db.query(
          'INSERT INTO observations(source,source_id,scientific_name,location) VALUES($1,$2,$1,ST_SetSRID(ST_MakePoint($3,$4),4326))',
          [tag, id, lon, lat],
        );
      }
      const result = await createRepository(db as unknown as pg.Pool).search(
        searchSchema.parse({
          west: -73.5,
          east: -72.9,
          south: -40.1,
          north: -39.5,
          q: tag,
          zoneId: tag,
        }),
      );
      assert.equal(result.items.length, 1);
      assert.equal(result.items[0].longitude, -73.35);
    } finally {
      await db.query('ROLLBACK');
      await db.end();
    }
  },
);
