/**
 * Envia os arquivos do storage local (imagens das questões importadas) para o storage
 * configurado (STORAGE_DRIVER=r2), mantendo as chaves: as referências `storage://` do banco
 * continuam válidas. Pula o que já existe no destino. Uso:
 *   STORAGE_DRIVER=r2 R2_...=... pnpm --filter @freenem/api storage:sync [diretório local]
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../env.js';
import { contentTypeFor, getStorage } from '../lib/storage.js';

if (env.STORAGE_DRIVER !== 'r2') throw new Error('storage:sync exige STORAGE_DRIVER=r2.');

const root = path.resolve(process.argv[2] ?? './storage');
const storage = getStorage();

async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}

const files: string[] = [];
for await (const f of walk(root)) files.push(f);
console.log(`${files.length} arquivos em ${root}`);

let sent = 0;
let skipped = 0;
let next = 0;
async function worker() {
  while (next < files.length) {
    const file = files[next++]!;
    const key = path.relative(root, file).split(path.sep).join('/');
    if (await storage.exists(key)) {
      skipped++;
      continue;
    }
    await storage.put(key, await readFile(file), contentTypeFor(file));
    sent++;
    if (sent % 200 === 0) console.log(`  ${sent} enviados...`);
  }
}
await Promise.all(Array.from({ length: 16 }, worker));
console.log(`Pronto: ${sent} enviados, ${skipped} já existiam.`);
