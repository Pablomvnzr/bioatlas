import test from 'node:test';
import assert from 'node:assert/strict';
import { searchSchema } from '@bioatlas/contracts';
import { createApp } from '../src/app.ts';
import { createRepository } from '../src/repository.ts';
import type { Pool } from 'pg';
const zone = 'west=-73.4&south=-40&east=-73&north=-39';
test('rejects invalid bounds and unbounded requests', async () => {
  let calls = 0;
  const app = createApp({
    search: async () => {
      calls++;
      return { items: [], hasMore: false };
    },
  });
  try {
    for (const query of [
      '',
      'west=0&south=0&east=-1&north=1',
      zone + '&limit=301',
      zone + '&offset=-1',
      zone + '&q=' + 'x'.repeat(101),
      zone + '&sort=invalid',
      zone + '&source=private',
    ]) {
      assert.equal((await app.inject('/v1/observations?' + query)).statusCode, 400);
    }
    assert.equal(calls, 0);
  } finally {
    await app.close();
  }
});
test('empty zone is a successful result', async () => {
  const app = createApp({
    search: async (q) => {
      assert.equal(q.west, -73.4);
      return { items: [], hasMore: false };
    },
  });
  try {
    const result = await app.inject('/v1/observations?' + zone);
    assert.equal(result.statusCode, 200);
    assert.equal(result.headers['access-control-allow-origin'], '*');
    assert.equal(result.headers['cache-control'], 'no-store');
    assert.deepEqual(result.json(), { items: [], hasMore: false });
  } finally {
    await app.close();
  }
});
test('database failures do not leak internals', async () => {
  const app = createApp({
    search: async () => {
      throw Error('secret database connection string');
    },
  });
  try {
    const result = await app.inject('/v1/observations?' + zone);
    assert.equal(result.statusCode, 500);
    assert.ok(!result.body.includes('secret'));
  } finally {
    await app.close();
  }
});
test('query is parameterized, search wildcards escaped, pagination bounded', async () => {
  const row = { id: '1' };
  let args: unknown[] = [];
  const pool = {
    query: async (...values: unknown[]) => {
      args = values;
      return { rows: [row, { id: '2' }] };
    },
  } as unknown as Pool;
  const result = await createRepository(pool).search(
    searchSchema.parse({ west: -74, south: -40, east: -73, north: -39, q: "%'_", limit: 1 }),
  );
  assert.ok(!String(args[0]).includes("%'_"));
  assert.deepEqual(args[1], [-74, -40, -73, -39, "\\%'\\_", 2, 0]);
  assert.deepEqual(result, { items: [row], hasMore: true });
});
test('community feed filters public observations and returns newest records first', async () => {
  let sql = '';
  const pool = {
    query: async (text: string) => {
      sql = text;
      return { rows: [] };
    },
  } as unknown as Pool;
  await createRepository(pool).search(
    searchSchema.parse({
      west: -74,
      south: -40,
      east: -73,
      north: -39,
      source: 'community',
      sort: 'newest',
    }),
  );
  assert.match(sql, /AND source='BioAtlas comunitario'/);
  assert.match(sql, /ORDER BY id DESC/);
});
