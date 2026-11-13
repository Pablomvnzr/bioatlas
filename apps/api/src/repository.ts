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
        source_url AS "sourceUrl", license, event_date AS "eventDate",
        observer_name AS "observerName", quality_grade AS "qualityGrade", accuracy_m AS "accuracyM",
        CASE WHEN source='BioAtlas comunitario' THEN source_id ELSE NULL END AS "reportId"
      FROM observations
      WHERE ST_Intersects(location, ST_MakeEnvelope($1,$2,$3,$4,4326))
        AND ($5 = '' OR scientific_name ILIKE '%' || $5 || '%' OR common_name ILIKE '%' || $5 || '%')
        ${q.zoneId ? 'AND EXISTS (SELECT 1 FROM zones z WHERE z.id=$8 AND ST_Covers(z.boundary,observations.location))' : ''}
        ${q.source === 'community' ? "AND source='BioAtlas comunitario'" : ''}
      ORDER BY id ${q.sort === 'newest' ? 'DESC' : 'ASC'} LIMIT $6 OFFSET $7`,
        [
          q.west,
          q.south,
          q.east,
          q.north,
          text,
          q.limit + 1,
          q.offset,
          ...(q.zoneId ? [q.zoneId] : []),
        ],
      );
      return { items: result.rows.slice(0, q.limit), hasMore: result.rows.length > q.limit };
    },
  };
}
