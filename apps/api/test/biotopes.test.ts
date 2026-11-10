import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { biotopeDetailSchema } from '@bioatlas/contracts';
import { createApp } from '../src/app.ts';
import { createRepository } from '../src/repository.ts';

test(
  'biotope review requires admin, evidence, parent containment and fresh version; geometry changes reset approval',
  { skip: !process.env.DATABASE_URL },
  async () => {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    const app = createApp(createRepository(pool), false, pool);
    const id = `test-biotope-${Date.now()}`,
      parent = id + '-parent',
      email = id + '@example.org';
    try {
      await pool.query(
        "INSERT INTO zones(id,name,color,kind,source,boundary) VALUES($1,'Test reference','#245C50','reference_area','test',ST_Multi(ST_MakeEnvelope(-74,-40,-73,-39,4326)))",
        [parent],
      );
      await pool.query(
        "INSERT INTO zones(id,name,color,kind,parent_id,source,boundary) VALUES($1,'Test habitat','#235E87','biotope',$2,'test',ST_Multi(ST_MakeEnvelope(-73.9,-39.9,-73.8,-39.8,4326)))",
        [id, parent],
      );
      const detail = biotopeDetailSchema.parse(
        (await app.inject(`/v1/zones/${parent}/biotopes`)).json(),
      );
      assert.equal(detail.children[0].id, id);
      assert.equal(detail.review.status, 'proposed');
      const session = (
        await app.inject({
          method: 'POST',
          url: '/v1/auth/register',
          payload: { email, name: 'Test reviewer', password: 'A-long-test-password' },
        })
      ).json();
      const headers = { authorization: `Bearer ${session.token}` };
      let payload = {
        status: 'in_review',
        habitat: 'Test habitat',
        evidenceUrl: 'https://example.org/evidence',
        reviewer: 'Test reviewer',
        notes: 'Integration test evidence only',
        boundaryChecked: true,
        habitatChecked: true,
        fieldChecked: true,
        version: 0,
      };
      const patch = (body = payload, zoneId = id) =>
        app.inject({ method: 'PATCH', url: `/v1/zones/${zoneId}/review`, headers, payload: body });
      assert.equal(
        (await app.inject({ method: 'PATCH', url: `/v1/zones/${id}/review`, payload })).statusCode,
        401,
      );
      assert.equal((await patch()).statusCode, 403);
      await pool.query("UPDATE users SET role='admin' WHERE email=$1", [email]);
      assert.equal((await patch({ ...payload, status: 'validated' })).statusCode, 409);
      assert.equal((await patch()).statusCode, 200);
      assert.equal((await patch()).statusCode, 409);
      payload = { ...payload, version: 1, status: 'validated' };
      assert.equal((await patch({ ...payload, fieldChecked: false })).statusCode, 400);
      assert.equal((await patch()).statusCode, 200);
      assert.equal(
        (
          await pool.query('SELECT count(*)::int AS n FROM zone_review_history WHERE zone_id=$1', [
            id,
          ])
        ).rows[0].n,
        2,
      );
      await pool.query(
        'UPDATE zones SET boundary=ST_Multi(ST_MakeEnvelope(-73.95,-39.95,-73.85,-39.85,4326)) WHERE id=$1',
        [id],
      );
      const reset = biotopeDetailSchema.parse(
        (await app.inject(`/v1/zones/${id}/biotopes`)).json(),
      ).review;
      assert.equal(reset.status, 'proposed');
      assert.equal(reset.boundaryChecked, false);
      assert.equal(reset.version, 3);
      assert.equal(
        (await patch({ ...payload, version: 0, status: 'in_review' }, parent)).statusCode,
        200,
      );
      assert.equal((await patch({ ...payload, version: 1 }, parent)).statusCode, 409);
      await pool.query(
        'UPDATE zones SET boundary=ST_Multi(ST_MakeEnvelope(-75,-40,-74.5,-39.5,4326)) WHERE id=$1',
        [id],
      );
      const outside = biotopeDetailSchema.parse(
        (await app.inject(`/v1/zones/${id}/biotopes`)).json(),
      ).review;
      assert.equal(
        (await patch({ ...payload, status: 'in_review', version: outside.version })).statusCode,
        200,
      );
      assert.equal((await patch({ ...payload, version: outside.version + 1 })).statusCode, 409);
    } finally {
      await pool.query('DELETE FROM zone_review_history WHERE zone_id=ANY($1)', [[id, parent]]);
      await pool.query('DELETE FROM zone_reviews WHERE zone_id=ANY($1)', [[id, parent]]);
      await pool.query('DELETE FROM zones WHERE id=$1', [id]);
      await pool.query('DELETE FROM zones WHERE id=$1', [parent]);
      await pool.query('DELETE FROM users WHERE email=$1', [email]);
      await app.close();
      await pool.end();
    }
  },
);
