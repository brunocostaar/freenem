import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Circle, X } from 'lucide-react';
import { Card, CardTitle } from '@/components/ui';
import { overviewQuery, studyPlanQuery } from '@/lib/insights';
import { simuladosQuery } from '@/lib/simulados';
import { cn } from '@/lib/cn';

const QUESTIONS_GOAL = 5;
const storageKey = (userId: string) => `freenem-onboarding-dismissed:${userId}`;

function readDismissed(userId: string): boolean {
  try {
    return localStorage.getItem(storageKey(userId)) === '1';
  } catch {
    return false;
  }
}

/**
 * Checklist de primeiros passos em /inicio. O progresso vem dos endpoints existentes
 * (estatísticas, simulados, plano); só a dispensa fica no localStorage.
 */
export function OnboardingChecklist({ userId }: { userId: string }) {
  const [dismissed, setDismissed] = useState(() => readDismissed(userId));
  const overview = useQuery(overviewQuery('7d'));
  const simulados = useQuery(simuladosQuery);
  const plan = useQuery(studyPlanQuery);

  if (dismissed) return null;
  if (overview.isPending || simulados.isPending || plan.isPending) return null;
  if (overview.isError || simulados.isError || plan.isError) return null;

  const answered = overview.data.lifetimeAnswers;
  const steps = [
    {
      key: 'questions',
      title: `Resolva ${QUESTIONS_GOAL} questões`,
      hint: `${Math.min(answered, QUESTIONS_GOAL)}/${QUESTIONS_GOAL} resolvidas`,
      done: answered >= QUESTIONS_GOAL,
      to: '/questoes',
      cta: 'Resolver questões',
    },
    {
      key: 'simulado',
      title: 'Faça seu primeiro simulado',
      hint: 'Veja sua nota estimada por TRI',
      done: simulados.data.items.some((s) => s.attempts.some((a) => a.status === 'finished')),
      to: '/simulados',
      cta: 'Novo simulado',
    },
    {
      key: 'plan',
      title: 'Crie seu plano de estudos',
      hint: 'Um cronograma semanal até a prova',
      done: plan.data.plan !== null,
      to: '/plano',
      cta: 'Criar plano',
    },
  ] as const;

  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;

  function dismiss() {
    try {
      localStorage.setItem(storageKey(userId), '1');
    } catch {
      /* sem armazenamento: some só nesta sessão */
    }
    setDismissed(true);
  }

  return (
    <Card aria-labelledby="onboarding-title" className="relative">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dispensar primeiros passos"
        title="Dispensar"
        className="absolute top-3 right-3 grid size-9 place-items-center rounded-lg hover:bg-surface-2"
      >
        <X className="size-5" />
      </button>
      <CardTitle id="onboarding-title" className="pr-10">
        Primeiros passos
      </CardTitle>
      <div className="mt-3 flex items-center gap-3">
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuenow={doneCount}
          aria-label="Progresso dos primeiros passos"
          className="h-3 flex-1 overflow-hidden rounded-full border-2 border-line bg-surface-2"
        >
          <div
            className="h-full bg-highlight transition-[width]"
            style={{ width: `${(doneCount / steps.length) * 100}%` }}
          />
        </div>
        <span className="text-sm font-semibold">
          {doneCount}/{steps.length}
        </span>
      </div>
      <ol className="mt-4 grid gap-3 md:grid-cols-3">
        {steps.map((s) => (
          <li
            key={s.key}
            className={cn(
              'flex flex-col gap-2 rounded-xl border-2 p-3',
              s.done ? 'border-success/50 bg-success/10' : 'border-line-soft',
            )}
          >
            <div className="flex items-start gap-2">
              {s.done ? (
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
              ) : (
                <Circle className="mt-0.5 size-5 shrink-0 text-muted" aria-hidden />
              )}
              <div>
                <p className={cn('font-semibold', s.done && 'line-through decoration-2')}>
                  {s.title}
                </p>
                <p className="text-sm text-muted">{s.hint}</p>
              </div>
            </div>
            {!s.done && (
              <Link
                to={s.to}
                className="ml-7 text-sm font-semibold text-primary underline underline-offset-4"
              >
                {s.cta}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
}
