import { and, desc, eq, isNull, lt, sql } from 'drizzle-orm';
import {
  essayCorrectionSchema,
  type EssayListItem,
  type EssayQuota,
  type EssayResult,
  type EssayTheme,
} from '@freenem/shared';
import { db, schema } from '../../db/index.js';
import { AppError } from '../../lib/app-error.js';
import { getCorrector } from './active.js';
import { CorrectionInvalidOutputError, runCorrectionPipeline } from './pipeline.js';
import { SanitizeError, sanitizeEssayText } from './sanitize.js';

export const MAX_FAILED_ATTEMPTS_PER_DAY = 3;
/** Correção "pending" mais antiga que isso é considerada abandonada (processo caiu). */
const STALE_PENDING_MS = 3 * 60_000;

// ---- datas (America/Sao_Paulo; o Brasil não tem horário de verão desde 2019: UTC-3 fixo) ----

const spFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
export function saoPauloDate(d = new Date()): string {
  return spFormatter.format(d); // YYYY-MM-DD
}
/** Próxima meia-noite em São Paulo, como ISO 8601. */
export function nextMidnightSaoPaulo(d = new Date()): string {
  const [y, m, day] = saoPauloDate(d).split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, day + 1, 3, 0, 0)).toISOString();
}

// ---- tentativas falhas (em memória; reinicia com o processo) ----

const failedAttempts = new Map<string, number>();
function failKey(userId: string) {
  return `${userId}:${saoPauloDate()}`;
}
function failedToday(userId: string): number {
  const today = saoPauloDate();
  for (const k of failedAttempts.keys()) if (!k.endsWith(`:${today}`)) failedAttempts.delete(k);
  return failedAttempts.get(failKey(userId)) ?? 0;
}
function registerFailure(userId: string) {
  failedAttempts.set(failKey(userId), failedToday(userId) + 1);
}
export function resetFailuresForTests() {
  failedAttempts.clear();
}

// ---- consultas ----

export async function listThemes(): Promise<EssayTheme[]> {
  const rows = await db
    .select()
    .from(schema.essayThemes)
    .orderBy(desc(schema.essayThemes.year), schema.essayThemes.title);
  return rows.map((t) => ({
    id: t.id,
    title: t.title,
    year: t.year,
    description: t.description,
    supportingTexts: t.supportingTexts,
  }));
}

async function loadEssay(userId: string, id: string) {
  const [row] = await db
    .select({
      essay: schema.essays,
      theme: schema.essayThemes,
      correction: schema.essayCorrections,
    })
    .from(schema.essays)
    .innerJoin(schema.essayThemes, eq(schema.essayThemes.id, schema.essays.themeId))
    .leftJoin(schema.essayCorrections, eq(schema.essayCorrections.essayId, schema.essays.id))
    .where(and(eq(schema.essays.id, id), eq(schema.essays.userId, userId)))
    .limit(1);
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Redação não encontrada.');
  return row;
}

function toResult(row: Awaited<ReturnType<typeof loadEssay>>): EssayResult {
  const c = row.correction;
  const parsed = c?.feedback ? essayCorrectionSchema.safeParse(c.feedback) : null;
  return {
    id: row.essay.id,
    themeId: row.theme.id,
    themeTitle: row.theme.title,
    themeSupportingTexts: row.theme.supportingTexts,
    text: row.essay.text,
    status: row.essay.status,
    isDraft: c === null,
    totalScore: c?.totalScore ?? null,
    correction: parsed?.success ? parsed.data : null,
    model: c?.model ?? null,
    createdAt: row.essay.createdAt.toISOString(),
  };
}

export async function getEssay(userId: string, id: string): Promise<EssayResult> {
  return toResult(await loadEssay(userId, id));
}

export async function listEssays(userId: string): Promise<EssayListItem[]> {
  const rows = await db
    .select({
      id: schema.essays.id,
      themeId: schema.essays.themeId,
      themeTitle: schema.essayThemes.title,
      status: schema.essays.status,
      totalScore: schema.essayCorrections.totalScore,
      correctionId: schema.essayCorrections.id,
      charCount: sql<number>`length(${schema.essays.text})`,
      createdAt: schema.essays.createdAt,
    })
    .from(schema.essays)
    .innerJoin(schema.essayThemes, eq(schema.essayThemes.id, schema.essays.themeId))
    .leftJoin(schema.essayCorrections, eq(schema.essayCorrections.essayId, schema.essays.id))
    .where(eq(schema.essays.userId, userId))
    .orderBy(desc(schema.essays.createdAt))
    .limit(100);
  return rows.map((r) => ({
    id: r.id,
    themeId: r.themeId,
    themeTitle: r.themeTitle,
    status: r.status,
    isDraft: r.correctionId === null,
    totalScore: r.totalScore,
    charCount: Number(r.charCount),
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function createDraft(
  userId: string,
  input: { themeId: string; text: string },
): Promise<EssayResult> {
  const [theme] = await db
    .select({ id: schema.essayThemes.id })
    .from(schema.essayThemes)
    .where(eq(schema.essayThemes.id, input.themeId))
    .limit(1);
  if (!theme) throw new AppError(404, 'THEME_NOT_FOUND', 'Tema não encontrado.');
  const [row] = await db
    .insert(schema.essays)
    .values({ userId, themeId: input.themeId, text: input.text })
    .returning({ id: schema.essays.id });
  return getEssay(userId, row!.id);
}

export async function updateDraft(userId: string, id: string, text: string): Promise<EssayResult> {
  const current = await loadEssay(userId, id);
  if (current.correction) {
    throw new AppError(409, 'LOCKED', 'Esta redação já foi enviada para correção.');
  }
  // NOT EXISTS na mesma instrução: fecha a janela de corrida com POST /correct.
  const updated = await db
    .update(schema.essays)
    .set({ text })
    .where(
      and(
        eq(schema.essays.id, id),
        eq(schema.essays.userId, userId),
        sql`not exists (select 1 from ${schema.essayCorrections} where ${schema.essayCorrections.essayId} = ${schema.essays.id})`,
      ),
    )
    .returning({ id: schema.essays.id });
  if (updated.length === 0) {
    throw new AppError(409, 'LOCKED', 'Esta redação já foi enviada para correção.');
  }
  return getEssay(userId, id);
}

/** Admins corrigem sem limite diário (para testar a correção). */
export interface EssayUser {
  id: string;
  role: string;
}
const isUnlimited = (u: EssayUser) => u.role === 'admin';

export async function getQuota(user: EssayUser): Promise<EssayQuota> {
  const aiEnabled = !getCorrector().isDemo;
  if (isUnlimited(user)) return { availableToday: true, nextAvailableAt: null, aiEnabled };
  const userId = user.id;
  const date = saoPauloDate();
  const [used] = await db
    .select({ id: schema.essayCorrections.id })
    .from(schema.essayCorrections)
    .where(
      and(
        eq(schema.essayCorrections.userId, userId),
        eq(schema.essayCorrections.correctionDate, date),
      ),
    )
    .limit(1);
  return {
    availableToday: !used,
    nextAvailableAt: used ? nextMidnightSaoPaulo() : null,
    aiEnabled,
  };
}

// ---- correção ----

/**
 * 1 correção/dia/usuário. O slot é reservado ANTES de chamar o modelo, inserindo a linha em
 * essay_corrections: o índice único (user_id, correction_date) garante exclusão mútua mesmo
 * com requisições concorrentes (o perdedor recebe 429). Se a chamada falhar, a linha é
 * apagada (o aluno não perde o slot), com no máximo 3 falhas por dia. Admins não têm limite
 * (correction_date null não conflita no índice).
 */
export async function correctEssay(user: EssayUser, id: string): Promise<EssayResult> {
  const userId = user.id;
  const unlimited = isUnlimited(user);
  const row = await loadEssay(userId, id);
  if (row.correction) {
    throw new AppError(
      409,
      row.correction.totalScore === null ? 'IN_PROGRESS' : 'ALREADY_CORRECTED',
      row.correction.totalScore === null
        ? 'A correção desta redação está em andamento.'
        : 'Esta redação já foi corrigida.',
    );
  }

  // Texto inválido (curto/longo/linhas) não consome o slot.
  try {
    sanitizeEssayText(row.essay.text);
  } catch (e) {
    if (e instanceof SanitizeError) throw new AppError(422, e.code, e.message);
    throw e;
  }

  if (!unlimited && failedToday(userId) >= MAX_FAILED_ATTEMPTS_PER_DAY) {
    throw new AppError(
      429,
      'TOO_MANY_FAILURES',
      'A correção falhou várias vezes hoje. Tente novamente amanhã.',
      { nextAvailableAt: nextMidnightSaoPaulo() },
    );
  }

  const date = saoPauloDate();
  // Reservas abandonadas (processo caiu no meio) não prendem o slot para sempre.
  await db
    .delete(schema.essayCorrections)
    .where(
      and(
        eq(schema.essayCorrections.userId, userId),
        isNull(schema.essayCorrections.totalScore),
        lt(schema.essayCorrections.createdAt, new Date(Date.now() - STALE_PENDING_MS)),
      ),
    );

  const [claim] = await db
    .insert(schema.essayCorrections)
    .values({ essayId: id, userId, correctionDate: unlimited ? null : date })
    .onConflictDoNothing()
    .returning({ id: schema.essayCorrections.id });
  if (!claim) {
    throw new AppError(429, 'DAILY_LIMIT', 'Você já usou sua correção de hoje. Volte amanhã!', {
      nextAvailableAt: nextMidnightSaoPaulo(),
    });
  }

  try {
    const result = await runCorrectionPipeline(getCorrector(), {
      theme: row.theme.title,
      text: row.essay.text,
    });
    const { correction } = result;
    await db.transaction(async (tx) => {
      await tx
        .update(schema.essayCorrections)
        .set({
          c1: correction.c1.score,
          c2: correction.c2.score,
          c3: correction.c3.score,
          c4: correction.c4.score,
          c5: correction.c5.score,
          totalScore: result.totalScore,
          feedback: correction,
          injectionSuspected: correction.injectionSuspected,
          model: result.model,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
        })
        .where(eq(schema.essayCorrections.id, claim.id));
      await tx.update(schema.essays).set({ status: result.status }).where(eq(schema.essays.id, id));
    });
  } catch (e) {
    // Libera o slot: o aluno não é cobrado por falha nossa.
    await db.delete(schema.essayCorrections).where(eq(schema.essayCorrections.id, claim.id));
    if (e instanceof SanitizeError) throw new AppError(422, e.code, e.message);
    registerFailure(userId);
    const detail =
      e instanceof CorrectionInvalidOutputError ? 'resposta inválida' : 'erro no serviço';
    throw new AppError(
      502,
      'CORRECTION_FAILED',
      `Não foi possível corrigir agora (${detail}). Seu limite diário não foi consumido; tente novamente em instantes.`,
    );
  }
  return getEssay(userId, id);
}
