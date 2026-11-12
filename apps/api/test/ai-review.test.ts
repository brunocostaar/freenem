import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { aiReviewListResponseSchema, aiReviewSchema, aiReviewStatusSchema } from '@freenem/shared';
import { db, schema } from '../src/db/index.js';
import { buildTestApp, createAuthedUser, type TestUser } from './helpers.js';

function mockModel(...contents: string[]) {
  const queue = [...contents];
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    if (!String(input).startsWith('https://featherless.test/')) {
      return new Response('not mocked', { status: 500 });
    }
    const content = queue.shift() ?? queue[0] ?? '';
    return new Response(
      JSON.stringify({ choices: [{ message: { content } }], usage: { cost: 0.002 } }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  });
}

describe('revisão por IA', () => {
  let app: FastifyInstance;
  let admin: TestUser;
  let reviewer: TestUser;
  let questionId: string;

  beforeAll(async () => {
    app = await buildTestApp();
    admin = await createAuthedUser(app, { role: 'admin' });
    reviewer = await createAuthedUser(app, { role: 'reviewer' });
    const tag = randomUUID().slice(0, 8);
    const [q] = await db
      .insert(schema.questions)
      .values({ statement: `IA ${tag}: quanto é 1+1?`, status: 'draft', externalId: `ai-${tag}` })
      .returning();
    questionId = q!.id;
    await db.insert(schema.alternatives).values(
      (['A', 'B', 'C', 'D', 'E'] as const).map((letter, i) => ({
        questionId,
        letter,
        text: String(i + 1),
        isCorrect: letter === 'B',
      })),
    );
  });

  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    await app.close();
  });

  it('exige admin', async () => {
    const anon = await app.inject({ method: 'GET', url: '/api/v1/review/ai/status' });
    expect(anon.statusCode).toBe(401);
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/review/ai/status',
      headers: { cookie: reviewer.cookie },
    });
    expect(res.statusCode).toBe(403);
    const run = await app.inject({
      method: 'POST',
      url: `/api/v1/review/ai/questions/${questionId}/run`,
      headers: { cookie: reviewer.cookie },
      payload: {},
    });
    expect(run.statusCode).toBe(403);
  });

  it('status', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/review/ai/status',
      headers: { cookie: admin.cookie },
    });
    expect(res.statusCode).toBe(200);
    const body = aiReviewStatusSchema.parse(res.json());
    expect(body.enabled).toBe(true);
    expect(body.models).toContain('google/gemma-3-27b-it');
  });

  it('roda a revisão (fetch mockado), armazena e lista', async () => {
    const spy = mockModel(
      '<think>hm</think>```json\n{"answer":"B","confidence":"high","issues":[],"summary":"Tudo certo."}\n```',
    );
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/review/ai/questions/${questionId}/run`,
      headers: { cookie: admin.cookie },
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    const review = aiReviewSchema.parse(res.json());
    expect(review).toMatchObject({ verdict: 'ok', modelAnswer: 'B', answerMatches: true });
    expect(review.costUsd).toBeCloseTo(0.002);
    // o gabarito não pode ir ao modelo
    const sent = JSON.parse(String(spy.mock.calls[0]![1]!.body)) as {
      messages: { role: string; content: unknown }[];
    };
    expect(JSON.stringify(sent.messages)).not.toContain('isCorrect');

    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/review/ai/questions?status=draft&filter=ok&limit=100',
      headers: { cookie: admin.cookie },
    });
    const items = aiReviewListResponseSchema.parse(list.json()).items;
    expect(items.find((i) => i.questionId === questionId)?.review?.verdict).toBe('ok');
  });

  it('JSON inválido duas vezes vira unsure; divergência vira problem', async () => {
    mockModel('lixo', 'mais lixo');
    const bad = await app.inject({
      method: 'POST',
      url: `/api/v1/review/ai/questions/${questionId}/run`,
      headers: { cookie: admin.cookie },
      payload: { model: 'deepseek-ai/DeepSeek-V3.2' },
    });
    expect(aiReviewSchema.parse(bad.json())).toMatchObject({
      verdict: 'unsure',
      issues: ['resposta inválida do modelo'],
    });

    vi.restoreAllMocks();
    mockModel('{"answer":"D","confidence":"high","issues":[],"summary":"x"}');
    const mismatch = await app.inject({
      method: 'POST',
      url: `/api/v1/review/ai/questions/${questionId}/run`,
      headers: { cookie: admin.cookie },
      payload: {},
    });
    expect(aiReviewSchema.parse(mismatch.json())).toMatchObject({
      verdict: 'problem',
      answerMatches: false,
    });
  });

  it('404 para questão inexistente', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/review/ai/questions/${randomUUID()}/run`,
      headers: { cookie: admin.cookie },
      payload: {},
    });
    expect(res.statusCode).toBe(404);
  });
});
