import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { zoneReviewInputSchema } from '@bioatlas/contracts';
import { authenticateUser } from './community.ts';
const selectReview = `SELECT status,habitat,evidence_url AS "evidenceUrl",reviewer,notes,boundary_checked AS "boundaryChecked",habitat_checked AS "habitatChecked",field_checked AS "fieldChecked",version,updated_at::text AS "updatedAt" FROM zone_reviews WHERE zone_id=$1`;
const emptyReview = {
  status: 'proposed',
  habitat: '',
  evidenceUrl: '',
  reviewer: '',
  notes: '',
  boundaryChecked: false,
  habitatChecked: false,
  fieldChecked: false,
  version: 0,
  updatedAt: null,
};
export function registerBiotopes(app: FastifyInstance, pool: Pool) {
  app.get('/v1/zones/:id/biotopes', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!(await pool.query('SELECT 1 FROM zones WHERE id=$1', [id])).rowCount)
      return reply.code(404).send({ message: 'Zona no encontrada.' });
    const review = (await pool.query(selectReview, [id])).rows[0] ?? emptyReview;
    const children = await pool.query(
      `SELECT z.id,z.name,z.description,z.color,z.kind,z.parent_id AS "parentId",z.source,z.source_url AS "sourceUrl",ST_AsGeoJSON(z.boundary)::json AS geometry,json_build_object('west',ST_XMin(boundary),'south',ST_YMin(boundary),'east',ST_XMax(boundary),'north',ST_YMax(boundary)) AS bounds,(SELECT count(*)::int FROM observations o WHERE ST_Covers(z.boundary,o.location)) AS "observationCount" FROM zones z WHERE parent_id=$1 AND kind='biotope' ORDER BY name`,
      [id],
    );
    return { review, children: children.rows };
  });
  app.patch('/v1/zones/:id/review', async (request, reply) => {
    const user = await authenticateUser(pool, request, true),
      { id } = request.params as { id: string },
      parsed = zoneReviewInputSchema.safeParse(request.body);
    if (!parsed.success)
      return reply
        .code(400)
        .send({ message: 'Completa la ficha y las comprobaciones antes de validar.' });
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      const zone = await db.query('SELECT kind FROM zones WHERE id=$1 FOR UPDATE', [id]);
      if (!zone.rowCount) {
        await db.query('ROLLBACK');
        return reply.code(404).send({ message: 'Zona no encontrada.' });
      }
      await db.query('INSERT INTO zone_reviews(zone_id) VALUES($1) ON CONFLICT DO NOTHING', [id]);
      const current = (await db.query(selectReview, [id])).rows[0],
        v = parsed.data;
      if (current.version !== v.version) {
        await db.query('ROLLBACK');
        return reply
          .code(409)
          .send({ message: 'Otra persona actualizó la ficha. Recarga antes de guardar.' });
      }
      if (
        v.status === 'validated' &&
        (zone.rows[0].kind !== 'biotope' || current.status !== 'in_review')
      ) {
        await db.query('ROLLBACK');
        return reply.code(409).send({
          message:
            'Solo un biotopo previamente en revisión puede validarse. El área de referencia no se convierte automáticamente en biotopo.',
        });
      }
      if (v.status === 'validated') {
        const geometry = await db.query(
          'SELECT ST_Covers(p.boundary,z.boundary) AND ST_IsValid(z.boundary) AND NOT ST_IsEmpty(z.boundary) AS valid FROM zones z JOIN zones p ON p.id=z.parent_id AND p.id<>z.id WHERE z.id=$1',
          [id],
        );
        if (!geometry.rows[0]?.valid) {
          await db.query('ROLLBACK');
          return reply.code(409).send({
            message:
              'El biotopo debe tener un área de referencia y límites válidos dentro de ella.',
          });
        }
      }
      await db.query(
        'UPDATE zone_reviews SET status=$2,habitat=$3,evidence_url=$4,reviewer=$5,notes=$6,boundary_checked=$7,habitat_checked=$8,field_checked=$9,version=version+1,updated_at=now() WHERE zone_id=$1',
        [
          id,
          v.status,
          v.habitat,
          v.evidenceUrl,
          v.reviewer,
          v.notes,
          v.boundaryChecked,
          v.habitatChecked,
          v.fieldChecked,
        ],
      );
      await db.query('INSERT INTO zone_review_history(zone_id,user_id,decision) VALUES($1,$2,$3)', [
        id,
        user.id,
        JSON.stringify(v),
      ]);
      const saved = (await db.query(selectReview, [id])).rows[0];
      await db.query('COMMIT');
      return saved;
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    } finally {
      db.release();
    }
  });
}
