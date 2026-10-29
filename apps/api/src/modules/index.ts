import type { FastifyInstance } from 'fastify';
import health from './health/routes.js';
import me from './me/routes.js';
import config from './config/routes.js';
import catalog from './catalog/routes.js';
import questions from './questions/routes.js';
import answers from './answers/routes.js';
import review from './review/routes.js';

/** Registrados na raiz (ex.: /health). */
export const rootModules = [health];

/**
 * Registrados sob /api/v1. Para adicionar um módulo: crie
 * `src/modules/<nome>/{routes.ts,service.ts}` e acrescente UMA linha aqui.
 */
export const v1Modules = [
  me,
  config,
  // banco de questões
  catalog,
  questions,
  answers,
  review,
];

export async function registerModules(app: FastifyInstance) {
  for (const m of rootModules) await app.register(m);
  await app.register(
    async (v1) => {
      for (const m of v1Modules) await v1.register(m);
    },
    { prefix: '/api/v1' },
  );
}
