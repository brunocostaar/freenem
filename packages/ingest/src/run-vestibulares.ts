import { importVestibular, writeReport, type VestibularStats } from './import-vestibular.js';
import type { Source } from './index.js';
import { fuvestSource, FUVEST_YEARS } from './sources/fuvest.js';
import { ufrgsSource, UFRGS_YEARS } from './sources/ufrgs.js';
import { unicampSource, UNICAMP_YEARS } from './sources/unicamp.js';

export interface RunOptions {
  /** anos a importar (padrão: todos os anos conhecidos da instituição) */
  years?: number[];
  pdf?: string;
  pdf2?: string;
  gabarito?: string;
  version?: string;
  languages?: ('ingles' | 'espanhol')[];
  dryRun?: boolean;
}

type Kind = 'fuvest' | 'ufrgs' | 'unicamp' | 'vestibulares';

function sourcesFor(kind: Exclude<Kind, 'vestibulares'>, o: RunOptions): Source[] {
  const custom = o.pdf !== undefined;
  const years = o.years ?? (custom ? [new Date().getFullYear()] : undefined);
  switch (kind) {
    case 'fuvest':
      return (years ?? FUVEST_YEARS).map((year) =>
        fuvestSource({ year, pdf: o.pdf, gabarito: o.gabarito, version: o.version }),
      );
    case 'ufrgs':
      return (years ?? UFRGS_YEARS).map((year) =>
        ufrgsSource({
          year,
          pdf: o.pdf,
          pdf2: o.pdf2,
          gabarito: o.gabarito,
          languages: o.languages,
        }),
      );
    case 'unicamp':
      return (years ?? UNICAMP_YEARS).map((year) =>
        unicampSource({ year, pdf: o.pdf, gabarito: o.gabarito }),
      );
  }
}

/** Executa um ou todos os importadores de vestibular e imprime o resumo + caminho do relatório. */
export async function runVestibulares(kind: Kind, o: RunOptions): Promise<void> {
  const kinds: Exclude<Kind, 'vestibulares'>[] =
    kind === 'vestibulares' ? ['fuvest', 'ufrgs', 'unicamp'] : [kind];
  const csv: string[] = [];
  const all: VestibularStats[] = [];
  for (const k of kinds) {
    // com --pdf/--gabarito personalizados só faz sentido um ano por vez
    const opts = kind === 'vestibulares' ? { dryRun: o.dryRun } : o;
    for (const source of sourcesFor(k, opts)) {
      try {
        const r = await importVestibular(source, { dryRun: o.dryRun });
        all.push(...r.stats);
        csv.push(...r.csv);
      } catch (e) {
        console.error(`  ERRO (${k}): ${e instanceof Error ? e.message : String(e)}`);
        process.exitCode = 1;
      }
    }
  }
  const file = await writeReport(csv);
  console.log('\nResumo (tudo como rascunho; nada é publicado automaticamente):');
  console.table(
    all.map((s) => ({
      prova: s.exam,
      extraidas: s.extracted,
      esperadas: s.expected ?? '?',
      gravadas: s.imported,
      anuladas: s.annulled,
      gabarito: s.withGabarito,
      figuras: s.withImages,
      materia: s.withSubject,
      avisos: s.flagged,
    })),
  );
  console.log(`Relatório de avisos por questão: ${file}`);
}
