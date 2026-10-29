import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, sql } from './index.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// src/db/migrate.ts (dev) e dist/migrate.js (prod) -> ../drizzle ou ../../drizzle
const here = path.dirname(fileURLToPath(import.meta.url));
const candidates = [path.resolve(here, '../drizzle'), path.resolve(here, '../../drizzle')];

import { existsSync } from 'node:fs';
const folder = candidates.find((p) => existsSync(path.join(p, 'meta', '_journal.json')));
if (!folder) throw new Error('Pasta de migrations não encontrada');

console.log(`Aplicando migrations de ${folder}...`);
await migrate(db, { migrationsFolder: folder });
console.log('Migrations aplicadas.');
await sql.end();
