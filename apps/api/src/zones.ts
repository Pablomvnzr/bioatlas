import type { Pool, PoolClient } from 'pg';
import type { FastifyInstance } from 'fastify';
import { zoneImportSchema } from '@bioatlas/contracts';
import { getZoneGuide } from './zone-guide.ts';
import { registerZonePhotos } from './zone-photos.ts';
import { registerBiotopes } from './biotopes.ts';

export async function importZones(input: unknown, db: Pick<PoolClient, 'query'>) {
  const data = zoneImportSchema.parse(input);
  for (const feature of data.features) {
    const p = feature.properties;
    const valid = await db.query('SELECT ST_IsValid(ST_GeomFromGeoJSON($1)) AS valid', [
      JSON.stringify(feature.geometry),
    ]);
    if (!valid.rows[0].valid)
      throw Error(`La zona ${p.name} tiene una geometría inválida. Revisar el archivo de origen.`);
    await db.query(
      `INSERT INTO zones(id,name,description,color,kind,parent_id,source,source_url,boundary)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,ST_SetSRID(ST_GeomFromGeoJSON($9),4326))
      ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,color=excluded.color,
      kind=excluded.kind,parent_id=excluded.parent_id,source=excluded.source,source_url=excluded.source_url,boundary=excluded.boundary,updated_at=now()`,
      [
        p.id,
        p.name,
        p.description,
        p.color,
        p.kind,
        p.parentId,
        p.source,
        p.sourceUrl,
        JSON.stringify(feature.geometry),
      ],
    );
  }
  return { imported: data.features.length };
}

export function registerZones(app: FastifyInstance, pool: Pool) {
  registerZonePhotos(app, pool);
  registerBiotopes(app, pool);
  app.get('/v1/zones/:id/details', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id))
      return reply.code(400).send({ message: 'Zona invalida.' });
    const found = await pool.query(
      `SELECT name,ST_Area(boundary::geography)/1000000 AS "areaKm2" FROM zones WHERE id=$1`,
      [id],
    );
    if (!found.rowCount) return reply.code(404).send({ message: 'Zona no encontrada.' });
    const result = await pool.query(
      `WITH inside AS (SELECT o.* FROM observations o JOIN zones z ON z.id=$1 AND ST_Covers(z.boundary,o.location)),
      counts AS (SELECT count(*)::int AS "observationCount",count(DISTINCT scientific_name)::int AS "taxonCount",min(event_date) FILTER(WHERE event_date ~ '^\\d{4}-\\d{2}-\\d{2}$') AS "firstDate",max(event_date) FILTER(WHERE event_date ~ '^\\d{4}-\\d{2}-\\d{2}$') AS "lastDate" FROM inside)
      SELECT counts.*,
      COALESCE((SELECT json_agg(s) FROM (SELECT source,count(*)::int AS count FROM inside GROUP BY source ORDER BY source) s),'[]') AS sources,
      COALESCE((SELECT json_agg(t) FROM (SELECT scientific_name AS "scientificName",max(common_name) AS "commonName",count(*)::int AS count FROM inside GROUP BY scientific_name ORDER BY count(*) DESC,scientific_name LIMIT 8) t),'[]') AS taxa
      FROM counts`,
      [id],
    );
    return { ...found.rows[0], ...result.rows[0], guide: getZoneGuide(id, found.rows[0].name) };
  });
  app.get('/v1/zones', async () => {
    const result =
      await pool.query(`SELECT z.id,z.name,z.description,z.color,z.kind,z.parent_id AS "parentId",z.source,z.source_url AS "sourceUrl",
        ST_AsGeoJSON(ST_Multi(ST_SimplifyPreserveTopology(z.boundary,0.00002)),7)::json AS geometry,
      json_build_object('west',ST_XMin(z.boundary),'south',ST_YMin(z.boundary),'east',ST_XMax(z.boundary),'north',ST_YMax(z.boundary)) AS bounds,
      (SELECT count(*)::int FROM observations o WHERE ST_Covers(z.boundary,o.location)) AS "observationCount"
      FROM zones z ORDER BY CASE WHEN kind='macrozone' THEN 0 ELSE 1 END,name LIMIT 201`);
    return { items: result.rows.slice(0, 200), hasMore: result.rows.length > 200 };
  });
}
