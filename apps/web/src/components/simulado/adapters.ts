import type {
  AlternativeLetter,
  AnswerResponse,
  AttemptQuestion,
  QuestionSummary,
} from '@freenem/shared';

/** Adapta a questão do simulado ao formato do `QuestionCard` (sem metadados do banco). */
export function toQuestionSummary(
  q: Pick<
    AttemptQuestion,
    'id' | 'number' | 'statement' | 'imageUrls' | 'subject' | 'alternatives'
  >,
): QuestionSummary {
  return {
    id: q.id,
    number: q.number,
    institution: '',
    year: 0,
    subject: q.subject ?? '',
    topics: [],
    statement: q.statement,
    imageUrls: q.imageUrls,
    alternatives: q.alternatives,
    difficulty: null,
    source: null,
    status: 'published',
    answered: false,
    wasCorrect: null,
    saved: false,
  };
}

/** Resultado para o `QuestionCard` exibir a revisão de uma questão de simulado já finalizado. */
export function toReviewResult(
  chosen: AlternativeLetter | null,
  correctLetter: AlternativeLetter | null,
  resolution: string | null,
): AnswerResponse | null {
  if (!correctLetter) return null;
  return {
    correct: chosen === correctLetter,
    correctLetter,
    resolution,
    stats: [],
    totalAnswers: 0,
  };
}
