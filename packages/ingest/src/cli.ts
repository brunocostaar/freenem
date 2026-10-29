import { ENEM_YEARS } from './sources/enem-api.js';

const USAGE = `Uso: pnpm --filter @freenem/ingest run <comando> [opções]

Comandos (via scripts do pacote):
  import:enem   [--years 2022,2023] [--no-images]   Importa questões do ENEM (dataset enem-api)
  import:tri    [--years 2022,2023]                 Importa parâmetros TRI (a,b,c) dos microdados do INEP
  import:fuvest [--year 2024] [--pdf arquivo.pdf]   Rascunhos de questões da FUVEST (PDF oficial)
  import:ufrgs  [--year 2024] [--pdf arquivo.pdf]   Rascunhos de questões da UFRGS (PDF oficial)
  classify:llm  [--limit 200] [--status draft]      Classifica matéria/assunto com a API da Anthropic
  classify:report                                   Contagens por ano, status e matéria no banco
`;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

function parseYears(): number[] {
  const raw = arg('years');
  if (!raw) return ENEM_YEARS;
  const years = raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n));
  if (years.length === 0) throw new Error(`--years inválido: ${raw}`);
  return years;
}

const [command] = process.argv.slice(2);
const { sql } = await import('./db.js');

try {
  switch (command) {
    case 'enem': {
      const { importEnem } = await import('./import-enem.js');
      const stats = await importEnem({ years: parseYears(), skipImages: flag('no-images') });
      console.log('\nResumo:', JSON.stringify(stats, null, 2));
      break;
    }
    case 'tri': {
      const { importTri } = await import('./tri.js');
      await importTri({ years: parseYears() });
      break;
    }
    case 'fuvest': {
      const { fuvestSource } = await import('./sources/fuvest.js');
      const { importDrafts } = await import('./import-drafts.js');
      await importDrafts(
        fuvestSource({ year: Number(arg('year') ?? 0) || undefined, pdf: arg('pdf') }),
      );
      break;
    }
    case 'ufrgs': {
      const { ufrgsSource } = await import('./sources/ufrgs.js');
      const { importDrafts } = await import('./import-drafts.js');
      await importDrafts(
        ufrgsSource({ year: Number(arg('year') ?? 0) || undefined, pdf: arg('pdf') }),
      );
      break;
    }
    case 'classify-llm': {
      const { classifyWithLlm } = await import('./classify-llm.js');
      await classifyWithLlm({
        limit: Number(arg('limit') ?? 200),
        status: (arg('status') as 'draft' | 'reviewed' | 'published' | undefined) ?? 'draft',
      });
      break;
    }
    case 'report': {
      const { report } = await import('./report.js');
      await report();
      break;
    }
    default:
      console.log(USAGE);
      process.exitCode = command ? 1 : 0;
  }
} finally {
  await sql.end();
}
