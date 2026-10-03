import type { Pool } from 'pg';
import type { Observation, Search, Results } from '@bioatlas/contracts';
export interface ObservationRepository {
  search(query: Search): Promise<Results>;
}
export function createRepository(pool: Pool): ObservationRepository {
  return {
    async search(q) {
      const text = q.q.replace(/[\\%_]/g, '\\$&');
      const result = await pool.query<Observation>(
        `
      SELECT id::text, scientific_name AS "scientificName", common_name AS "commonName",
        ST_Y(location) AS latitude, ST_X(location) AS longitude, source,
        source_url AS "sourceUrl", license, event_date AS "eventDate"
      FROM observations
      WHERE ST_Intersects(location, ST_MakeEnvelope($1,$2,$3,$4,4326))
        AND ($5 = '' OR scientific_name ILIKE '%' || $5 || '%' OR common_name ILIKE '%' || $5 || '%')
      ORDER BY id LIMIT $6 OFFSET $7`,
        [q.west, q.south, q.east, q.north, text, q.limit + 1, q.offset],
      );
      return { items: result.rows.slice(0, q.limit), hasMore: result.rows.length > q.limit };
    },
  };
}
