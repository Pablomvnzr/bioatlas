import {
  inaturalistRecordSchema as recordSchema,
  inaturalistPhotoSchema,
} from '@bioatlas/contracts';
import type { PoolClient } from 'pg';
export function licensedPhoto(input: unknown) {
  const parsed = inaturalistPhotoSchema.safeParse(input);
  if (!parsed.success) return null;
  const p = parsed.data,
    u = new URL(p.url);
  if (
    u.protocol !== 'https:' ||
    u.hostname !== 'inaturalist-open-data.s3.amazonaws.com' ||
    u.username ||
    u.password ||
    u.port ||
    u.search ||
    u.hash ||
    u.pathname !== `/photos/${p.id}/square.jpg`
  )
    return null;
  return { ...p, url: `https://inaturalist-open-data.s3.amazonaws.com/photos/${p.id}/medium.jpg` };
}
export async function importInaturalist(records: unknown[], db: Pick<PoolClient, 'query'>) {
  let imported = 0,
    skipped = 0;
  for (const input of records) {
    const parsed = recordSchema.safeParse(input);
    if (!parsed.success) {
      skipped++;
      continue;
    }
    const r = parsed.data,
      [lng, lat] = r.geojson.coordinates;
    const result = await db.query(
      `INSERT INTO observations(source,source_id,scientific_name,common_name,location,source_url,license,event_date,observer_name,quality_grade,accuracy_m,imported_at,taxon_group)
      SELECT 'iNaturalist',$1,$2,$3,ST_SetSRID(ST_MakePoint($4,$5),4326),$6,$7,$8,$9,$10,$11,now(),$12
      WHERE EXISTS(SELECT 1 FROM zones WHERE ST_Covers(boundary,ST_SetSRID(ST_MakePoint($4,$5),4326)))
      ON CONFLICT(source,source_id) DO UPDATE SET scientific_name=excluded.scientific_name,common_name=excluded.common_name,location=excluded.location,source_url=excluded.source_url,license=excluded.license,event_date=excluded.event_date,observer_name=excluded.observer_name,quality_grade=excluded.quality_grade,accuracy_m=excluded.accuracy_m,taxon_group=excluded.taxon_group,imported_at=now() RETURNING id`,
      [
        String(r.id),
        r.taxon.name,
        r.taxon.preferred_common_name ?? null,
        lng,
        lat,
        `https://www.inaturalist.org/observations/${r.id}`,
        r.license_code,
        r.observed_on,
        r.user.login,
        r.quality_grade,
        r.positional_accuracy,
        r.taxon.iconic_taxon_name ?? null,
      ],
    );
    if (result.rowCount) {
      imported++;
      if (r.photos) {
        const observationId = result.rows[0].id;
        await db.query('DELETE FROM observation_photos WHERE observation_id=$1', [observationId]);
        for (const raw of r.photos.slice(0, 3)) {
          const photo = licensedPhoto(raw);
          if (!photo) continue;
          await db.query(
            'INSERT INTO observation_photos(observation_id,photo_id,url,attribution,license) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',
            [observationId, photo.id, photo.url, photo.attribution, photo.license_code],
          );
        }
      }
    } else skipped++;
  }
  return { imported, skipped };
}
