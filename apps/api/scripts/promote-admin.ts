import pg from 'pg';
const email = process.argv[2]?.trim().toLowerCase();
if (!email || !process.env.DATABASE_URL)
  throw Error('Uso: node --env-file=.env scripts/promote-admin.ts correo');
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  const result = await db.query("UPDATE users SET role='admin' WHERE email=$1 RETURNING id", [
    email,
  ]);
  if (!result.rowCount) throw Error('Primero registra esa cuenta desde la aplicación.');
  console.log('Administrador asignado. Vuelve a iniciar sesión para actualizar la interfaz.');
} finally {
  await db.end();
}
