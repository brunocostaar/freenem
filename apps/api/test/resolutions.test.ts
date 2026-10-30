import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import {
  myResolutionsSchema,
  resolutionListResponseSchema,
  resolutionReviewListSchema,
  resolutionSchema,
} from '@freenem/shared';
import { db, schema } from '../src/db/index.js';
import { sanitizeResolutionBody } from '../src/modules/resolutions/sanitize.js';
import { buildTestApp, createAuthedUser, deleteUser, type TestUser } from './helpers.js';

const GOOD = 'Primeiro isolamos x: $2x + 3 = 11$, logo $x = 4$. Explicação passo a passo.';

describe('sanitização', () => {
  it('remove HTML e imagens, preserva LaTeX e links https', () => {
    const out = sanitizeResolutionBody(
      'Oi <script>alert(1)</script><b>negrito</b> ![x](https://a/b.png) $a < b$ e $c > d$ ' +
        '[ok](https://x.com) [ruim](javascript:alert(1)) <!-- c -->',
    );
    expect(out).not.toMatch(/<script|<b>|alert\(1\)|!\[|javascript|<!--/);
    expect(out).toContain('negrito');
    expect(out).toContain('$a < b$');
    expect(out).toContain('[ok](https://x.com)');
    expect(out).toContain('ruim');
  });
  it('limita o tamanho', () => {
    expect(sanitizeResolutionBody('a'.repeat(9000)).length).toBe(8000);
  });
});

describe('resoluções da comunidade', () => {
  let app: FastifyInstance;
  let admin: TestUser;
  let author: TestUser;
  let voters: TestUser[];
  let questionId: string;
  let draftId: string;

  beforeAll(async () => {
    app = await buildTestApp();
    admin = await createAuthedUser(app, { role: 'admin' });
    author = await createAuthedUser(app);
    voters = [await createAuthedUser(app), await createAuthedUser(app)];
    const tag = randomUUID().slice(0, 8);
    const rows = await db
      .insert(schema.questions)
      .values([
        { statement: `Resolução ${tag}`, status: 'published', externalId: `res-${tag}-a` },
        { statement: `Rascunho ${tag}`, status: 'draft', externalId: `res-${tag}-b` },
      ])
      .returning();
    questionId = rows[0]!.id;
    draftId = rows[1]!.id;
    await db.insert(schema.alternatives).values([
      { questionId, letter: 'A', text: 'a', isCorrect: true },
      { questionId, letter: 'B', text: 'b', isCorrect: false },
    ]);
  });

  afterAll(async () => {
    await db.delete(schema.questions).where(eq(schema.questions.id, questionId));
    await db.delete(schema.questions).where(eq(schema.questions.id, draftId));
    for (const u of [admin, author, ...voters]) await deleteUser(u.id);
    await app.close();
  });

  const call = (
    u: TestUser | null,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    url: string,
    payload?: object,
  ) =>
    app.inject({
      method,
      url: `/api/v1${url}`,
      headers: u ? { cookie: u.cookie } : {},
      ...(payload ? { payload } : {}),
    });

  let resId: string;

  it('exige login para escrever e valida o corpo', async () => {
    expect(
      (await call(null, 'POST', `/questions/${questionId}/resolutions`, { body: GOOD })).statusCode,
    ).toBe(401);
    expect(
      (await call(author, 'POST', `/questions/${questionId}/resolutions`, { body: 'curto' }))
        .statusCode,
    ).toBe(400);
    expect(
      (
        await call(author, 'POST', `/questions/${questionId}/resolutions`, {
          body: 'a'.repeat(8001),
        })
      ).statusCode,
    ).toBe(400);
    // só HTML/imagem: vazio após sanitizar
    expect(
      (
        await call(author, 'POST', `/questions/${questionId}/resolutions`, {
          body: `<div>${'<i></i>'.repeat(10)}</div>`,
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (await call(author, 'POST', `/questions/${randomUUID()}/resolutions`, { body: GOOD }))
        .statusCode,
    ).toBe(404);
    expect(
      (await call(author, 'POST', `/questions/${draftId}/resolutions`, { body: GOOD })).statusCode,
    ).toBe(404);
  });

  it('cria como pendente, sanitiza e impede duplicata', async () => {
    const res = await call(author, 'POST', `/questions/${questionId}/resolutions`, {
      body: `${GOOD} <script>x</script>![i](https://e.com/i.png)`,
    });
    expect(res.statusCode).toBe(201);
    const r = resolutionSchema.parse(res.json());
    resId = r.id;
    expect(r.status).toBe('pending');
    expect(r.mine).toBe(true);
    expect(r.body).not.toMatch(/script|!\[/);
    const dup = await call(author, 'POST', `/questions/${questionId}/resolutions`, { body: GOOD });
    expect(dup.statusCode).toBe(409);
  });

  it('pendente só aparece para o autor, em `mine`', async () => {
    const own = resolutionListResponseSchema.parse(
      (await call(author, 'GET', `/questions/${questionId}/resolutions`)).json(),
    );
    expect(own.items).toHaveLength(0);
    expect(own.mine?.id).toBe(resId);
    const anon = resolutionListResponseSchema.parse(
      (await call(null, 'GET', `/questions/${questionId}/resolutions`)).json(),
    );
    expect(anon.items).toHaveLength(0);
    expect(anon.mine).toBeNull();
    expect(
      (await call(voters[0]!, 'POST', `/resolutions/${resId}/vote`, { value: 1 })).statusCode,
    ).toBe(404);
  });

  it('moderação exige revisor; aprovar publica', async () => {
    expect((await call(author, 'GET', '/review/resolutions')).statusCode).toBe(403);
    expect(
      (await call(author, 'PATCH', `/review/resolutions/${resId}`, { action: 'approve' }))
        .statusCode,
    ).toBe(403);
    const list = resolutionReviewListSchema.parse(
      (await call(admin, 'GET', '/review/resolutions?status=pending')).json(),
    );
    const item = list.items.find((i) => i.id === resId);
    expect(item?.question.correctLetter).toBe('A');
    expect(list.pendingTotal).toBeGreaterThanOrEqual(1);
    expect(
      (await call(admin, 'PATCH', `/review/resolutions/${resId}`, { action: 'reject' })).statusCode,
    ).toBe(400);
    expect(
      (await call(admin, 'PATCH', `/review/resolutions/${resId}`, { action: 'promote' }))
        .statusCode,
    ).toBe(409);
    expect(
      (await call(admin, 'PATCH', `/review/resolutions/${randomUUID()}`, { action: 'approve' }))
        .statusCode,
    ).toBe(404);
    expect(
      (await call(admin, 'PATCH', `/review/resolutions/${resId}`, { action: 'approve' }))
        .statusCode,
    ).toBe(200);
    const pub = resolutionListResponseSchema.parse(
      (await call(null, 'GET', `/questions/${questionId}/resolutions`)).json(),
    );
    expect(pub.items.map((i) => i.id)).toEqual([resId]);
    expect(pub.items[0]!.mine).toBe(false);
  });

  it('votos: não vota na própria, alterna, troca e soma', async () => {
    const vote = (u: TestUser, value: number) =>
      call(u, 'POST', `/resolutions/${resId}/vote`, { value });
    expect((await vote(author, 1)).statusCode).toBe(403);
    expect((await call(null, 'POST', `/resolutions/${resId}/vote`, { value: 1 })).statusCode).toBe(
      401,
    );
    expect((await vote(voters[0]!, 0)).statusCode).toBe(400);
    expect((await vote(voters[0]!, 1)).json()).toEqual({ score: 1, myVote: 1 });
    expect((await vote(voters[1]!, 1)).json()).toEqual({ score: 2, myVote: 1 });
    // troca para -1: 2 -> 0
    expect((await vote(voters[1]!, -1)).json()).toEqual({ score: 0, myVote: -1 });
    // repetir remove o voto
    expect((await vote(voters[1]!, -1)).json()).toEqual({ score: 1, myVote: 0 });
    const mine = resolutionListResponseSchema.parse(
      (await call(voters[0]!, 'GET', `/questions/${questionId}/resolutions`)).json(),
    );
    expect(mine.items[0]).toMatchObject({ score: 1, myVote: 1 });
    const [row] = await db
      .select()
      .from(schema.questionResolutions)
      .where(eq(schema.questionResolutions.id, resId));
    expect(row!.score).toBe(1);
  });

  it('ordena por pontuação', async () => {
    const other = await createAuthedUser(app);
    const res = await call(other, 'POST', `/questions/${questionId}/resolutions`, {
      body: `${GOOD} (outra)`,
    });
    const otherId = resolutionSchema.parse(res.json()).id;
    await call(admin, 'PATCH', `/review/resolutions/${otherId}`, { action: 'approve' });
    await call(voters[0]!, 'POST', `/resolutions/${otherId}/vote`, { value: -1 });
    const list = resolutionListResponseSchema.parse(
      (await call(null, 'GET', `/questions/${questionId}/resolutions`)).json(),
    );
    expect(list.items.map((i) => i.id)).toEqual([resId, otherId]);
    await deleteUser(other.id);
  });

  it('editar volta para análise; rejeitar guarda o motivo; excluir', async () => {
    expect(
      (await call(voters[0]!, 'PUT', `/resolutions/${resId}`, { body: GOOD })).statusCode,
    ).toBe(404);
    expect((await call(voters[0]!, 'DELETE', `/resolutions/${resId}`)).statusCode).toBe(404);
    const edited = await call(author, 'PUT', `/resolutions/${resId}`, { body: `${GOOD} editada` });
    expect(edited.statusCode).toBe(200);
    expect(resolutionSchema.parse(edited.json()).status).toBe('pending');
    const pub = resolutionListResponseSchema.parse(
      (await call(null, 'GET', `/questions/${questionId}/resolutions`)).json(),
    );
    expect(pub.items.find((i) => i.id === resId)).toBeUndefined();

    await call(admin, 'PATCH', `/review/resolutions/${resId}`, {
      action: 'reject',
      reason: 'Resposta incompleta',
    });
    const own = resolutionListResponseSchema.parse(
      (await call(author, 'GET', `/questions/${questionId}/resolutions`)).json(),
    );
    expect(own.mine).toMatchObject({ status: 'rejected', rejectReason: 'Resposta incompleta' });
    const summary = myResolutionsSchema.parse(
      (await call(author, 'GET', '/me/resolutions')).json(),
    );
    expect(summary).toMatchObject({ total: 1, rejected: 1, pending: 0, approved: 0 });

    expect((await call(author, 'DELETE', `/resolutions/${resId}`)).statusCode).toBe(200);
    const after = resolutionListResponseSchema.parse(
      (await call(author, 'GET', `/questions/${questionId}/resolutions`)).json(),
    );
    expect(after.mine).toBeNull();
  });

  it('revisor promove resolução aprovada a oficial', async () => {
    const res = await call(author, 'POST', `/questions/${questionId}/resolutions`, {
      body: `${GOOD} oficial`,
    });
    const id = resolutionSchema.parse(res.json()).id;
    await call(admin, 'PATCH', `/review/resolutions/${id}`, { action: 'approve' });
    expect(
      (await call(admin, 'PATCH', `/review/resolutions/${id}`, { action: 'promote' })).statusCode,
    ).toBe(200);
    const [q] = await db
      .select({ r: schema.questions.resolution })
      .from(schema.questions)
      .where(eq(schema.questions.id, questionId));
    expect(q!.r).toContain('oficial');
  });
});
