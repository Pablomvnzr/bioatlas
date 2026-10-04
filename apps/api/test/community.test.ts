import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { createApp } from '../src/app.ts';
import { createRepository } from '../src/repository.ts';

test(
  'accounts, report privacy, moderation, publication and revoked sessions',
  { skip: !process.env.DATABASE_URL },
  async () => {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    const app = createApp(createRepository(pool), false, pool);
    const tag = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const email = tag + '@example.org';
    const payload = { name: 'Test User', email, password: 'A-long-test-password' };
    const report = {
      scientificName: tag,
      description: 'Integration test observation',
      latitude: -39.8,
      longitude: -73.2,
      eventDate: '2026-01-01',
    };
    const auth = (token: string) => ({ authorization: `Bearer ${token}` });
    try {
      assert.equal(
        (await app.inject({ method: 'POST', url: '/v1/reports', payload: report })).statusCode,
        401,
      );
      const registered = await app.inject({
        method: 'POST',
        url: '/v1/auth/register',
        payload: { ...payload, role: 'admin' },
      });
      assert.equal(registered.statusCode, 201);
      const session = registered.json();
      assert.equal(session.user.role, 'member');
      const stored = (await pool.query('SELECT password_hash FROM users WHERE email=$1', [email]))
        .rows[0];
      assert.ok(!stored.password_hash.includes(payload.password));
      assert.equal(
        (
          await app.inject({
            method: 'POST',
            url: '/v1/auth/login',
            payload: { email, password: 'wrong-password' },
          })
        ).statusCode,
        401,
      );
      assert.equal(
        (await app.inject({ method: 'POST', url: '/v1/auth/login', payload })).statusCode,
        200,
      );
      assert.equal(
        (await app.inject({ url: '/v1/admin/reports', headers: auth(session.token) })).statusCode,
        403,
      );
      const invalid = await app.inject({
        method: 'POST',
        url: '/v1/reports',
        headers: auth(session.token),
        payload: { ...report, latitude: 200 },
      });
      assert.equal(invalid.statusCode, 400);
      const created = await app.inject({
        method: 'POST',
        url: '/v1/reports',
        headers: auth(session.token),
        payload: report,
      });
      assert.equal(created.statusCode, 201);
      const id = created.json().id;
      const search = '/v1/observations?west=-74&south=-40&east=-73&north=-39&q=' + tag;
      assert.equal((await app.inject(search)).json().items.length, 0);
      const second = await app.inject({
        method: 'POST',
        url: '/v1/auth/register',
        payload: { ...payload, email: 'other-' + email },
      });
      assert.equal(
        (await app.inject({ url: '/v1/reports/mine', headers: auth(second.json().token) })).json()
          .items.length,
        0,
      );
      await pool.query("UPDATE users SET role='admin' WHERE email=$1", [email]);
      assert.equal(
        (
          await app.inject({
            method: 'PATCH',
            url: '/v1/admin/reports/' + id,
            headers: auth(session.token),
            payload: { status: 'approved', note: 'Reviewed test' },
          })
        ).statusCode,
        200,
      );
      assert.equal((await app.inject(search)).json().items.length, 1);
      assert.equal(
        (
          await app.inject({
            method: 'PATCH',
            url: '/v1/admin/reports/' + id,
            headers: auth(session.token),
            payload: { status: 'approved', note: 'Repeated test' },
          })
        ).statusCode,
        409,
      );
      const pending = await app.inject({
        method: 'POST',
        url: '/v1/reports',
        headers: auth(session.token),
        payload: report,
      });
      assert.equal(
        (
          await app.inject({
            method: 'PATCH',
            url: '/v1/admin/reports/' + pending.json().id,
            headers: auth(session.token),
            payload: { status: 'rejected', note: 'Rejected test' },
          })
        ).statusCode,
        200,
      );
      assert.equal((await app.inject(search)).json().items.length, 1);
      await app.inject({ method: 'POST', url: '/v1/auth/logout', headers: auth(session.token) });
      assert.equal(
        (await app.inject({ url: '/v1/auth/me', headers: auth(session.token) })).statusCode,
        401,
      );
    } finally {
      await pool.query('DELETE FROM observations WHERE scientific_name=$1', [tag]);
      await pool.query('DELETE FROM reports WHERE scientific_name=$1', [tag]);
      await pool.query('DELETE FROM users WHERE email=ANY($1)', [[email, 'other-' + email]]);
      await app.close();
      await pool.end();
    }
  },
);
test('map and bundled assets are served without a Google key', async () => {
  const app = createApp({ search: async () => ({ items: [], hasMore: false }) });
  try {
    const page = await app.inject('/map');
    assert.equal(page.statusCode, 200);
    assert.match(page.body, /OpenStreetMap/);
    for (const path of ['/map/leaflet.js', '/map/leaflet.css'])
      assert.equal((await app.inject(path)).statusCode, 200);
  } finally {
    await app.close();
  }
});
