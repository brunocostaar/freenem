import { and, eq, sql } from 'drizzle-orm';
import type { AlternativeLetter, AnswerResponse } from '@freenem/shared';
import { db, schema } from '../../db/index.js';
import { publicUrls } from '../../lib/storage.js';

const LETTERS: AlternativeLetter[] = ['A', 'B', 'C', 'D', 'E'];

export interface QuestionKey {
  status: 'draft' | 'reviewed' | 'published';
  correctLetter: AlternativeLetter;
  resolution: string | null;
}

/** Gabarito e resolução. Só deve sair após o usuário responder (ou para revisores). */
export async function getQuestionKey(questionId: string): Promise<QuestionKey | null> {
  const [q] = await db
    .select({ status: schema.questions.status, resolution: schema.questions.resolution })
    .from(schema.questions)
    .where(eq(schema.questions.id, questionId))
    .limit(1);
  if (!q) return null;
  const [correct] = await db
    .select({ letter: schema.alternatives.letter })
    .from(schema.alternatives)
    .where(
      and(eq(schema.alternatives.questionId, questionId), eq(schema.alternatives.isCorrect, true)),
    )
    .limit(1);
  if (!correct) return null;
  return { status: q.status, correctLetter: correct.letter, resolution: q.resolution };
}

/** Distribuição de respostas (% por alternativa) de todos os usuários. */
export async function letterStats(questionId: string) {
  const rows = await db
    .select({ letter: schema.answers.chosenLetter, n: sql<number>`count(*)::int` })
    .from(schema.answers)
    .where(eq(schema.answers.questionId, questionId))
    .groupBy(schema.answers.chosenLetter);
  const counts = new Map<AlternativeLetter, number>();
  for (const r of rows) if (r.letter) counts.set(r.letter, r.n);
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  return {
    totalAnswers: total,
    stats: LETTERS.map((letter) => {
      const c = counts.get(letter) ?? 0;
      return { letter, count: c, percent: total === 0 ? 0 : Math.round((c / total) * 100) };
    }),
  };
}

export async function buildAnswerResponse(
  key: QuestionKey,
  questionId: string,
  letter: AlternativeLetter,
): Promise<AnswerResponse> {
  return {
    correct: letter === key.correctLetter,
    correctLetter: key.correctLetter,
    resolution: key.resolution ? publicUrls(key.resolution) : null,
    ...(await letterStats(questionId)),
  };
}

export async function recordAnswer(
  userId: string,
  questionId: string,
  letter: AlternativeLetter,
  isCorrect: boolean,
  extra: { timeSpentMs?: number; simuladoAttemptId?: string },
) {
  await db.insert(schema.answers).values({
    userId,
    questionId,
    chosenLetter: letter,
    isCorrect,
    timeSpentMs: extra.timeSpentMs ?? null,
    simuladoAttemptId: extra.simuladoAttemptId ?? null,
  });
}
