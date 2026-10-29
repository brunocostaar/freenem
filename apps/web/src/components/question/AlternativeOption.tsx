import { useRef, type KeyboardEvent } from 'react';
import { Check, Scissors, X } from 'lucide-react';
import type { AlternativeLetter } from '@freenem/shared';
import { RichText } from '@/components/RichText';
import { cn } from '@/lib/cn';

export type AlternativeState = 'idle' | 'selected' | 'correct' | 'wrong';

export interface AlternativeOptionProps {
  letter: AlternativeLetter;
  text: string;
  imageUrl?: string | null;
  state: AlternativeState;
  /** riscada pelo aluno ("eliminar alternativa") */
  eliminated?: boolean;
  /** trava a seleção (ex.: depois de responder) */
  disabled?: boolean;
  /** % de usuários que escolheram esta alternativa (mostrado após responder) */
  percent?: number | null;
  onSelect?: () => void;
  onToggleEliminate?: () => void;
}

const LONG_PRESS_MS = 500;

/**
 * Alternativa grande e tocável. Estados comunicam-se por cor E ícone (✓/✗), nunca só por cor.
 * Eliminar: botão de tesoura, botão direito do mouse ou toque longo.
 */
export function AlternativeOption({
  letter,
  text,
  imageUrl,
  state,
  eliminated = false,
  disabled = false,
  percent = null,
  onSelect,
  onToggleEliminate,
}: AlternativeOptionProps) {
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  const revealed = state === 'correct' || state === 'wrong';

  function startPress() {
    if (!onToggleEliminate || disabled) return;
    longPressed.current = false;
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      onToggleEliminate();
    }, LONG_PRESS_MS);
  }
  function endPress() {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  }
  function handleClick() {
    if (longPressed.current) {
      longPressed.current = false;
      return;
    }
    if (!disabled) onSelect?.();
  }
  function handleKey(e: KeyboardEvent<HTMLDivElement>) {
    // Enter fica reservado para "Responder" na tela
    if (e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }

  const label = {
    idle: '',
    selected: ', selecionada',
    correct: ', alternativa correta',
    wrong: ', resposta incorreta',
  }[state];

  return (
    <div className="flex items-stretch gap-2">
      <div
        role="radio"
        aria-checked={
          state === 'selected' || state === 'wrong' || (state === 'correct' && !disabled)
        }
        aria-disabled={disabled || undefined}
        aria-label={`Alternativa ${letter}${eliminated ? ', eliminada' : ''}${label}`}
        tabIndex={disabled ? -1 : 0}
        onClick={handleClick}
        onKeyDown={handleKey}
        onContextMenu={(e) => {
          if (onToggleEliminate && !disabled) {
            e.preventDefault();
            onToggleEliminate();
          }
        }}
        onPointerDown={startPress}
        onPointerUp={endPress}
        onPointerLeave={endPress}
        onPointerCancel={endPress}
        className={cn(
          'relative flex min-h-14 flex-1 items-start gap-3 overflow-hidden rounded-xl border-2 px-3.5 py-3 text-left transition-all duration-150 select-none',
          !disabled && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-hard-sm',
          state === 'idle' && 'border-line-soft bg-surface',
          state === 'selected' && 'border-primary bg-primary/10 shadow-hard-sm',
          state === 'correct' && 'border-success bg-success/15',
          state === 'wrong' && 'border-danger bg-danger/10',
          eliminated && !revealed && 'opacity-50',
        )}
      >
        {percent !== null && (
          <span
            aria-hidden
            className={cn(
              'absolute inset-y-0 left-0 -z-0 opacity-20',
              state === 'correct' ? 'bg-success' : state === 'wrong' ? 'bg-danger' : 'bg-line-soft',
            )}
            style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
          />
        )}
        <span
          className={cn(
            'relative z-10 grid size-9 shrink-0 place-items-center rounded-full border-2 font-display text-base font-bold',
            state === 'idle' && 'border-line bg-surface',
            state === 'selected' && 'border-primary bg-primary text-primary-ink',
            state === 'correct' && 'border-success bg-success text-bg',
            state === 'wrong' && 'border-danger bg-danger text-white',
          )}
          aria-hidden
        >
          {state === 'correct' ? (
            <Check className="size-5" strokeWidth={3} />
          ) : state === 'wrong' ? (
            <X className="size-5" strokeWidth={3} />
          ) : (
            letter
          )}
        </span>
        <div
          className={cn(
            'relative z-10 min-w-0 flex-1 pt-1',
            eliminated && !revealed && 'line-through decoration-2',
          )}
        >
          {text && <RichText>{text}</RichText>}
          {imageUrl && <RichText>{`![Alternativa ${letter}](${imageUrl})`}</RichText>}
        </div>
        {percent !== null && (
          <span className="relative z-10 shrink-0 pt-1.5 text-sm font-bold tabular-nums">
            {percent}%
          </span>
        )}
      </div>
      {onToggleEliminate && !disabled && (
        <button
          type="button"
          onClick={onToggleEliminate}
          aria-pressed={eliminated}
          aria-label={`${eliminated ? 'Restaurar' : 'Eliminar'} alternativa ${letter}`}
          title={eliminated ? 'Restaurar alternativa' : 'Eliminar alternativa'}
          className={cn(
            'grid w-10 shrink-0 place-items-center rounded-xl border-2 border-transparent text-muted hover:border-line-soft hover:bg-surface-2 hover:text-ink',
            eliminated && 'border-line-soft bg-surface-2 text-ink',
          )}
        >
          <Scissors className="size-4" />
        </button>
      )}
    </div>
  );
}
