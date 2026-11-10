import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readdir, unlink, rmdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { MongoClient } from 'mongodb';
import pg from 'pg';
import {
  isMp4,
  detectMedia,
  parseRange,
  type MediaService,
  type MediaDocument,
} from '../src/media.ts';
import { createApp } from '../src/app.ts';
import { createRepository } from '../src/repository.ts';
const mp4 = Buffer.from([
  0, 0, 0, 20, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 0, 109, 112, 52, 50, 0, 0, 0, 8,
  109, 100, 97, 116,
]);
test('media headers and ranges reject unsupported input', () => {
  assert.ok(isMp4(mp4));
  assert.equal(detectMedia(Buffer.from('<html>')), null);
  assert.equal(detectMedia(Buffer.from([255, 216, 255, 224]))?.kind, 'image');
  assert.deepEqual(parseRange('bytes=2-5', 10), { start: 2, end: 5 });
  assert.deepEqual(parseRange('bytes=-3', 10), { start: 7, end: 9 });
  assert.throws(() => parseRange('bytes=20-', 10));
  assert.throws(() => parseRange('bytes=0-2,4-6', 10));
});
test(
  'member uploads, ownership, moderation, publication and deletion',
  { skip: !process.env.DATABASE_URL || !process.env.MONGODB_URI },
  async () => {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    const mongo = new MongoClient(process.env.MONGODB_URI!);
    await mongo.connect();
    const tag = randomUUID(),
      email = `media-${tag}@example.org`,
      otherEmail = `other-${email}`;
    const base = resolve('data/media-tests');
    await mkdir(base, { recursive: true });
    const directory = await mkdtemp(join(base, 'run-'));
    const collection = mongo
      .db()
      .collection<MediaDocument>('test_media_' + tag.replaceAll('-', ''));
    const media: MediaService = { collection, directory, close: async () => {} };
    const app = createApp(createRepository(pool), false, pool, media);
    const auth = (token: string) => ({ authorization: `Bearer ${token}` });
    const body = (bytes: Buffer, mime: string) =>
      Buffer.concat([
        Buffer.from(
          `--test-boundary\r\nContent-Disposition: form-data; name="file"; filename="test"\r\nContent-Type: ${mime}\r\n\r\n`,
        ),
        bytes,
        Buffer.from('\r\n--test-boundary--\r\n'),
      ]);
    try {
      const register = async (email: string) =>
        (
          await app.inject({
            method: 'POST',
            url: '/v1/auth/register',
            payload: { name: 'Media test', email, password: 'Long-media-test-password' },
          })
        ).json();
      const owner = await register(email),
        other = await register(otherEmail);
      const created = await app.inject({
        method: 'POST',
        url: '/v1/reports',
        headers: auth(owner.token),
        payload: {
          scientificName: tag,
          description: 'Avistamiento de prueba multimedia',
          latitude: -39.8,
          longitude: -73.2,
          eventDate: '2026-01-01',
        },
      });
      assert.equal(created.statusCode, 201, created.body);
      const reportId = created.json().id;
      const upload = (token: string, bytes = mp4, mime = 'video/mp4') =>
        app.inject({
          method: 'POST',
          url: `/v1/reports/${reportId}/media?title=Prueba%20multimedia`,
          headers: {
            ...auth(token),
            'content-type': 'multipart/form-data; boundary=test-boundary',
          },
          payload: body(bytes, mime),
        });
      assert.equal((await upload(other.token)).statusCode, 403);
      assert.equal((await upload(owner.token, Buffer.from('invalid'))).statusCode, 400);
      const uploaded = await upload(owner.token);
      assert.equal(uploaded.statusCode, 201, uploaded.body);
      const id = uploaded.json().id;
      assert.equal(uploaded.json().status, 'pending');
      assert.equal((await collection.findOne({ _id: id }))?.reportId, reportId);
      const content = `/v1/media/${id}/content`;
      assert.equal((await app.inject(content)).statusCode, 404);
      assert.equal(
        (await app.inject({ url: content, headers: auth(other.token) })).statusCode,
        404,
      );
      assert.equal(
        (await app.inject({ method: 'DELETE', url: `/v1/media/${id}`, headers: auth(other.token) }))
          .statusCode,
        403,
      );
      const partial = await app.inject({
        url: content,
        headers: { ...auth(owner.token), range: 'bytes=0-7' },
      });
      assert.equal(partial.statusCode, 206);
      assert.deepEqual(partial.rawPayload, mp4.subarray(0, 8));
      await pool.query("UPDATE users SET role='admin' WHERE email=$1", [otherEmail]);
      const reviewed = await app.inject({
        method: 'PATCH',
        url: `/v1/media/${id}/review`,
        headers: auth(other.token),
        payload: { status: 'approved', note: 'Archivo revisado' },
      });
      assert.equal(reviewed.statusCode, 200, reviewed.body);
      assert.equal((await app.inject(content)).statusCode, 404);
      await pool.query("UPDATE reports SET status='approved' WHERE id=$1", [reportId]);
      assert.equal((await app.inject(content)).statusCode, 200);
      const photo = await upload(owner.token, Buffer.from([255, 216, 255, 224]), 'image/jpeg');
      assert.equal(photo.statusCode, 201, photo.body);
      const list = (await app.inject(`/v1/reports/${reportId}/media`)).json();
      assert.equal(list.items.length, 1);
      assert.ok(!('objectName' in list.items[0]));
      assert.equal(
        (await app.inject({ url: content, headers: { range: 'bytes=999-' } })).statusCode,
        416,
      );
      let signed = 0,
        removed = 0;
      media.remote = {
        verify: async () => {},
        upload: async () => {},
        signedUrl: async () => {
          signed++;
          return 'https://test.supabase.co/storage/v1/object/sign/test?token=temporary';
        },
        remove: async () => {
          removed++;
        },
      };
      const cloud = await upload(owner.token);
      assert.equal(cloud.statusCode, 201);
      assert.equal((await collection.findOne({ _id: cloud.json().id }))?.provider, 'supabase');
      assert.equal((await app.inject(`/v1/media/${cloud.json().id}/playback`)).statusCode, 404);
      assert.equal(signed, 0);
      assert.equal(
        (
          await app.inject({
            url: `/v1/media/${cloud.json().id}/playback`,
            headers: auth(owner.token),
          })
        ).statusCode,
        200,
      );
      assert.equal(signed, 1);
      assert.equal(
        (
          await app.inject({
            url: `/v1/media/${cloud.json().id}/content`,
            headers: auth(owner.token),
          })
        ).statusCode,
        404,
      );
      for (const item of [uploaded.json(), photo.json(), cloud.json()])
        assert.equal(
          (
            await app.inject({
              method: 'DELETE',
              url: `/v1/media/${item.id}`,
              headers: auth(owner.token),
            })
          ).statusCode,
          204,
        );
      assert.equal((await readdir(directory)).length, 0);
      assert.equal(removed, 1);
    } finally {
      await pool.query('DELETE FROM reports WHERE scientific_name=$1', [tag]);
      await pool.query('DELETE FROM users WHERE email=ANY($1)', [[email, otherEmail]]);
      await collection.drop().catch(() => {});
      await app.close();
      await pool.end();
      await mongo.close();
      for (const file of await readdir(directory)) await unlink(join(directory, file));
      await rmdir(directory);
    }
  },
);
