import { readFile } from 'node:fs/promises';

export type RemoteStorage = {
  verify: () => Promise<void>;
  upload: (path: string, name: string, mime: string) => Promise<void>;
  signedUrl: (name: string) => Promise<string>;
  remove: (name: string) => Promise<void>;
};
export function createSupabaseStorage(
  env: NodeJS.ProcessEnv = process.env,
  request: typeof fetch = fetch,
): RemoteStorage {
  const url = env.SUPABASE_URL,
    key = env.SUPABASE_SERVICE_ROLE_KEY,
    bucket = env.SUPABASE_STORAGE_BUCKET;
  if (!url || !key || !bucket)
    throw Error('Configura SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y SUPABASE_STORAGE_BUCKET.');
  if (new URL(url).protocol !== 'https:') throw Error('Supabase requiere HTTPS.');
  const failed = () =>
    Object.assign(Error('El almacenamiento en la nube no está disponible. Inténtalo nuevamente.'), {
      statusCode: 503,
    });
  const base = new URL('/storage/v1/', url),
    bucketPath = encodeURIComponent(bucket);
  const objectPath = (name: string) => {
    if (!/^[a-zA-Z0-9_-]+\.(jpg|png|mp4)$/.test(name)) throw Error('Nombre de archivo inválido.');
    return `${bucketPath}/${encodeURIComponent(name)}`;
  };
  async function call(path: string, method = 'GET', body?: BodyInit, mime = 'application/json') {
    let response: Response;
    try {
      response = await request(new URL(path, base), {
        method,
        body,
        redirect: 'error',
        signal: AbortSignal.timeout(90000),
        headers: {
          apikey: key!,
          Authorization: `Bearer ${key}`,
          'Content-Type': mime,
          'x-upsert': 'false',
          'Cache-Control': 'max-age=120',
        },
      });
    } catch {
      throw failed();
    }
    if (!response.ok) throw failed();
    return response;
  }
  return {
    async verify() {
      const data = await (await call(`bucket/${bucketPath}`)).json();
      if (data.public !== false) throw Error('El bucket de BioAtlas debe ser privado.');
    },
    async upload(path, name, mime) {
      await call(`object/${objectPath(name)}`, 'POST', new Uint8Array(await readFile(path)), mime);
    },
    async signedUrl(name) {
      const data = await (
        await call(`object/sign/${objectPath(name)}`, 'POST', JSON.stringify({ expiresIn: 120 }))
      ).json();
      if (typeof data.signedURL !== 'string') throw failed();
      const signed = new URL(
        data.signedURL.startsWith('/object/') ? `/storage/v1${data.signedURL}` : data.signedURL,
        url,
      );
      if (signed.origin !== new URL(url).origin) throw failed();
      return signed.href;
    },
    async remove(name) {
      objectPath(name);
      await call(`object/${bucketPath}`, 'DELETE', JSON.stringify({ prefixes: [name] }));
    },
  };
}
