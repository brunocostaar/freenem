import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export default async function setup() {
  const url =
    process.env.DATABASE_URL_TEST ?? 'postgres://freenem:freenem@127.0.0.1:5442/freenem_test';
  const client = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(client), {
      migrationsFolder: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../drizzle'),
    });
  } finally {
    await client.end();
  }
}
