import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import pg from 'pg';
import { importGbif } from '../src/import-gbif.ts';

const header = 'gbifID\tscientificName\tdecimalLatitude\tdecimalLongitude\n';
test('GBIF import rejects missing headers before inserting', async () => {
  const db = {
    query: async () => {
      throw Error('Should not insert');
    },
  };
  await assert.rejects(
    importGbif(Readable.from(['wrong\tcolumns\n']), db),
    /columnas obligatorias/,
  );
});
test('GBIF import rejects empty and out-of-range coordinates', async () => {
  const db = {
    query: async () => {
      throw Error('Should not insert');
    },
  };
  const text =
    header + '1\tSpecies test\t\t-73\n2\tSpecies test\t-95\t-73\n3\tSpecies test\t-39\tNaN\n';
  assert.deepEqual(await importGbif(Readable.from([text]), db), {
    processed: 3,
    acceptedOrUpdated: 0,
    rejected: 3,
  });
});
test(
  'GBIF reimport updates the record without duplication',
  { skip: !process.env.DATABASE_URL },
  async () => {
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
      await client.query('BEGIN');
      const id = '999999999999999999';
      await importGbif(Readable.from([header + `${id}\tSpecies test\t-39.8\t-73.2\n`]), client);
      const summary = await importGbif(
        Readable.from([header + `${id}\tSpecies updated\t-39.7\t-73.1\n`]),
        client,
      );
      const result = await client.query(
        "SELECT scientific_name, ST_X(location) AS longitude FROM observations WHERE source='GBIF' AND source_id=$1",
        [id],
      );
      assert.equal(summary.acceptedOrUpdated, 1);
      assert.equal(result.rows.length, 1);
      assert.equal(result.rows[0].scientific_name, 'Species updated');
      assert.equal(result.rows[0].longitude, -73.1);
    } finally {
      await client.query('ROLLBACK');
      await client.end();
    }
  },
);
