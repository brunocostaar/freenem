import { queryOptions } from '@tanstack/react-query';
import {
  attemptResultSchema,
  attemptSessionSchema,
  simuladoListSchema,
  simuladoOptionsSchema,
} from '@freenem/shared';
import { api } from './api';

export const simuladosQuery = queryOptions({
  queryKey: ['simulados'],
  queryFn: () => api('/api/v1/simulados', { schema: simuladoListSchema }),
});

export const simuladoOptionsQuery = queryOptions({
  queryKey: ['simulados', 'options'],
  queryFn: () => api('/api/v1/simulados/options', { schema: simuladoOptionsSchema }),
  staleTime: 5 * 60_000,
});

export const attemptSessionQuery = (id: string) =>
  queryOptions({
    queryKey: ['attempts', id, 'session'],
    queryFn: () => api(`/api/v1/attempts/${id}`, { schema: attemptSessionSchema }),
    staleTime: Infinity,
    gcTime: 0,
  });

export const attemptResultQuery = (id: string) =>
  queryOptions({
    queryKey: ['attempts', id, 'result'],
    queryFn: () => api(`/api/v1/attempts/${id}/result`, { schema: attemptResultSchema }),
    staleTime: 60_000,
  });

/** 3725000 -> "1:02:05"; 65000 -> "1:05" */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** "2 h 15 min", "45 min", "sem limite" */
export function formatMinutes(min: number | null): string {
  if (min === null) return 'sem limite';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  return `${m} min ${String(s % 60).padStart(2, '0')} s`;
}

export const AREA_SHORT: Record<string, string> = {
  linguagens: 'Linguagens',
  humanas: 'Ciências Humanas',
  natureza: 'Ciências da Natureza',
  matematica: 'Matemática',
};
