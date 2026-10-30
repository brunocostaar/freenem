import { Link } from '@tanstack/react-router';
import { Shuffle } from 'lucide-react';
import { ENEM_AREA_LABELS, type EnemArea, type SubjectProgress } from '@freenem/shared';
import { Button, Card, Skeleton } from '@/components/ui';
import { cn } from '@/lib/cn';
import { subjectColor } from '@/lib/subject-colors';

const AREA_ORDER: EnemArea[] = ['linguagens', 'humanas', 'natureza', 'matematica'];

export interface SubjectGridProps {
  subjects: SubjectProgress[] | undefined;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  loggedIn: boolean;
  onSelectSubject: (subjectId: string) => void;
  onSelectAll: () => void;
}

const GRID = 'grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4';

export function SubjectGrid({
  subjects,
  loading,
  error,
  onRetry,
  loggedIn,
  onSelectSubject,
  onSelectAll,
}: SubjectGridProps) {
  const groups = AREA_ORDER.map((area) => ({
    area,
    items: (subjects ?? []).filter((s) => s.area === area),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-8">
      <Card className="flex flex-wrap items-center justify-between gap-4 bg-highlight/30 p-4 sm:p-5">
        <div>
          <h2 className="text-xl">Escolha uma matéria</h2>
          <p className="text-sm text-ink">Ou resolva questões de todas elas, sem filtro.</p>
        </div>
        <Button variant="accent" size="lg" onClick={onSelectAll}>
          <Shuffle className="size-5" aria-hidden />
          Misturar todas as matérias
        </Button>
      </Card>

      {!loggedIn && !loading && (
        <p className="text-sm text-muted">
          <Link
            to="/entrar"
            search={{ redirect: '/questoes' }}
            className="font-semibold text-ink underline underline-offset-2"
          >
            Entre na sua conta
          </Link>{' '}
          para acompanhar seu progresso em cada matéria.
        </p>
      )}

      {loading ? (
        <div className={GRID} aria-busy="true" aria-label="Carregando matérias">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium">Não foi possível carregar as matérias.</p>
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Tentar novamente
          </Button>
        </Card>
      ) : (
        groups.map(({ area, items }) => (
          <section key={area} aria-labelledby={`area-${area}`} className="space-y-3">
            <h2 id={`area-${area}`} className="text-lg">
              {ENEM_AREA_LABELS[area]}
            </h2>
            <ul className={GRID}>
              {items.map((s) => (
                <li key={s.subjectId}>
                  <SubjectCard subject={s} loggedIn={loggedIn} onSelect={onSelectSubject} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function SubjectCard({
  subject: s,
  loggedIn,
  onSelect,
}: {
  subject: SubjectProgress;
  loggedIn: boolean;
  onSelect: (subjectId: string) => void;
}) {
  const color = subjectColor(s.slug);
  const pct = s.total > 0 ? Math.round((s.answered / s.total) * 100) : 0;
  const accuracy = s.answered > 0 ? Math.round((s.correct / s.answered) * 100) : null;
  const fmt = (n: number) => n.toLocaleString('pt-BR');

  return (
    <button
      type="button"
      onClick={() => onSelect(s.subjectId)}
      className={cn(
        'flex h-full w-full flex-col gap-2 rounded-2xl border-2 border-l-8 border-line bg-surface p-3 text-left shadow-hard-sm transition-transform hover:-translate-y-0.5 sm:p-4',
        color.border,
      )}
    >
      <span className="font-display text-base leading-tight font-bold sm:text-lg">{s.name}</span>
      <span className="text-sm text-muted">
        {loggedIn ? `${fmt(s.answered)} de ${fmt(s.total)} feitas` : `${fmt(s.total)} questões`}
      </span>
      {loggedIn && (
        <>
          <span
            role="progressbar"
            aria-label={`Progresso em ${s.name}`}
            aria-valuemin={0}
            aria-valuemax={s.total}
            aria-valuenow={s.answered}
            aria-valuetext={`${fmt(s.answered)} de ${fmt(s.total)} questões feitas`}
            className={cn('block h-2.5 w-full overflow-hidden rounded-full', color.soft)}
          >
            <span
              className={cn('block h-full rounded-full', color.bar)}
              style={{ width: `${pct}%` }}
            />
          </span>
          {accuracy !== null && (
            <span className="text-xs font-semibold text-muted">{accuracy}% de acerto</span>
          )}
        </>
      )}
    </button>
  );
}
