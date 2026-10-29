import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  answerResponseSchema,
  savedResponseSchema,
  type AlternativeLetter,
  type AnswerResponse,
  type QuestionSummary,
} from '@freenem/shared';
import { useToast } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/auth-client';

interface Entry {
  selected: AlternativeLetter | null;
  result: AnswerResponse | null;
  submitting: boolean;
}

const EMPTY: Entry = { selected: null, result: null, submitting: false };

/**
 * Estado de resolução de várias questões (seleção, correção, favoritos), compartilhado entre
 * a lista, o modo foco e a página da questão. Logado: `POST /answers` (registra);
 * anônimo: `POST /questions/:id/check` (só confere).
 */
export function usePractice() {
  const { data: session } = useSession();
  const loggedIn = Boolean(session);
  const toast = useToast();
  const qc = useQueryClient();
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const shownAt = useRef<Record<string, number>>({});

  const patch = useCallback((id: string, p: Partial<Entry>) => {
    setEntries((cur) => ({ ...cur, [id]: { ...(cur[id] ?? EMPTY), ...p } }));
  }, []);

  const select = useCallback(
    (id: string, letter: AlternativeLetter) => {
      shownAt.current[id] ??= Date.now();
      setEntries((cur) => {
        const e = cur[id] ?? EMPTY;
        if (e.result) return cur; // já corrigida
        return { ...cur, [id]: { ...e, selected: letter } };
      });
    },
    [setEntries],
  );

  /** Marca o instante em que a questão apareceu (para o tempo gasto). */
  const markShown = useCallback((id: string) => {
    shownAt.current[id] ??= Date.now();
  }, []);

  const submit = useCallback(
    async (id: string) => {
      const e = entries[id];
      if (!e?.selected || e.result || e.submitting) return;
      patch(id, { submitting: true });
      try {
        const timeSpentMs = Math.min(
          3_600_000,
          Math.max(0, Date.now() - (shownAt.current[id] ?? Date.now())),
        );
        const result = loggedIn
          ? await api('/api/v1/answers', {
              method: 'POST',
              body: { questionId: id, letter: e.selected, timeSpentMs },
              schema: answerResponseSchema,
            })
          : await api(`/api/v1/questions/${id}/check`, {
              method: 'POST',
              body: { letter: e.selected },
              schema: answerResponseSchema,
            });
        patch(id, { result, submitting: false });
        if (loggedIn) void qc.invalidateQueries({ queryKey: ['stats'] });
      } catch (err) {
        patch(id, { submitting: false });
        toast.error(err instanceof ApiError ? err.message : 'Não foi possível corrigir agora.');
      }
    },
    [entries, loggedIn, patch, qc, toast],
  );

  const toggleSave = useCallback(
    async (q: QuestionSummary) => {
      if (!loggedIn) {
        toast.show('Entre na sua conta para salvar questões.');
        return;
      }
      const current = saved[q.id] ?? q.saved;
      setSaved((cur) => ({ ...cur, [q.id]: !current })); // otimista
      try {
        await api(`/api/v1/questions/${q.id}/save`, {
          method: current ? 'DELETE' : 'PUT',
          schema: savedResponseSchema,
        });
        void qc.invalidateQueries({ queryKey: ['questions'] });
      } catch (err) {
        setSaved((cur) => ({ ...cur, [q.id]: current }));
        toast.error(err instanceof ApiError ? err.message : 'Não foi possível salvar.');
      }
    },
    [loggedIn, qc, saved, toast],
  );

  /** Props prontas para o `QuestionCard`. */
  const bind = (q: QuestionSummary) => {
    const e = entries[q.id] ?? EMPTY;
    return {
      question: q,
      selected: e.selected,
      onSelect: (letter: AlternativeLetter) => select(q.id, letter),
      result: e.result,
      submitting: e.submitting,
      onSubmit: () => void submit(q.id),
      saved: saved[q.id] ?? q.saved,
      onToggleSave: () => void toggleSave(q),
    };
  };

  return { loggedIn, entries, select, submit, markShown, toggleSave, bind };
}
