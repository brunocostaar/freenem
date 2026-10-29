import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import {
  catalogResponseSchema,
  questionListResponseSchema,
  questionSummarySchema,
  reviewListResponseSchema,
  reviewQuestionSchema,
  type QuestionSearch,
  type QuestionStatus,
} from '@freenem/shared';
import { api } from './api';

export const catalogQuery = queryOptions({
  queryKey: ['catalog'],
  queryFn: () => api('/api/v1/catalog', { schema: catalogResponseSchema }),
  staleTime: 10 * 60_000,
});

/** Converte os search params da URL (booleanos reais) na query string da API. */
export function toApiQuery(s: QuestionSearch) {
  return {
    institutionId: s.institutionId,
    year: s.year,
    subjectId: s.subjectId,
    topicId: s.topicId,
    q: s.q,
    difficulty: s.difficulty,
    onlyUnanswered: s.onlyUnanswered ? 'true' : undefined,
    onlyWrong: s.onlyWrong ? 'true' : undefined,
    onlySaved: s.onlySaved ? 'true' : undefined,
  };
}

export function questionsInfiniteQuery(search: QuestionSearch, userId: string | null) {
  return infiniteQueryOptions({
    // o usuário entra na chave: o estado "respondida/salva" é pessoal
    queryKey: ['questions', toApiQuery(search), userId],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      api('/api/v1/questions', {
        schema: questionListResponseSchema,
        query: { ...toApiQuery(search), limit: 20, cursor: pageParam },
        signal,
      }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export const questionQuery = (id: string, userId: string | null) =>
  queryOptions({
    queryKey: ['question', id, userId],
    queryFn: () => api(`/api/v1/questions/${id}`, { schema: questionSummarySchema }),
  });

export function reviewListInfiniteQuery(params: {
  status: QuestionStatus;
  subjectId?: string;
  q?: string;
}) {
  return infiniteQueryOptions({
    queryKey: ['review', 'list', params],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      api('/api/v1/review/questions', {
        schema: reviewListResponseSchema,
        query: { ...params, limit: 30, cursor: pageParam },
        signal,
      }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export const reviewQuestionQuery = (id: string) =>
  queryOptions({
    queryKey: ['review', 'question', id],
    queryFn: () => api(`/api/v1/review/questions/${id}`, { schema: reviewQuestionSchema }),
  });
