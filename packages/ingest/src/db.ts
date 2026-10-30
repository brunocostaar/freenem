import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../../../apps/api/src/db/schema/index.js';
import { createStorage, type Storage } from '../../../apps/api/src/lib/storage-core.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.resolve(here, '../../../apps/api');

export const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://freenem:freenem@127.0.0.1:5442/freenem';

export const sql = postgres(DATABASE_URL, { max: 5, onnotice: () => {} });
export const db = drizzle(sql, { schema });
export { schema };

/** Mesma configuração do storage da API (STORAGE_DRIVER=local|r2). */
export function getStorage(): Storage {
  const apiBase = (process.env.BETTER_AUTH_URL ?? 'http://localhost:3340').replace(/\/$/, '');
  const dir = process.env.STORAGE_DIR ?? './storage';
  return createStorage({
    driver: process.env.STORAGE_DRIVER === 'r2' ? 'r2' : 'local',
    // STORAGE_DIR é relativo ao apps/api (onde a API roda)
    localDir: path.isAbsolute(dir) ? dir : path.resolve(apiDir, dir),
    localPublicUrl: `${apiBase}/files`,
    r2: {
      accountId: process.env.R2_ACCOUNT_ID,
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      bucket: process.env.R2_BUCKET,
      publicUrl: process.env.R2_PUBLIC_URL,
    },
  });
}

export { CACHE_DIR } from './paths.js';
