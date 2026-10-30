import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CACHE_DIR } from './db.js';
import { importVestibular, REPORT_HEADER, type VestibularStats } from './import-vestibular.js';
import { enemPplSource, PPL_YEARS, type PplDay } from './sources/enem-ppl.js';

export interface PplRunOptions {
  years?: number[];
  dryRun?: boolean;
}

/** Importa o ENEM PPL (um dia por vez: falha de um PDF não derruba os outros). */
export async function runEnemPpl(o: PplRunOptions): Promise<void> {
  const csv: string[] = [];
  const all: VestibularStats[] = [];
  const failed: string[] = [];
  for (const year of o.years ?? PPL_YEARS) {
    for (const day of [1, 2] as PplDay[]) {
      try {
        const r = await importVestibular(enemPplSource({ year, days: [day] }), {
          dryRun: o.dryRun,
        });
        all.push(...r.stats);
        csv.push(...r.csv);
      } catch (e) {
        const msg = `ENEM PPL ${year} · Dia ${day}: ${e instanceof Error ? e.message : String(e)}`;
        console.error(`  ERRO ${msg}`);
        failed.push(msg);
      }
    }
  }
  await mkdir(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, 'enem-ppl-report.csv');
  await writeFile(file, [REPORT_HEADER, ...csv].join('\n') + '\n', 'utf8');
  console.table(
    all.map((s) => ({
      prova: s.exam,
      extraidas: s.extracted,
      esperadas: s.expected ?? '?',
      gravadas: s.imported,
      publicadas: s.published,
      anuladas: s.annulled,
      gabarito: s.withGabarito,
      figuras: s.withImages,
      avisos: s.flagged,
    })),
  );
  if (failed.length) {
    console.log('\nFalharam:\n' + failed.map((f) => `  - ${f}`).join('\n'));
    process.exitCode = 1;
  }
  console.log(`Relatório por questão: ${file}`);
}
