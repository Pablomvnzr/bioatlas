import type { Readable } from 'node:stream';
import type pg from 'pg';
import { parse } from 'csv-parse';

export async function importGbif(input: Readable, db: Pick<pg.Client, 'query'>) {
  let accepted = 0,
    rejected = 0;
  let headerSeen = false;
  const parser = input.pipe(
    parse({
      columns: (headers: string[]) => {
        const required = ['gbifID', 'scientificName', 'decimalLatitude', 'decimalLongitude'];
        if (required.some((name) => !headers.includes(name)))
          throw Error('Faltan columnas obligatorias de GBIF.');
        headerSeen = true;
        return headers;
      },
      skip_empty_lines: true,
      delimiter: '\t',
      bom: true,
      max_record_size: 1000000,
    }),
  );
  input.once('error', (error) => parser.destroy(error));
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
    await db.query(
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
  if (!headerSeen) throw Error('El archivo está vacío y no contiene cabecera de GBIF.');
  return { processed: accepted + rejected, acceptedOrUpdated: accepted, rejected };
}
