import { and, count, desc, eq, isNull, sql, sum, type SQL } from 'drizzle-orm';
import type {
  AiReview,
  AiReviewListQuery,
  AiReviewListResponse,
  AiReviewStatus,
  AiVerdict,
  AlternativeLetter,
} from '@freenem/shared';
import { db, schema } from '../../db/index.js';
import { env } from '../../env.js';
import { publicUrls } from '../../lib/storage.js';
import { getForReview } from '../review/service.js';
import { chat, type ContentPart } from './featherless.js';
import { evaluate, parseModelOutput } from './parse.js';
import { SYSTEM_PROMPT, buildQuestionText } from './prompt.js';

const { questions, exams, subjects, questionAiReviews: reviews, alternatives } = schema;

export const SUGGESTED_MODELS = [
  'Qwen/Qwen3-VL-32B-Instruct',
  'deepseek-ai/DeepSeek-V3.2',
  'google/gemma-3-27b-it',
];
const MAX_IMAGES = 6;
const IMAGE_TIMEOUT_MS = 20_000;

export const isVisionModel = (model: string) => /vl|vision/i.test(model);

/** Última revisão de cada questão (DISTINCT ON), reutilizável como subquery. */
function latestReviews() {
  return db
    .selectDistinctOn([reviews.questionId], {
      id: reviews.id,
      questionId: reviews.questionId,
      model: reviews.model,
      verdict: reviews.verdict,
      modelAnswer: reviews.modelAnswer,
      answerMatches: reviews.answerMatches,
      issues: reviews.issues,
      summary: reviews.summary,
      costUsd: reviews.costUsd,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .orderBy(reviews.questionId, desc(reviews.createdAt))
    .as('latest');
}

type ReviewRow = typeof reviews.$inferSelect;
function toReview(r: ReviewRow): AiReview {
  return {
    id: r.id,
    questionId: r.questionId,
    model: r.model,
    verdict: r.verdict as AiVerdict,
    modelAnswer: (r.modelAnswer as AlternativeLetter | null) ?? null,
    answerMatches: r.answerMatches,
    issues: r.issues,
    summary: r.summary,
    costUsd: r.costUsd,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function getStatus(): Promise<AiReviewStatus> {
  const latest = latestReviews();
  const [byVerdict, mismatch, cost] = await Promise.all([
    db.select({ verdict: latest.verdict, n: count() }).from(latest).groupBy(latest.verdict),
    db.select({ n: count() }).from(latest).where(eq(latest.answerMatches, false)),
    db.select({ total: sum(reviews.costUsd) }).from(reviews),
  ]);
  const n = (v: string) => byVerdict.find((r) => r.verdict === v)?.n ?? 0;
  return {
    enabled: Boolean(env.FEATHERLESS_API_KEY),
    defaultModel: env.FEATHERLESS_MODEL,
    models: [...new Set([env.FEATHERLESS_MODEL, ...SUGGESTED_MODELS])],
    counts: {
      ok: n('ok'),
      problem: n('problem'),
      unsure: n('unsure'),
      mismatch: mismatch[0]?.n ?? 0,
    },
    totalCostUsd: Number(cost[0]?.total ?? 0),
  };
}

export async function listQuestions(f: AiReviewListQuery): Promise<AiReviewListResponse> {
  const latest = latestReviews();
  const conds: (SQL | undefined)[] = [eq(questions.status, f.status)];
  if (f.filter === 'pending') conds.push(isNull(latest.id));
  else if (f.filter === 'mismatch') conds.push(eq(latest.answerMatches, false));
  else conds.push(eq(latest.verdict, f.filter));
  const where = and(...conds);

  const [rows, total] = await Promise.all([
    db
      .select({
        id: questions.id,
        number: questions.number,
        statement: questions.statement,
        year: exams.year,
        examLabel: exams.label,
        subject: subjects.name,
        correct: sql<
          string | null
        >`(select letter::text from ${alternatives} where ${alternatives.questionId} = ${questions.id} and ${alternatives.isCorrect} limit 1)`,
        rId: latest.id,
        rModel: latest.model,
        rVerdict: latest.verdict,
        rAnswer: latest.modelAnswer,
        rMatches: latest.answerMatches,
        rIssues: latest.issues,
        rSummary: latest.summary,
        rCost: latest.costUsd,
        rCreated: latest.createdAt,
      })
      .from(questions)
      .leftJoin(latest, eq(latest.questionId, questions.id))
      .leftJoin(exams, eq(exams.id, questions.examId))
      .leftJoin(subjects, eq(subjects.id, questions.subjectId))
      .where(where)
      .orderBy(desc(exams.year), questions.number, questions.id)
      .limit(f.limit)
      .offset(f.offset),
    db
      .select({ n: count() })
      .from(questions)
      .leftJoin(latest, eq(latest.questionId, questions.id))
      .where(where),
  ]);
  return {
    items: rows.map((r) => ({
      questionId: r.id,
      number: r.number,
      year: r.year,
      examLabel: r.examLabel,
      subject: r.subject,
      statementExcerpt: r.statement.replace(/\s+/g, ' ').slice(0, 160),
      correctLetter: (r.correct as AlternativeLetter | null) ?? null,
      review:
        r.rId && r.rCreated
          ? toReview({
              id: r.rId,
              questionId: r.id,
              model: r.rModel ?? '',
              verdict: r.rVerdict ?? 'unsure',
              modelAnswer: r.rAnswer,
              answerMatches: r.rMatches,
              issues: r.rIssues ?? [],
              summary: r.rSummary ?? '',
              costUsd: r.rCost,
              createdAt: r.rCreated,
            })
          : null,
    })),
    total: total[0]?.n ?? 0,
  };
}

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS) });
    if (!res.ok) return null;
    const type = res.headers.get('content-type')?.split(';')[0] || 'image/png';
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:${type};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

export type RunResult =
  | { ok: true; review: AiReview }
  | { ok: false; code: 'NOT_FOUND' | 'DISABLED' | 'UPSTREAM'; message: string };

export async function runReview(questionId: string, modelId?: string): Promise<RunResult> {
  if (!env.FEATHERLESS_API_KEY) {
    return { ok: false, code: 'DISABLED', message: 'FEATHERLESS_API_KEY não configurada.' };
  }
  const model = modelId ?? env.FEATHERLESS_MODEL;
  const q = await getForReview(questionId);
  if (!q) return { ok: false, code: 'NOT_FOUND', message: 'Questão não encontrada.' };
  const [extra] = await db
    .select({ imageUrls: questions.imageUrls })
    .from(questions)
    .where(eq(questions.id, questionId));

  // coleta de imagens (enunciado, coluna image_urls, alternativas), sem repetir
  const found: string[] = [];
  const add = (u: string | null | undefined) => {
    if (u && !found.includes(u)) found.push(u);
  };
  for (const m of q.statement.matchAll(/!\[[^\]]*\]\(([^)\s]+)[^)]*\)/g)) add(m[1]);
  for (const u of extra?.imageUrls ?? []) add(u);
  for (const a of q.alternatives) add(a.imageUrl);

  const vision = isVisionModel(model);
  const sent = new Map<string, number>();
  const parts: ContentPart[] = [];
  if (vision) {
    for (const u of found.slice(0, MAX_IMAGES)) {
      const dataUrl = await toDataUrl(publicUrls(u));
      if (!dataUrl) continue;
      sent.set(u, sent.size + 1);
      parts.push({ type: 'image_url', image_url: { url: dataUrl } });
    }
  }
  const text = buildQuestionText(q, (u) => sent.get(u) ?? null, !vision && found.length > 0);
  const content: ContentPart[] = [{ type: 'text', text }, ...parts];
  const correct = q.alternatives.find((a) => a.isCorrect)?.letter ?? null;

  let cost = 0;
  let hasCost = false;
  let output = null as ReturnType<typeof parseModelOutput>;
  try {
    for (let attempt = 0; attempt < 2 && !output; attempt++) {
      const r = await chat(model, SYSTEM_PROMPT, content);
      if (r.costUsd !== null) {
        cost += r.costUsd;
        hasCost = true;
      }
      output = parseModelOutput(r.content);
    }
  } catch {
    return { ok: false, code: 'UPSTREAM', message: 'Falha ao consultar o modelo de IA.' };
  }

  const values = output
    ? {
        ...evaluate(output, correct),
        modelAnswer: output.answer,
        issues: output.issues.map((i) => i.trim()).filter(Boolean),
        summary: output.summary,
      }
    : {
        verdict: 'unsure' as const,
        answerMatches: null,
        modelAnswer: null,
        issues: ['resposta inválida do modelo'],
        summary: '',
      };
  const [row] = await db
    .insert(reviews)
    .values({ questionId, model, costUsd: hasCost ? cost : null, ...values })
    .returning();
  return { ok: true, review: toReview(row!) };
}
