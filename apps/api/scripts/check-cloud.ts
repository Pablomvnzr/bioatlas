const required = [
  'DATABASE_URL',
  'MONGODB_URI',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_STORAGE_BUCKET',
];
for (const name of required)
  if (!process.env[name]) throw Error(`Falta configurar ${name} en el servidor.`);
if (process.env.MEDIA_STORAGE !== 'supabase')
  throw Error(
    'El despliegue gratuito requiere MEDIA_STORAGE=supabase; el disco local no es persistente.',
  );
for (const name of ['DATABASE_URL', 'MONGODB_URI', 'SUPABASE_URL']) {
  const value = process.env[name]!;
  if (/localhost|127\.0\.0\.1|host\.docker\.internal/.test(value))
    throw Error(`${name} todavía apunta al entorno local.`);
}
if (new URL(process.env.SUPABASE_URL!).protocol !== 'https:')
  throw Error('SUPABASE_URL debe usar HTTPS.');
console.log('Configuración de nube presente. Las conexiones se verificarán al iniciar.');
