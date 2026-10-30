import { queryOptions } from '@tanstack/react-query';
import {
  statsOverviewSchema,
  statsTopicsResponseSchema,
  studyPlanResponseSchema,
  type StatsRange,
} from '@freenem/shared';
import { api } from './api';

export const overviewQuery = (range: StatsRange) =>
  queryOptions({
    queryKey: ['stats', 'overview', range],
    queryFn: () => api('/api/v1/stats/overview', { query: { range }, schema: statsOverviewSchema }),
    staleTime: 30_000,
  });

export const subjectTopicsQuery = (subjectId: string) =>
  queryOptions({
    queryKey: ['stats', 'topics', subjectId],
    queryFn: () =>
      api('/api/v1/stats/topics', {
        query: { subjectId, range: 'all' },
        schema: statsTopicsResponseSchema,
      }),
    staleTime: 30_000,
  });

export const studyPlanQuery = queryOptions({
  queryKey: ['study-plan'],
  queryFn: () => api('/api/v1/study-plan', { schema: studyPlanResponseSchema }),
  staleTime: 30_000,
});

/** Primeiro domingo de novembro (data do ENEM) do ano corrente ou do próximo, se já passou. */
export function nextEnemDate(from: Date = new Date()): string {
  const firstSunday = (year: number) => {
    const d = new Date(Date.UTC(year, 10, 1));
    d.setUTCDate(1 + ((7 - d.getUTCDay()) % 7));
    return d;
  };
  const today = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  let d = firstSunday(from.getFullYear());
  if (d.getTime() <= today) d = firstSunday(from.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

export function formatDuration(ms: number): string {
  // menos de 1 min: mostra segundos (senão "0 min" esconde o tempo registrado)
  if (ms > 0 && ms < 60_000) return `${Math.max(1, Math.round(ms / 1000))} s`;
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function formatMinutes(minutes: number): string {
  return formatDuration(minutes * 60_000);
}

export const formatPercent = (ratio: number) => `${Math.round(ratio * 100)}%`;

/** YYYY-MM-DD -> "12 de mar." */
export function formatDay(date: string, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'short',
    ...opts,
  });
}

export const AREA_SHORT = {
  linguagens: 'Linguagens',
  humanas: 'Humanas',
  natureza: 'Natureza',
  matematica: 'Matemática',
} as const;
