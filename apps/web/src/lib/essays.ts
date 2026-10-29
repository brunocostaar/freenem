import { queryOptions } from '@tanstack/react-query';
import {
  ESSAY_CHARS_PER_LINE,
  essayListSchema,
  essayQuotaSchema,
  essayResultSchema,
  essayThemeListSchema,
} from '@freenem/shared';
import { api } from './api';

export const essayThemesQuery = queryOptions({
  queryKey: ['essays', 'themes'],
  queryFn: () => api('/api/v1/essays/themes', { schema: essayThemeListSchema }),
  staleTime: 10 * 60_000,
});

export const essayQuotaQuery = queryOptions({
  queryKey: ['essays', 'quota'],
  queryFn: () => api('/api/v1/essays/quota', { schema: essayQuotaSchema }),
});

export const essayListQuery = queryOptions({
  queryKey: ['essays', 'list'],
  queryFn: () => api('/api/v1/essays', { schema: essayListSchema }),
});

export const essayQuery = (id: string) =>
  queryOptions({
    queryKey: ['essays', 'detail', id],
    queryFn: () => api(`/api/v1/essays/${id}`, { schema: essayResultSchema }),
  });

export const createEssayDraft = (themeId: string, text: string) =>
  api('/api/v1/essays', { method: 'POST', body: { themeId, text }, schema: essayResultSchema });

export const saveEssayDraft = (id: string, text: string) =>
  api(`/api/v1/essays/${id}`, { method: 'PUT', body: { text }, schema: essayResultSchema });

export const correctEssay = (id: string) =>
  api(`/api/v1/essays/${id}/correct`, { method: 'POST', schema: essayResultSchema });

/** Estimativa de linhas da folha: cada linha de texto ocupa ceil(len / 90) linhas manuscritas. */
export function estimateLines(text: string): number {
  return text
    .split('\n')
    .filter((l) => l.trim() !== '')
    .reduce((n, l) => n + Math.max(1, Math.ceil(l.length / ESSAY_CHARS_PER_LINE)), 0);
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso));
}
