import { createReadStream } from 'node:fs';
import { parse } from 'csv-parse';
import pg from 'pg';
const file = process.argv[2];
if (!file || !process.env.DATABASE_URL)
  throw Error('Uso: import:gbif ruta-absoluta-a-occurrence.txt; configurar DATABASE_URL');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
let accepted = 0,
  rejected = 0;
try {
  await client.query('BEGIN');
  const parser = createReadStream(file).pipe(
    parse({ columns: true, delimiter: '\t', bom: true, max_record_size: 1000000 }),
  );
  for await (const row of parser) {
    const lat = Number(row.decimalLatitude),
      lon = Number(row.decimalLongitude);
    if (
      !/^\d+$/.test(row.gbifID ?? '') ||
      !row.scientificName?.trim() ||
      !row.decimalLatitude?.trim() ||
      !row.decimalLongitude?.trim() ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      Math.abs(lat) > 90 ||
      Math.abs(lon) > 180
    ) {
      rejected++;
      continue;
    }
    await client.query(
      `INSERT INTO observations(source,source_id,scientific_name,common_name,location,source_url,license,event_date)
      VALUES('GBIF',$1,$2,$3,ST_SetSRID(ST_MakePoint($4,$5),4326),$6,$7,$8)
      ON CONFLICT(source,source_id) DO UPDATE SET scientific_name=excluded.scientific_name,common_name=excluded.common_name,
        location=excluded.location,source_url=excluded.source_url,license=excluded.license,event_date=excluded.event_date`,
      [
        row.gbifID,
        row.scientificName.trim(),
        row.vernacularName || null,
        lon,
        lat,
        `https://www.gbif.org/occurrence/${row.gbifID}`,
        row.license || null,
        row.eventDate || null,
      ],
    );
    accepted++;
  }
  await client.query('COMMIT');
  console.log(
    JSON.stringify({ processed: accepted + rejected, acceptedOrUpdated: accepted, rejected }),
  );
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  await client.end();
}
