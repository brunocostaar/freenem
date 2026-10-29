import { Flag } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface NavigatorItem {
  id: string;
  answered: boolean;
  flagged: boolean;
}

/** Grade de navegação entre questões: respondida, marcada para revisar e atual. */
export function QuestionNavigator({
  items,
  current,
  onGo,
}: {
  items: NavigatorItem[];
  current: number;
  onGo: (index: number) => void;
}) {
  return (
    <div>
      <ol className="grid grid-cols-5 gap-2 sm:grid-cols-6 lg:grid-cols-5">
        {items.map((it, i) => (
          <li key={it.id}>
            <button
              type="button"
              onClick={() => onGo(i)}
              aria-current={i === current ? 'step' : undefined}
              aria-label={`Questão ${i + 1}, ${it.answered ? 'respondida' : 'em branco'}${
                it.flagged ? ', marcada para revisar' : ''
              }`}
              className={cn(
                'relative grid h-10 w-full place-items-center rounded-lg border-2 text-sm font-bold transition-colors',
                it.answered
                  ? 'border-line bg-surface-2 text-ink'
                  : 'border-line-soft bg-surface text-muted',
                it.flagged && 'border-line bg-highlight text-[#14213d]',
                i === current && 'border-line bg-primary text-primary-ink shadow-hard-sm',
              )}
            >
              {i + 1}
              {it.flagged && (
                <Flag aria-hidden className="absolute -top-1.5 -right-1.5 size-3.5 fill-current" />
              )}
            </button>
          </li>
        ))}
      </ol>
      <ul className="mt-4 space-y-1.5 text-xs text-muted">
        <Legend className="border-line bg-primary" label="Questão atual" />
        <Legend className="border-line bg-surface-2" label="Respondida" />
        <Legend className="border-line-soft bg-surface" label="Em branco" />
        <Legend className="border-line bg-highlight" label="Revisar depois" />
      </ul>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span aria-hidden className={cn('size-4 rounded border-2', className)} />
      {label}
    </li>
  );
}
