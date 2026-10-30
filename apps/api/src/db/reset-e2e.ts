/**
 * Recria do zero o banco apontado por DATABASE_URL (usado pelos testes e2e).
 * Só aceita bancos cujo nome termina em `_e2e`, para nunca apagar o banco de dev.
 */
import postgres from 'postgres';
import { isProd } from '../env.js';

if (isProd) throw new Error('reset-e2e não deve rodar em produção.');

const url = new URL(process.env.DATABASE_URL ?? '');
const name = url.pathname.slice(1);
if (!/^[a-z0-9_]+_e2e$/.test(name)) {
  throw new Error(`reset-e2e só recria bancos "*_e2e" (recebido: "${name}").`);
}

url.pathname = '/postgres';
const admin = postgres(url.toString(), { max: 1, onnotice: () => {} });
try {
  await admin.unsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await admin.unsafe(`CREATE DATABASE "${name}"`);
  console.log(`Banco ${name} recriado.`);
} finally {
  await admin.end();
}
