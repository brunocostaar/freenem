import { useState, type FormEvent } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  CalendarCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ListChecks,
  PenLine,
  RefreshCw,
  RotateCcw,
  type LucideIcon,
} from 'lucide-react';
import {
  ENEM_AREA_LABELS,
  studyPlanItemUpdateResponseSchema,
  studyPlanResponseSchema,
  type EnemArea,
  type PlanItemKind,
  type StudyPlan,
  type StudyPlanItem,
} from '@freenem/shared';
import {
  Badge,
  Button,
  Card,
  CardTitle,
  EmptyState,
  Input,
  Skeleton,
  useToast,
} from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { AppLink } from '@/components/AppLink';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDay, formatMinutes, nextEnemDate, studyPlanQuery } from '@/lib/insights';

export const Route = createFileRoute('/_app/_auth/plano')({
  head: () => ({ meta: [{ title: 'Plano de estudos · freenem' }] }),
  component: Plano,
});

const FOCUS_KEY = 'freenem:plan-focus-areas';
const AREAS = Object.keys(ENEM_AREA_LABELS) as EnemArea[];
const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const KIND: Record<PlanItemKind, { label: string; icon: LucideIcon; action: string }> = {
  theory: { label: 'Teoria', icon: BookOpen, action: 'Estudar' },
  questions: { label: 'Questões', icon: ListChecks, action: 'Praticar' },
  review: { label: 'Revisão', icon: RotateCcw, action: 'Revisar' },
  simulado: { label: 'Simulado', icon: ClipboardList, action: 'Fazer simulado' },
  essay: { label: 'Redação', icon: PenLine, action: 'Escrever' },
};

function loadFocus(): EnemArea[] {
  try {
    const raw = localStorage.getItem(FOCUS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((a): a is EnemArea => AREAS.includes(a)) : [];
  } catch {
    return [];
  }
}
function saveFocus(areas: EnemArea[]) {
  try {
    localStorage.setItem(FOCUS_KEY, JSON.stringify(areas));
  } catch {
    /* armazenamento indisponível: segue sem lembrar */
  }
}

function Plano() {
  const { data, isLoading, isError } = useQuery(studyPlanQuery);
  const [editing, setEditing] = useState(false);
  const plan = data?.plan ?? null;

  return (
    <>
      <PageHeader
        title="Plano de estudos"
        description="Um plano semanal baseado nos seus pontos fracos e na data da prova."
      />
      {isLoading && <Skeleton className="h-64" />}
      {isError && (
        <EmptyState
          icon={<CalendarCheck />}
          title="Não foi possível carregar seu plano"
          description="Verifique sua conexão e recarregue a página."
        />
      )}
      {data && (!plan || editing) && (
        <Wizard
          plan={plan}
          onDone={() => setEditing(false)}
          onCancel={plan ? () => setEditing(false) : undefined}
        />
      )}
      {plan && !editing && <PlanView plan={plan} onEdit={() => setEditing(true)} />}
    </>
  );
}

function Wizard({
  plan,
  onDone,
  onCancel,
}: {
  plan: StudyPlan | null;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [examDate, setExamDate] = useState(plan?.examDate ?? nextEnemDate());
  const [hours, setHours] = useState(String(plan?.hoursPerWeek ?? 10));
  const [days, setDays] = useState<number[]>(plan?.availableDays ?? [1, 2, 3, 4, 5, 6]);
  const [areas, setAreas] = useState<EnemArea[]>(loadFocus);
  const [error, setError] = useState<string>();

  const create = useMutation({
    mutationFn: () =>
      api('/api/v1/study-plan', {
        body: { examDate, hoursPerWeek: Number(hours), availableDays: days, focusAreas: areas },
        schema: studyPlanResponseSchema,
      }),
    onSuccess: (res) => {
      saveFocus(areas);
      qc.setQueryData(studyPlanQuery.queryKey, res);
      toast.success('Plano criado! Bons estudos.');
      onDone();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Erro ao criar o plano.'),
  });

  const toggle = <T,>(list: T[], v: T) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  function submit(e: FormEvent) {
    e.preventDefault();
    const h = Number(hours);
    if (!Number.isInteger(h) || h < 1 || h > 80)
      return setError('Informe de 1 a 80 horas por semana.');
    if (days.length === 0) return setError('Escolha pelo menos um dia da semana.');
    setError(undefined);
    create.mutate();
  }

  return (
    <Card>
      <form onSubmit={submit} className="flex flex-col gap-6">
        <div>
          <CardTitle className="text-2xl">
            {plan ? 'Refazer plano' : 'Vamos montar seu plano'}
          </CardTitle>
          <p className="mt-1 text-muted">
            Responda 4 perguntas rápidas. Você pode rebalancear o plano depois, conforme evolui.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            type="date"
            label="1. Data da prova"
            hint="Sugerimos o próximo ENEM (primeiro domingo de novembro)."
            value={examDate}
            onChange={(e) => setExamDate(e.target.value)}
            required
          />
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={80}
            label="2. Horas de estudo por semana"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            required
          />
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold">3. Dias disponíveis</legend>
          <div className="flex flex-wrap gap-2">
            {DAY_LABELS.map((label, i) => (
              <Chip key={label} pressed={days.includes(i)} onClick={() => setDays(toggle(days, i))}>
                {label}
              </Chip>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold">
            4. Áreas de foco <span className="font-normal text-muted">(opcional)</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {AREAS.map((a) => (
              <Chip key={a} pressed={areas.includes(a)} onClick={() => setAreas(toggle(areas, a))}>
                {ENEM_AREA_LABELS[a].replace(/ e suas Tecnologias| e suas tecnologias/, '')}
              </Chip>
            ))}
          </div>
        </fieldset>

        {error && (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" variant="accent" size="lg" loading={create.isPending}>
            {plan ? 'Refazer plano' : 'Gerar meu plano'}
          </Button>
          {onCancel && (
            <Button type="button" variant="ghost" size="lg" onClick={onCancel}>
              Cancelar
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}

function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'h-10 rounded-xl border-2 px-4 text-sm font-semibold transition-colors',
        pressed
          ? 'border-line bg-highlight text-[#14213d] shadow-hard-sm'
          : 'border-line-soft hover:bg-surface-2',
      )}
    >
      {children}
    </button>
  );
}

function PlanView({ plan, onEdit }: { plan: StudyPlan; onEdit: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [selected, setSelected] = useState<number | null>(null);
  const weekNumber = selected ?? plan.currentWeek;
  const week = plan.weeks.find((w) => w.week === weekNumber) ?? plan.weeks[0]!;
  const pct = plan.progress.total
    ? Math.round((plan.progress.done / plan.progress.total) * 100)
    : 0;

  const toggle = useMutation({
    mutationFn: (v: { id: string; done: boolean }) =>
      api(`/api/v1/study-plan/items/${v.id}`, {
        method: 'PATCH',
        body: { done: v.done },
        schema: studyPlanItemUpdateResponseSchema,
      }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: studyPlanQuery.queryKey });
      const prev = qc.getQueryData(studyPlanQuery.queryKey);
      if (prev?.plan) {
        const weeks = prev.plan.weeks.map((w) => ({
          ...w,
          items: w.items.map((i) => (i.id === v.id ? { ...i, done: v.done } : i)),
        }));
        const all = weeks.flatMap((w) => w.items);
        qc.setQueryData(studyPlanQuery.queryKey, {
          plan: {
            ...prev.plan,
            weeks,
            progress: { done: all.filter((i) => i.done).length, total: all.length },
          },
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(studyPlanQuery.queryKey, ctx.prev);
      toast.error('Não foi possível atualizar o item.');
    },
    onSettled: () => qc.invalidateQueries({ queryKey: studyPlanQuery.queryKey }),
  });

  const rebalance = useMutation({
    mutationFn: () =>
      api('/api/v1/study-plan/rebalance', {
        method: 'POST',
        body: { focusAreas: loadFocus() },
        schema: studyPlanResponseSchema,
      }),
    onSuccess: (res) => {
      qc.setQueryData(studyPlanQuery.queryKey, res);
      toast.success('Plano rebalanceado com base no seu desempenho.');
    },
    onError: () => toast.error('Não foi possível rebalancear agora.'),
  });

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-display text-3xl font-extrabold sm:text-4xl">
              {plan.daysUntilExam === 0
                ? 'A prova é hoje!'
                : `Faltam ${plan.daysUntilExam} ${plan.daysUntilExam === 1 ? 'dia' : 'dias'} para a prova`}
            </p>
            <p className="text-muted">
              Prova em {formatDay(plan.examDate, { year: 'numeric' })} · {plan.hoursPerWeek} h por
              semana
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              loading={rebalance.isPending}
              onClick={() => rebalance.mutate()}
            >
              <RefreshCw className="size-4" aria-hidden /> Rebalancear
            </Button>
            <Button variant="ghost" size="sm" onClick={onEdit}>
              Refazer plano
            </Button>
          </div>
        </div>
        <div>
          <div className="mb-1 flex justify-between text-sm font-semibold">
            <span>Progresso do plano</span>
            <span>
              {plan.progress.done}/{plan.progress.total} ({pct}%)
            </span>
          </div>
          <div
            role="progressbar"
            aria-label="Progresso do plano"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            className="h-4 overflow-hidden rounded-full border-2 border-line bg-surface-2"
          >
            <div className="h-full bg-success transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </Card>

      <section aria-label={`Semana ${week.week}`} className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex flex-wrap items-center gap-2 text-2xl">
              Semana {week.week} de {plan.totalWeeks}
              {week.isCurrent && <Badge tone="highlight">Esta semana</Badge>}
            </h2>
            <p className="text-sm text-muted">
              {formatDay(week.startDate)} a {formatDay(week.endDate)} ·{' '}
              {formatMinutes(week.plannedMinutes)} de {formatMinutes(week.budgetMinutes)} planejados
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!week.isCurrent && (
              <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                Semana atual
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              aria-label="Semana anterior"
              disabled={week.week <= 1}
              onClick={() => setSelected(week.week - 1)}
            >
              <ChevronLeft className="size-4" aria-hidden />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              aria-label="Próxima semana"
              disabled={week.week >= plan.totalWeeks}
              onClick={() => setSelected(week.week + 1)}
            >
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          </div>
        </div>

        {week.items.length === 0 ? (
          <EmptyState
            icon={<CalendarCheck />}
            title="Nada planejado nesta semana"
            description="Ainda não há assuntos suficientes no banco para preencher esta semana. Tente rebalancear mais tarde."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {week.items.map((item) => (
              <PlanItemCard
                key={item.id}
                item={item}
                onToggle={(done) => toggle.mutate({ id: item.id, done })}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function PlanItemCard({
  item,
  onToggle,
}: {
  item: StudyPlanItem;
  onToggle: (done: boolean) => void;
}) {
  const k = KIND[item.kind];
  const title = item.topicName ?? k.label;
  return (
    <li
      className={cn(
        'flex items-center gap-3 rounded-2xl border-2 border-line bg-surface p-3 shadow-hard-sm sm:p-4',
        item.done && 'opacity-70',
      )}
    >
      {item.auto ? (
        <span
          role="img"
          aria-label={item.done ? 'Concluído automaticamente' : 'Será concluído automaticamente'}
          className={cn(
            'grid size-8 shrink-0 place-items-center rounded-lg border-2 border-line',
            item.done ? 'bg-success text-bg' : 'bg-surface-2',
          )}
        >
          {item.done && <Check className="size-5" aria-hidden />}
        </span>
      ) : (
        <button
          type="button"
          role="checkbox"
          aria-checked={item.done}
          aria-label={`${k.label}: ${title}`}
          onClick={() => onToggle(!item.done)}
          className={cn(
            'grid size-8 shrink-0 place-items-center rounded-lg border-2 border-line transition-colors',
            item.done ? 'bg-success text-bg' : 'bg-surface hover:bg-highlight',
          )}
        >
          {item.done && <Check className="size-5" aria-hidden />}
        </button>
      )}
      <div className="grid size-10 shrink-0 place-items-center rounded-xl border-2 border-line bg-highlight text-[#14213d]">
        <k.icon className="size-5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn('font-semibold break-words', item.done && 'line-through')}>{title}</p>
        <p className="text-sm break-words text-muted">
          {k.label}
          {item.subjectName ? ` · ${item.subjectName}` : ''} · {formatMinutes(item.minutes)}
          {item.auto ? ' · automático' : ''}
        </p>
      </div>
      <AppLink
        href={item.href}
        className="shrink-0 rounded-lg border-2 border-line px-3 py-1.5 text-sm font-semibold hover:bg-surface-2"
      >
        {k.action}
      </AppLink>
    </li>
  );
}
