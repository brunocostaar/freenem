import { ENEM_YEARS } from './sources/enem-api.js';

const USAGE = `Uso: pnpm --filter @freenem/ingest run <comando> [opções]

Comandos (via scripts do pacote):
  import:enem   [--years 2022,2023] [--no-images]   Importa questões do ENEM (dataset enem-api)
  import:tri    [--years 2022,2023]                 Importa parâmetros TRI (a,b,c) dos microdados do INEP
  import:enem-ppl [--years 2022,2023] [--dry-run]   ENEM PPL (2ª aplicação): provas oficiais do INEP (PDF + gabarito)
  import:fuvest [--year 2024] [--pdf prova.pdf --gabarito gab.pdf] [--version V1]
                                                    Rascunhos da FUVEST 1ª fase (PDF oficial + gabarito)
  import:ufrgs  [--year 2025] [--pdf dia1.pdf --pdf2 dia2-ingles.pdf --gabarito pagina.html]
                                                    Rascunhos do Vestibular UFRGS (dias 1 e 2)
  import:unicamp [--year 2025] [--pdf prova.pdf --gabarito gab.pdf]
                                                    Rascunhos da UNICAMP 1ª fase (72 questões, a–d)
  import:vestibulares [--dry-run]                   Todos os vestibulares/anos conhecidos (sem --year = todos os anos)
                                                    Opções comuns: --dry-run (não grava no banco)
  classify:llm  [--limit 200] [--status draft]      Classifica matéria/assunto com a API da Anthropic
  quality:report [--dry-run]                        Checa qualidade das questões; rebaixa suspeitas publicadas para draft
  review:auto   [--dry-run] [--institution enem|fuvest|ufrgs|unicamp]
                                                    Publica rascunhos íntegros (regras determinísticas, sem LLM)
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
    case 'fuvest':
    case 'ufrgs':
    case 'unicamp':
    case 'vestibulares': {
      const { runVestibulares } = await import('./run-vestibulares.js');
      await runVestibulares(command, {
        years: arg('year') ? [Number(arg('year'))] : arg('years') ? parseYears() : undefined,
        pdf: arg('pdf'),
        pdf2: arg('pdf2'),
        gabarito: arg('gabarito'),
        version: arg('version'),
        languages: arg('langs')?.split(',') as ('ingles' | 'espanhol')[] | undefined,
        dryRun: flag('dry-run'),
      });
      break;
    }
    case 'enem-ppl': {
      const { runEnemPpl } = await import('./run-enem-ppl.js');
      await runEnemPpl({
        years: arg('years') ? parseYears() : undefined,
        dryRun: flag('dry-run'),
      });
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
    case 'quality': {
      const { qualityReport } = await import('./quality-report.js');
      await qualityReport({ dryRun: flag('dry-run') });
      break;
    }
    case 'auto-review': {
      const { autoReview } = await import('./auto-review.js');
      await autoReview({ dryRun: flag('dry-run'), institution: arg('institution') });
      break;
    }
    default:
      console.log(USAGE);
      process.exitCode = command ? 1 : 0;
  }
} finally {
  await sql.end();
}
