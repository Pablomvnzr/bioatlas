import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSupabaseStorage } from '../src/supabase-storage.ts';
const env = {
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-secret',
  SUPABASE_STORAGE_BUCKET: 'bioatlas-media',
};
test('Supabase keeps private storage, authorizes requests and signs only trusted download URLs', async () => {
  const requests: { url: string; init?: RequestInit }[] = [];
  let publicBucket = false,
    foreign = false;
  const request: typeof fetch = async (url, init) => {
    requests.push({ url: String(url), init });
    const data = String(url).includes('/bucket/')
      ? { public: publicBucket }
      : String(url).includes('/sign/')
        ? {
            signedURL: foreign
              ? 'https://other.example/secret'
              : '/object/sign/bioatlas-media/test.jpg?token=test',
          }
        : {};
    return new Response(JSON.stringify(data), { status: 200 });
  };
  const storage = createSupabaseStorage(env, request),
    directory = await mkdtemp(join(tmpdir(), 'bioatlas-storage-test-'));
  try {
    await storage.verify();
    await createSupabaseStorage(
      { ...env, SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test' },
      request,
    ).verify();
    const secretHeaders = new Headers(requests.at(-1)?.init?.headers);
    assert.equal(secretHeaders.get('apikey'), 'sb_secret_test');
    assert.equal(secretHeaders.has('Authorization'), false);
    publicBucket = true;
    await assert.rejects(() => storage.verify(), /privado/);
    publicBucket = false;
    await writeFile(join(directory, 'test.jpg'), Buffer.from([255, 216, 255]));
    await storage.upload(join(directory, 'test.jpg'), 'test.jpg', 'image/jpeg');
    const upload = requests.at(-1)!;
    assert.equal(upload.init?.method, 'POST');
    assert.equal(new Headers(upload.init?.headers).get('Authorization'), 'Bearer test-secret');
    assert.equal(new Headers(upload.init?.headers).get('x-upsert'), 'false');
    assert.equal(
      await storage.signedUrl('test.jpg'),
      'https://test.supabase.co/storage/v1/object/sign/bioatlas-media/test.jpg?token=test',
    );
    assert.equal(requests.at(-1)?.init?.body, JSON.stringify({ expiresIn: 120 }));
    foreign = true;
    await assert.rejects(() => storage.signedUrl('test.jpg'), /almacenamiento/);
    await assert.rejects(() => storage.signedUrl('../test.jpg'), /inválido/);
    await storage.remove('test.jpg');
    assert.equal(requests.at(-1)?.init?.method, 'DELETE');
    const unavailable = createSupabaseStorage(
      env,
      async () => new Response('sensitive error details', { status: 403 }),
    );
    await assert.rejects(
      () => unavailable.verify(),
      (e) =>
        e instanceof Error &&
        !e.message.includes('sensitive') &&
        e.message.includes('almacenamiento'),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
