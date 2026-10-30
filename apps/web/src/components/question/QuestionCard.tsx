import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { Bookmark, BookmarkCheck, CheckCircle2, ExternalLink, Send, XCircle } from 'lucide-react';
import {
  DIFFICULTY_LABELS,
  type AlternativeLetter,
  type AnswerResponse,
  type QuestionSummary,
} from '@freenem/shared';
import { RichText } from '@/components/RichText';
import { Badge, Button, Card } from '@/components/ui';
import { cn } from '@/lib/cn';
import { AlternativeOption, type AlternativeState } from './AlternativeOption';
import { ReportQuestionButton } from './ReportQuestionButton';

export interface QuestionCardProps {
  question: QuestionSummary;
  /** alternativa marcada (controlado) */
  selected: AlternativeLetter | null;
  onSelect: (letter: AlternativeLetter) => void;
  /**
   * `practice` (padrão): botão "Responder", gabarito, estatísticas e resolução.
   * `select`: só seleção (sem revelar nada) — usado em simulados.
   */
  mode?: 'practice' | 'select';
  /** resposta já corrigida (modo practice) */
  result?: AnswerResponse | null;
  onSubmit?: () => void;
  submitting?: boolean;
  /** favoritar (omita para esconder o botão) */
  saved?: boolean;
  onToggleSave?: () => void;
  /** avisa quando a questão entra/sai da tela (usado para medir o tempo gasto) */
  onVisibilityChange?: (visible: boolean) => void;
  /** atalhos A–E para marcar a alternativa */
  hotkeys?: boolean;
  /** sem cabeçalho de metadados (o contexto já aparece em volta, como no simulado) */
  compact?: boolean;
  /** esconde o link para a página própria da questão */
  hideLink?: boolean;
  /** conteúdo extra no rodapé (ex.: navegação do simulado) */
  footer?: ReactNode;
  className?: string;
}

const LETTERS: AlternativeLetter[] = ['A', 'B', 'C', 'D', 'E'];

/** Elementos editáveis não devem disparar atalhos. */
export function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  return t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName);
}

export function QuestionCard({
  question,
  selected,
  onSelect,
  mode = 'practice',
  result = null,
  onSubmit,
  submitting = false,
  saved,
  onToggleSave,
  onVisibilityChange,
  hotkeys = false,
  hideLink = false,
  compact = false,
  footer,
  className,
}: QuestionCardProps) {
  const [eliminated, setEliminated] = useState<Set<AlternativeLetter>>(new Set());
  const locked = result !== null;

  const rootRef = useRef<HTMLDivElement>(null);
  const viewCb = useRef(onVisibilityChange);
  viewCb.current = onVisibilityChange;
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([entry]) => viewCb.current?.(Boolean(entry?.isIntersecting)),
      {
        threshold: 0.3,
      },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      viewCb.current?.(false);
    };
  }, [question.id]);

  // nova questão: limpa as alternativas riscadas
  useEffect(() => setEliminated(new Set()), [question.id]);

  useEffect(() => {
    if (!hotkeys || locked) return;
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      if (document.querySelector('dialog[open]')) return;
      const letter = e.key.toUpperCase() as AlternativeLetter;
      if (LETTERS.includes(letter) && question.alternatives.some((a) => a.letter === letter)) {
        onSelect(letter);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hotkeys, locked, onSelect, question.alternatives]);

  function toggleEliminate(letter: AlternativeLetter) {
    setEliminated((cur) => {
      const next = new Set(cur);
      if (next.has(letter)) next.delete(letter);
      else next.add(letter);
      return next;
    });
  }

  function stateOf(letter: AlternativeLetter): AlternativeState {
    if (result) {
      if (letter === result.correctLetter) return 'correct';
      if (letter === selected) return 'wrong';
      return 'idle';
    }
    return letter === selected ? 'selected' : 'idle';
  }

  const percentOf = (letter: AlternativeLetter) =>
    result ? (result.stats.find((s) => s.letter === letter)?.percent ?? 0) : null;

  const difficultyTone = { easy: 'success', medium: 'highlight', hard: 'danger' } as const;

  return (
    <Card
      ref={rootRef}
      className={cn('space-y-5', className)}
      {...(compact
        ? { role: 'group', 'aria-label': 'Questão' }
        : { 'aria-labelledby': `q-${question.id}-title` })}
    >
      <header
        className={cn('flex-wrap items-start justify-between gap-3', compact ? 'hidden' : 'flex')}
      >
        <div className="flex flex-wrap items-center gap-1.5" id={`q-${question.id}-title`}>
          <Badge tone="primary">
            {question.institution} {question.year}
          </Badge>
          {question.number !== null && <Badge>Questão {question.number}</Badge>}
          <Badge tone="accent">{question.subject}</Badge>
          {question.topics.slice(0, 2).map((t) => (
            <Badge key={t} className="normal-case tracking-normal">
              {t}
            </Badge>
          ))}
          {question.difficulty && (
            <Badge tone={difficultyTone[question.difficulty]}>
              {DIFFICULTY_LABELS[question.difficulty]}
            </Badge>
          )}
          {question.status !== 'published' && <Badge tone="danger">Rascunho</Badge>}
        </div>
        <div className="flex items-center gap-1">
          {!hideLink && (
            <Link
              to="/questoes/$id"
              params={{ id: question.id }}
              aria-label="Abrir página da questão"
              title="Abrir página da questão"
              className="grid size-10 place-items-center rounded-lg hover:bg-surface-2"
            >
              <ExternalLink className="size-5" />
            </Link>
          )}
          <ReportQuestionButton questionId={question.id} />
          {onToggleSave && (
            <button
              type="button"
              onClick={onToggleSave}
              aria-pressed={saved}
              aria-label={saved ? 'Remover dos salvos' : 'Salvar questão'}
              title={saved ? 'Remover dos salvos' : 'Salvar questão'}
              className={cn(
                'grid size-10 place-items-center rounded-lg hover:bg-surface-2',
                saved && 'text-primary',
              )}
            >
              {saved ? <BookmarkCheck className="size-5" /> : <Bookmark className="size-5" />}
            </button>
          )}
        </div>
      </header>

      {question.answered && !result && mode === 'practice' && (
        <p className="flex items-center gap-2 text-sm font-semibold text-muted">
          {question.wasCorrect ? (
            <CheckCircle2 className="size-4 text-success" aria-hidden />
          ) : (
            <XCircle className="size-4 text-danger" aria-hidden />
          )}
          Você já respondeu esta questão e {question.wasCorrect ? 'acertou' : 'errou'}.
        </p>
      )}

      <RichText className="text-base sm:text-lg">{question.statement}</RichText>

      <div role="radiogroup" aria-label="Alternativas" className="space-y-2.5">
        {question.alternatives.map((alt) => (
          <AlternativeOption
            key={alt.letter}
            letter={alt.letter}
            text={alt.text}
            imageUrl={alt.imageUrl}
            state={stateOf(alt.letter)}
            eliminated={eliminated.has(alt.letter)}
            disabled={locked}
            percent={percentOf(alt.letter)}
            onSelect={() => onSelect(alt.letter)}
            onToggleEliminate={() => toggleEliminate(alt.letter)}
          />
        ))}
      </div>

      {!locked && (
        <p className="hidden text-xs text-muted sm:block">
          Dica: clique com o botão direito (ou segure o dedo) numa alternativa para eliminá-la
          {hotkeys ? '. Atalhos: A–E marcam, Enter responde.' : '.'}
        </p>
      )}

      {mode === 'practice' && !result && (
        <Button
          size="lg"
          className="w-full sm:w-auto"
          disabled={!selected}
          loading={submitting}
          onClick={onSubmit}
        >
          <Send className="size-5" aria-hidden />
          Responder
        </Button>
      )}

      {result && (
        <div className="space-y-4" aria-live="polite">
          <div
            role="status"
            className={cn(
              'flex items-start gap-3 rounded-xl border-2 p-4',
              result.correct ? 'border-success bg-success/15' : 'border-danger bg-danger/10',
            )}
          >
            {result.correct ? (
              <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-success" aria-hidden />
            ) : (
              <XCircle className="mt-0.5 size-6 shrink-0 text-danger" aria-hidden />
            )}
            <div>
              <p className="font-display text-lg font-bold">
                {result.correct ? 'Você acertou!' : selected ? 'Você errou.' : 'Em branco.'}
              </p>
              <p className="text-sm">
                Gabarito: <strong>alternativa {result.correctLetter}</strong>
                {result.totalAnswers > 0 &&
                  ` · ${result.totalAnswers} ${result.totalAnswers === 1 ? 'resposta' : 'respostas'} de outros estudantes (porcentagens ao lado de cada alternativa)`}
              </p>
            </div>
          </div>
          {result.resolution && (
            <div className="rounded-xl border-2 border-line-soft bg-surface-2 p-4">
              <h3 className="mb-2 text-base">Resolução</h3>
              <RichText>{result.resolution}</RichText>
            </div>
          )}
        </div>
      )}

      {(question.source || footer) && (
        <footer className="space-y-3">
          {footer}
          {question.source && (
            <p className="text-xs text-muted">
              Fonte:{' '}
              {question.source.url ? (
                <a
                  href={question.source.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="underline"
                >
                  {question.source.name}
                </a>
              ) : (
                question.source.name
              )}
            </p>
          )}
        </footer>
      )}
    </Card>
  );
}
