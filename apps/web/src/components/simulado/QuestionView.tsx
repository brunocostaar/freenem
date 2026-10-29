import { Check, X } from 'lucide-react';
import type { AlternativeLetter } from '@freenem/shared';
import { RichText } from '@/components/RichText';
import { cn } from '@/lib/cn';

export interface QuestionViewQuestion {
  statement: string;
  imageUrls: string[];
  alternatives: { letter: AlternativeLetter; text: string; imageUrl: string | null }[];
}

/**
 * Enunciado + alternativas. Sem `correctLetter` é o modo prova (sem revelar gabarito);
 * com `correctLetter` e `readOnly` é o modo revisão.
 */
export function QuestionView({
  question,
  selected,
  onSelect,
  correctLetter,
  readOnly,
  name,
}: {
  question: QuestionViewQuestion;
  selected: AlternativeLetter | null;
  onSelect?: (letter: AlternativeLetter) => void;
  correctLetter?: AlternativeLetter | null;
  readOnly?: boolean;
  /** agrupa os rádios; use um id único por questão */
  name: string;
}) {
  const review = correctLetter !== undefined;
  return (
    <div className="space-y-5">
      <RichText>{question.statement}</RichText>
      {question.imageUrls.map((url) => (
        <img
          key={url}
          src={url}
          alt="Figura da questão"
          loading="lazy"
          className="max-w-full rounded-lg border-2 border-line"
        />
      ))}
      <div role="radiogroup" aria-label="Alternativas" className="space-y-2.5">
        {question.alternatives.map((alt) => {
          const isSelected = selected === alt.letter;
          const isRight = review && correctLetter === alt.letter;
          const isWrongPick = review && isSelected && !isRight;
          return (
            <label
              key={alt.letter}
              className={cn(
                'flex items-start gap-3 rounded-xl border-2 p-3 transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-(--ring)',
                readOnly ? 'cursor-default' : 'cursor-pointer hover:bg-surface-2',
                isSelected ? 'border-line bg-surface-2' : 'border-line-soft bg-surface',
                isRight && 'border-success bg-success/10',
                isWrongPick && 'border-danger bg-danger/10',
              )}
            >
              <input
                type="radio"
                name={name}
                value={alt.letter}
                checked={isSelected}
                disabled={readOnly}
                onChange={() => onSelect?.(alt.letter)}
                className="sr-only"
              />
              <span
                aria-hidden
                className={cn(
                  'grid size-8 shrink-0 place-items-center rounded-full border-2 border-line text-sm font-bold',
                  isSelected && !review && 'bg-primary text-primary-ink',
                  isRight && 'border-success bg-success text-bg',
                  isWrongPick && 'border-danger bg-danger text-white',
                )}
              >
                {alt.letter}
              </span>
              <span className="min-w-0 flex-1 pt-0.5">
                <span className="sr-only">Alternativa {alt.letter}. </span>
                <RichText>{alt.text}</RichText>
                {alt.imageUrl && (
                  <img
                    src={alt.imageUrl}
                    alt={`Figura da alternativa ${alt.letter}`}
                    loading="lazy"
                    className="mt-2 max-w-full rounded-lg border-2 border-line"
                  />
                )}
              </span>
              {isRight && (
                <Check className="mt-1 size-5 shrink-0 text-success" aria-label="Correta" />
              )}
              {isWrongPick && (
                <X
                  className="mt-1 size-5 shrink-0 text-danger"
                  aria-label="Sua resposta (errada)"
                />
              )}
            </label>
          );
        })}
      </div>
    </div>
  );
}
