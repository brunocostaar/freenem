import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { CACHE_DIR } from '../db.js';

/**
 * Fonte A: dataset aberto https://github.com/yunger7/enem-api (GPL-2.0).
 * Baixamos só `public/` com clone raso + sparse checkout em `.cache/enem-api`.
 */
export const DATASET_REPO = 'https://github.com/yunger7/enem-api.git';
export const DATASET_DIR = path.join(CACHE_DIR, 'enem-api');
export const DATASET_PUBLIC = path.join(DATASET_DIR, 'public');
export const ENEM_YEARS = Array.from({ length: 15 }, (_, i) => 2009 + i);

const alternativeSchema = z.object({
  letter: z.enum(['A', 'B', 'C', 'D', 'E']),
  text: z.string().nullable(),
  file: z.string().nullable(),
  isCorrect: z.boolean(),
});

export const datasetQuestionSchema = z.object({
  title: z.string(),
  index: z.number().int(),
  year: z.number().int(),
  language: z.enum(['ingles', 'espanhol']).nullable(),
  discipline: z.string(),
  context: z.string().nullable(),
  files: z.array(z.string()),
  correctAlternative: z.enum(['A', 'B', 'C', 'D', 'E']).nullable(),
  alternativesIntroduction: z.string().nullable(),
  alternatives: z.array(alternativeSchema),
});
export type DatasetQuestion = z.infer<typeof datasetQuestionSchema>;

export function ensureDataset(): void {
  if (existsSync(path.join(DATASET_PUBLIC, '2023'))) return;
  console.log(`Baixando dataset (clone raso + sparse) em ${DATASET_DIR} ...`);
  if (!existsSync(path.join(DATASET_DIR, '.git'))) {
    execFileSync(
      'git',
      ['clone', '--depth', '1', '--filter=blob:none', '--sparse', DATASET_REPO, DATASET_DIR],
      { stdio: 'inherit' },
    );
  }
  execFileSync('git', ['-C', DATASET_DIR, 'sparse-checkout', 'set', 'public'], {
    stdio: 'inherit',
  });
}

export interface LoadedQuestion {
  /** pasta dentro de public/<ano>/questions, ex.: "1-ingles" */
  dir: string;
  data: DatasetQuestion;
}

export async function loadYear(year: number): Promise<LoadedQuestion[]> {
  const base = path.join(DATASET_PUBLIC, String(year), 'questions');
  const dirs = await readdir(base);
  const out: LoadedQuestion[] = [];
  for (const dir of dirs) {
    const file = path.join(base, dir, 'details.json');
    if (!existsSync(file)) continue;
    const json: unknown = JSON.parse(await readFile(file, 'utf8'));
    out.push({ dir, data: datasetQuestionSchema.parse(json) });
  }
  return out.sort((a, b) => a.data.index - b.data.index || a.dir.localeCompare(b.dir));
}

/**
 * Área do ENEM pela POSIÇÃO da questão (os rótulos `discipline` do dataset erram nas bordas).
 * - 2009: 1–45 Natureza, 46–90 Humanas (1º dia); 91–135 Linguagens, 136–180 Matemática (2º dia)
 * - 2010–2016: 1–45 Humanas, 46–90 Natureza; 91–135 Linguagens, 136–180 Matemática
 * - 2017+: 1–45 Linguagens, 46–90 Humanas (1º dia); 91–135 Natureza, 136–180 Matemática (2º dia)
 */
export type Area = 'linguagens' | 'humanas' | 'natureza' | 'matematica';

export function areaOf(year: number, index: number): Area {
  const order: Area[] =
    year >= 2017
      ? ['linguagens', 'humanas', 'natureza', 'matematica']
      : year === 2009
        ? ['natureza', 'humanas', 'linguagens', 'matematica']
        : ['humanas', 'natureza', 'linguagens', 'matematica'];
  return order[Math.min(3, Math.floor((index - 1) / 45))] ?? 'linguagens';
}

/**
 * Dia da prova pela área: até 2015, 1º dia = Humanas + Natureza e 2º dia = Linguagens + Matemática;
 * a partir de 2016, 1º dia = Linguagens + Humanas e 2º dia = Natureza + Matemática.
 */
export function dayOf(year: number, area: Area): 1 | 2 {
  if (year >= 2016) return area === 'linguagens' || area === 'humanas' ? 1 : 2;
  return area === 'humanas' || area === 'natureza' ? 1 : 2;
}
