import { useCallback, useEffect, useRef, useState } from 'react';
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
  // tempo "ativo" por questão: só conta com a questão visível E a aba em primeiro plano
  const timers = useRef<Record<string, { acc: number; since: number | null }>>({});
  const inView = useRef(new Set<string>());

  const patch = useCallback((id: string, p: Partial<Entry>) => {
    setEntries((cur) => ({ ...cur, [id]: { ...(cur[id] ?? EMPTY), ...p } }));
  }, []);

  const select = useCallback(
    (id: string, letter: AlternativeLetter) => {
      setEntries((cur) => {
        const e = cur[id] ?? EMPTY;
        if (e.result) return cur; // já corrigida
        return { ...cur, [id]: { ...e, selected: letter } };
      });
    },
    [setEntries],
  );

  const elapsed = useCallback((id: string) => {
    const t = timers.current[id];
    if (!t) return 0;
    return t.acc + (t.since !== null ? Date.now() - t.since : 0);
  }, []);

  const startTimer = useCallback((id: string) => {
    const t = (timers.current[id] ??= { acc: 0, since: null });
    if (t.since === null && !document.hidden) t.since = Date.now();
  }, []);

  const stopTimer = useCallback((id: string) => {
    const t = timers.current[id];
    if (t && t.since !== null) {
      t.acc += Date.now() - t.since;
      t.since = null;
    }
  }, []);

  /** Chamado pelo `QuestionCard` quando a questão entra/sai da tela (para o tempo gasto). */
  const setVisible = useCallback(
    (id: string, visible: boolean) => {
      if (visible) {
        inView.current.add(id);
        startTimer(id);
      } else {
        inView.current.delete(id);
        stopTimer(id);
      }
    },
    [startTimer, stopTimer],
  );

  // aba oculta: pausa; volta: retoma as questões que seguem na tela
  useEffect(() => {
    function onVisibility() {
      for (const id of inView.current) {
        if (document.hidden) stopTimer(id);
        else startTimer(id);
      }
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [startTimer, stopTimer]);

  const submit = useCallback(
    async (id: string) => {
      const e = entries[id];
      if (!e?.selected || e.result || e.submitting) return;
      patch(id, { submitting: true });
      try {
        const timeSpentMs = Math.min(3_600_000, Math.max(0, Math.round(elapsed(id))));
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
        stopTimer(id);
        patch(id, { result, submitting: false });
        if (loggedIn) {
          void qc.invalidateQueries({ queryKey: ['stats'] });
          void qc.invalidateQueries({ queryKey: ['subject-progress'] });
        }
      } catch (err) {
        patch(id, { submitting: false });
        toast.error(err instanceof ApiError ? err.message : 'Não foi possível corrigir agora.');
      }
    },
    [elapsed, entries, loggedIn, patch, qc, stopTimer, toast],
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
      onVisibilityChange: (visible: boolean) => setVisible(q.id, visible),
      result: e.result,
      submitting: e.submitting,
      onSubmit: () => void submit(q.id),
      saved: saved[q.id] ?? q.saved,
      onToggleSave: () => void toggleSave(q),
    };
  };

  return { loggedIn, entries, select, submit, toggleSave, bind };
}
