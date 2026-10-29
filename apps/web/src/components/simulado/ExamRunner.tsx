import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { attemptResultSchema, type AlternativeLetter, type AttemptSession } from '@freenem/shared';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  Grid3x3,
  Loader2,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatClock } from '@/lib/simulados';
import { Badge, Button, Dialog, useToast } from '@/components/ui';
import { QuestionNavigator } from './QuestionNavigator';
import { QuestionView } from './QuestionView';

const AUTOSAVE_DEBOUNCE_MS = 1200;
const AUTOSAVE_INTERVAL_MS = 15_000;
const LETTERS: AlternativeLetter[] = ['A', 'B', 'C', 'D', 'E'];

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function flagKey(attemptId: string) {
  return `freenem:attempt:${attemptId}:flagged`;
}
function loadFlags(attemptId: string): Set<string> {
  try {
    const raw = localStorage.getItem(flagKey(attemptId));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}
function storeFlags(attemptId: string, flags: Set<string>) {
  try {
    localStorage.setItem(flagKey(attemptId), JSON.stringify([...flags]));
  } catch {
    /* armazenamento indisponível: segue sem persistir */
  }
}

function useRemaining(deadline: number | null): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (deadline === null) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [deadline]);
  return deadline === null ? null : Math.max(0, deadline - now);
}

export function ExamRunner({ session }: { session: AttemptSession }) {
  const attemptId = session.attempt.id;
  const { questions } = session;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();

  const [letters, setLetters] = useState<Record<string, AlternativeLetter | null>>(() =>
    Object.fromEntries(session.answers.map((a) => [a.questionId, a.letter])),
  );
  const lettersRef = useRef(letters);
  const timeRef = useRef<Record<string, number>>(
    Object.fromEntries(session.answers.map((a) => [a.questionId, a.timeSpentMs])),
  );
  const dirty = useRef(new Set<string>());
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const activeSince = useRef<number | null>(Date.now());
  const [flagged, setFlagged] = useState(() => loadFlags(attemptId));
  const [navOpen, setNavOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const finishingRef = useRef(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const chain = useRef<Promise<void>>(Promise.resolve());
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [deadline] = useState(() =>
    session.remainingMs === null ? null : Date.now() + session.remainingMs,
  );
  const remaining = useRemaining(deadline);

  const goToResult = useCallback(() => {
    void navigate({
      to: '/simulados/$attemptId/resultado',
      params: { attemptId },
      replace: true,
    });
  }, [navigate, attemptId]);

  /** Soma o tempo decorrido à questão atual. */
  const commitTime = useCallback(() => {
    const qid = questions[indexRef.current]?.id;
    if (activeSince.current !== null && qid) {
      const delta = Date.now() - activeSince.current;
      timeRef.current[qid] = (timeRef.current[qid] ?? 0) + delta;
      dirty.current.add(qid);
    }
    activeSince.current = document.hidden ? null : Date.now();
  }, [questions]);

  /** Envia o que está pendente (serializado para não embaralhar versões). */
  const flush = useCallback((): Promise<void> => {
    commitTime();
    const run = async () => {
      const ids = [...dirty.current];
      if (ids.length === 0) return;
      dirty.current.clear();
      setSaveState('saving');
      try {
        await api(`/api/v1/attempts/${attemptId}/answers`, {
          method: 'PUT',
          body: {
            answers: ids.map((id) => ({
              questionId: id,
              letter: lettersRef.current[id] ?? null,
              timeSpentMs: Math.round(timeRef.current[id] ?? 0),
            })),
          },
        });
        setSaveState('saved');
      } catch (e) {
        for (const id of ids) dirty.current.add(id);
        setSaveState('error');
        if (e instanceof ApiError && e.status === 409) goToResult();
        throw e;
      }
    };
    const next = chain.current.then(run, run);
    chain.current = next.catch(() => undefined);
    return next;
  }, [attemptId, commitTime, goToResult]);

  const scheduleSave = useCallback(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      flush().catch(() => undefined);
    }, AUTOSAVE_DEBOUNCE_MS);
  }, [flush]);

  const select = useCallback(
    (letter: AlternativeLetter) => {
      const qid = questions[indexRef.current]?.id;
      if (!qid || finishingRef.current) return;
      lettersRef.current = { ...lettersRef.current, [qid]: letter };
      setLetters(lettersRef.current);
      dirty.current.add(qid);
      scheduleSave();
    },
    [questions, scheduleSave],
  );

  const go = useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(next, 0), questions.length - 1);
      if (clamped === indexRef.current) return;
      commitTime();
      indexRef.current = clamped;
      setIndex(clamped);
      scheduleSave();
    },
    [commitTime, questions.length, scheduleSave],
  );

  const toggleFlag = useCallback(() => {
    const qid = questions[indexRef.current]?.id;
    if (!qid) return;
    setFlagged((cur) => {
      const next = new Set(cur);
      if (next.has(qid)) next.delete(qid);
      else next.add(qid);
      storeFlags(attemptId, next);
      return next;
    });
  }, [attemptId, questions]);

  const finish = useCallback(
    async (force = false) => {
      if (finishingRef.current) return;
      finishingRef.current = true;
      setFinishing(true);
      if (debounce.current) clearTimeout(debounce.current);
      try {
        try {
          await flush();
        } catch (e) {
          // 409 = já finalizada: segue para o resultado; outro erro só interrompe se não for fim de tempo
          if (!force && !(e instanceof ApiError && e.status === 409)) throw e;
        }
        const result = await api(`/api/v1/attempts/${attemptId}/finish`, {
          method: 'POST',
          body: {},
          schema: attemptResultSchema,
        });
        qc.setQueryData(['attempts', attemptId, 'result'], result);
        qc.removeQueries({ queryKey: ['attempts', attemptId, 'session'] });
        void qc.invalidateQueries({ queryKey: ['simulados'] });
        goToResult();
      } catch {
        finishingRef.current = false;
        setFinishing(false);
        toast.error('Não foi possível finalizar. Verifique sua conexão e tente de novo.');
      }
    },
    [attemptId, flush, goToResult, qc, toast],
  );

  // Fim do tempo: finaliza sozinho.
  useEffect(() => {
    if (remaining === 0) void finish(true);
  }, [remaining, finish]);

  // Autosave periódico (também registra o tempo gasto) e ao ocultar a aba.
  useEffect(() => {
    const t = setInterval(() => {
      flush().catch(() => undefined);
    }, AUTOSAVE_INTERVAL_MS);
    const onVisibility = () => {
      if (document.hidden) {
        flush().catch(() => undefined);
        activeSince.current = null;
      } else if (activeSince.current === null) {
        activeSince.current = Date.now();
      }
    };
    const onPageHide = () => {
      flush().catch(() => undefined);
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [flush]);

  // Teclado: A–E, setas, R.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (confirmOpen || navOpen || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable)) {
        // rádios sr-only recebem foco ao clicar: deixa passar as teclas de atalho
        if (!(el instanceof HTMLInputElement && el.type === 'radio')) return;
      }
      const key = e.key.toUpperCase();
      if ((LETTERS as string[]).includes(key)) {
        const q = questions[indexRef.current];
        if (q?.alternatives.some((a) => a.letter === key)) {
          e.preventDefault();
          select(key as AlternativeLetter);
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        go(indexRef.current + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        go(indexRef.current - 1);
      } else if (key === 'R') {
        e.preventDefault();
        toggleFlag();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmOpen, navOpen, questions, select, go, toggleFlag]);

  useEffect(
    () => () => {
      if (debounce.current) clearTimeout(debounce.current);
    },
    [],
  );

  const q = questions[index];
  const items = useMemo(
    () =>
      questions.map((x) => ({
        id: x.id,
        answered: !!letters[x.id],
        flagged: flagged.has(x.id),
      })),
    [questions, letters, flagged],
  );
  const blanks = items.filter((i) => !i.answered).length;
  const flaggedCount = items.filter((i) => i.flagged).length;

  if (!q) return null;
  const isFlagged = flagged.has(q.id);
  const lowTime = remaining !== null && remaining <= 5 * 60_000;
  const critical = remaining !== null && remaining <= 60_000;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-bg text-ink">
      <header className="flex items-center gap-2 border-b-2 border-line bg-surface px-3 py-2 sm:gap-4 sm:px-6">
        <Button
          variant="secondary"
          size="sm"
          className="lg:hidden"
          onClick={() => setNavOpen(true)}
          aria-label="Abrir navegação de questões"
        >
          <Grid3x3 className="size-4" aria-hidden />
          <span className="hidden sm:inline">Questões</span>
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-bold sm:text-lg">{session.title}</p>
          <p className="text-xs text-muted" aria-live="polite">
            Questão {index + 1} de {questions.length} · {blanks} em branco
          </p>
        </div>
        <SaveIndicator state={saveState} />
        {remaining !== null && (
          <div
            role="timer"
            aria-label={`Tempo restante: ${formatClock(remaining)}`}
            className={cn(
              'flex items-center gap-1.5 rounded-xl border-2 border-line px-3 py-1.5 font-mono text-base font-bold tabular-nums sm:text-lg',
              lowTime && !critical && 'bg-highlight text-[#14213d]',
              critical && 'animate-pulse bg-danger text-white',
            )}
          >
            <Clock className="size-4" aria-hidden />
            {formatClock(remaining)}
          </div>
        )}
        <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={finishing}>
          Finalizar
        </Button>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside
          aria-label="Navegação de questões"
          className="hidden w-72 shrink-0 overflow-y-auto border-r-2 border-line-soft p-4 lg:block"
        >
          <QuestionNavigator items={items} current={index} onGo={go} />
        </aside>
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge tone="primary">Questão {index + 1}</Badge>
              {q.subject && <Badge>{q.subject}</Badge>}
              {isFlagged && (
                <Badge tone="highlight">
                  <Flag className="size-3" aria-hidden /> Revisar depois
                </Badge>
              )}
            </div>
            <QuestionView
              key={q.id}
              name={`q-${q.id}`}
              question={q}
              selected={letters[q.id] ?? null}
              onSelect={select}
            />
            <p className="mt-6 hidden text-xs text-muted sm:block">
              Atalhos: <kbd>A</kbd>–<kbd>E</kbd> responde, <kbd>←</kbd> <kbd>→</kbd> navega,{' '}
              <kbd>R</kbd> marca para revisar.
            </p>
          </div>
        </main>
      </div>

      <footer className="flex items-center justify-between gap-2 border-t-2 border-line bg-surface px-3 py-2.5 sm:px-6">
        <Button variant="secondary" onClick={() => go(index - 1)} disabled={index === 0}>
          <ChevronLeft className="size-4" aria-hidden />
          <span className="hidden sm:inline">Anterior</span>
        </Button>
        <Button
          variant={isFlagged ? 'accent' : 'ghost'}
          onClick={toggleFlag}
          aria-pressed={isFlagged}
        >
          <Flag className="size-4" aria-hidden />
          <span>{isFlagged ? 'Desmarcar' : 'Revisar depois'}</span>
        </Button>
        {index < questions.length - 1 ? (
          <Button onClick={() => go(index + 1)}>
            <span className="hidden sm:inline">Próxima</span>
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        ) : (
          <Button variant="accent" onClick={() => setConfirmOpen(true)}>
            Finalizar
          </Button>
        )}
      </footer>

      <Dialog
        open={navOpen}
        onClose={() => setNavOpen(false)}
        title="Navegar entre questões"
        variant="bottom"
      >
        <QuestionNavigator
          items={items}
          current={index}
          onGo={(i) => {
            go(i);
            setNavOpen(false);
          }}
        />
      </Dialog>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Finalizar simulado?">
        <div className="space-y-4">
          <p>
            {blanks > 0 ? (
              <>
                Você ainda tem{' '}
                <strong className="text-danger">
                  {blanks} {blanks === 1 ? 'questão em branco' : 'questões em branco'}
                </strong>
                .
              </>
            ) : (
              <>Você respondeu todas as questões.</>
            )}{' '}
            {flaggedCount > 0 &&
              `${flaggedCount} ${flaggedCount === 1 ? 'está marcada' : 'estão marcadas'} para revisar.`}
          </p>
          <p className="text-sm text-muted">
            Depois de finalizar não é possível alterar as respostas.
          </p>
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              Continuar prova
            </Button>
            <Button
              loading={finishing}
              onClick={() => {
                setConfirmOpen(false);
                void finish();
              }}
            >
              Finalizar agora
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  return (
    <span className="hidden items-center gap-1 text-xs text-muted sm:flex" aria-live="polite">
      {state === 'saving' && (
        <>
          <Loader2 className="size-3.5 animate-spin" aria-hidden /> Salvando...
        </>
      )}
      {state === 'saved' && (
        <>
          <CheckCircle2 className="size-3.5 text-success" aria-hidden /> Salvo
        </>
      )}
      {state === 'error' && (
        <span className="flex items-center gap-1 font-semibold text-danger">
          <AlertCircle className="size-3.5" aria-hidden /> Falha ao salvar
        </span>
      )}
    </span>
  );
}
