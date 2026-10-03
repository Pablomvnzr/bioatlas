import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { createRepository } from '../src/repository.ts';
import { searchSchema } from '@bioatlas/contracts';

test(
  'PostGIS returns only points inside the requested bounds',
  { skip: !process.env.DATABASE_URL },
  async () => {
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
      await client.query('BEGIN');
      const tag = `integration-${Date.now()}`;
      for (const [id, lon] of [
        ['inside', -73.2],
        ['outside', -72],
      ] as const) {
        await client.query(
          `INSERT INTO observations(source,source_id,scientific_name,location)
        VALUES ($1,$2,$1,ST_SetSRID(ST_MakePoint($3,-39.8),4326))`,
          [tag, id, lon],
        );
      }
      const result = await createRepository(client as unknown as pg.Pool).search(
        searchSchema.parse({ west: -73.4, south: -40, east: -73, north: -39, q: tag }),
      );
      assert.equal(result.items.length, 1);
      assert.equal(result.items[0].longitude, -73.2);
      assert.equal(result.hasMore, false);
    } finally {
      await client.query('ROLLBACK');
      await client.end();
    }
  },
);
