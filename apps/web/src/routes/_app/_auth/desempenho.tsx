import { useState } from 'react';
import { Link, createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Clock,
  Flame,
  ListChecks,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  ENEM_AREA_LABELS,
  type StatsRange,
  type SubjectStat,
  type TopicStat,
} from '@freenem/shared';
import { Badge, buttonClasses, Card, CardTitle, EmptyState, Skeleton } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { ActivityHeatmap } from '@/components/insights/ActivityHeatmap';
import { AreaRadar, ScoreLine } from '@/components/insights/Charts';
import { AppLink, practiceHref } from '@/components/AppLink';
import { cn } from '@/lib/cn';
import {
  AREA_SHORT,
  formatDay,
  formatDuration,
  formatPercent,
  overviewQuery,
  subjectTopicsQuery,
} from '@/lib/insights';

export const Route = createFileRoute('/_app/_auth/desempenho')({
  head: () => ({ meta: [{ title: 'Desempenho · freenem' }] }),
  component: Desempenho,
});

const RANGES: { value: StatsRange; label: string }[] = [
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
  { value: 'all', label: 'Tudo' },
];

function Desempenho() {
  const [range, setRange] = useState<StatsRange>('30d');
  const { data, isLoading, isError, refetch } = useQuery(overviewQuery(range));

  return (
    <>
      <PageHeader
        title="Desempenho"
        description="Acompanhe acertos por área, matéria e assunto, e sua evolução."
        actions={<RangeSelector value={range} onChange={setRange} />}
      />

      {isLoading && <DashboardSkeleton />}
      {isError && (
        <EmptyState
          icon={<BarChart3 />}
          title="Não foi possível carregar seus dados"
          description="Verifique sua conexão e tente novamente."
          action={
            <button type="button" className={buttonClasses('primary')} onClick={() => refetch()}>
              Tentar de novo
            </button>
          }
        />
      )}

      {data && data.lifetimeAnswers === 0 && (
        <EmptyState
          icon={<Target />}
          title="Resolva sua primeira questão"
          description="Assim que você responder, seus gráficos de acertos, pontos fracos e sequência de estudos aparecem aqui."
          action={
            <Link to="/questoes" className={buttonClasses('accent')}>
              Ir para as questões
            </Link>
          }
        />
      )}

      {data && data.lifetimeAnswers > 0 && (
        <div className="flex flex-col gap-6">
          <section aria-label="Resumo" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi icon={ListChecks} label="Questões" value={String(data.totalAnswers)} />
            <Kpi
              icon={CheckCircle2}
              label="Acerto"
              value={data.totalAnswers ? formatPercent(data.accuracy) : '—'}
            />
            <Kpi
              icon={Flame}
              label="Sequência"
              value={`${data.streakDays} ${data.streakDays === 1 ? 'dia' : 'dias'}`}
              tone="bg-accent text-accent-ink"
            />
            <Kpi icon={Clock} label="Tempo estudado" value={formatDuration(data.timeStudiedMs)} />
          </section>

          <Card>
            <CardTitle className="mb-4">Atividade</CardTitle>
            <ActivityHeatmap activity={data.activity} />
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardTitle className="mb-2">Acerto por área</CardTitle>
              {data.byArea.length === 0 ? (
                <p className="text-muted">Sem respostas neste período.</p>
              ) : (
                <>
                  {data.byArea.length >= 3 && <AreaRadar areas={data.byArea} />}
                  <ul className="mt-2 flex flex-col gap-3">
                    {data.byArea.map((a) => (
                      <li key={a.area}>
                        <div className="mb-1 flex justify-between gap-2 text-sm">
                          <span className="font-semibold" title={ENEM_AREA_LABELS[a.area]}>
                            {AREA_SHORT[a.area]}
                          </span>
                          <span className="text-muted">
                            {formatPercent(a.accuracy)} · {a.correct}/{a.total}
                          </span>
                        </div>
                        <Bar
                          value={a.accuracy}
                          label={`${AREA_SHORT[a.area]}: ${formatPercent(a.accuracy)}`}
                        />
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>

            <Card>
              <CardTitle className="mb-4 flex items-center gap-2">
                <TrendingDown className="size-5 text-danger" aria-hidden /> Pontos fracos
              </CardTitle>
              {data.weakTopics.length === 0 ? (
                <p className="text-muted">
                  Responda ao menos 5 questões de um assunto para ele aparecer aqui.
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {data.weakTopics.map((t) => (
                    <li
                      key={t.topicId}
                      className="flex items-center justify-between gap-3 rounded-xl border-2 border-line-soft p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{t.topic}</p>
                        <p className="text-sm text-muted">
                          {t.subject} · {formatPercent(t.accuracy)} ({t.correct}/{t.total})
                        </p>
                      </div>
                      <AppLink
                        href={practiceHref(t.topicId)}
                        className={buttonClasses('accent', 'sm')}
                      >
                        Praticar
                      </AppLink>
                    </li>
                  ))}
                </ul>
              )}
              {data.bestTopics.length > 0 && (
                <>
                  <h4 className="mt-6 mb-2 flex items-center gap-2 font-display text-lg font-bold">
                    <TrendingUp className="size-5 text-success" aria-hidden /> Pontos fortes
                  </h4>
                  <ul className="flex flex-wrap gap-2">
                    {data.bestTopics.map((t) => (
                      <li key={t.topicId}>
                        <Badge tone="success" title={`${t.subject}: ${t.correct}/${t.total}`}>
                          {t.topic} {formatPercent(t.accuracy)}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>
          </div>

          <Card>
            <CardTitle className="mb-4">Por matéria</CardTitle>
            {data.bySubject.length === 0 ? (
              <p className="text-muted">Sem respostas neste período.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {data.bySubject.map((s) => (
                  <SubjectRow key={s.subjectId} subject={s} />
                ))}
              </ul>
            )}
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardTitle className="mb-4">Evolução nos simulados</CardTitle>
              <SimuladoEvolution scores={data.recentSimulados} />
            </Card>
            <Card>
              <CardTitle className="mb-1">Evolução na redação</CardTitle>
              {data.essayAverage !== null && (
                <p className="mb-3 text-muted">
                  Média: <strong className="text-ink">{Math.round(data.essayAverage)}</strong> /
                  1000
                </p>
              )}
              {data.essays.length === 0 ? (
                <EmptyHint
                  text="Nenhuma redação corrigida ainda."
                  to="/redacao"
                  action="Escrever redação"
                />
              ) : (
                <>
                  <ScoreLine
                    name="Nota"
                    domain={[0, 1000]}
                    data={data.essays.map((e) => ({
                      label: formatDay(e.createdAt.slice(0, 10)),
                      value: e.totalScore,
                    }))}
                  />
                  <ul className="sr-only">
                    {data.essays.map((e) => (
                      <li key={e.essayId}>
                        {formatDay(e.createdAt.slice(0, 10))}: {e.themeTitle}, nota {e.totalScore}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

function RangeSelector({
  value,
  onChange,
}: {
  value: StatsRange;
  onChange: (r: StatsRange) => void;
}) {
  return (
    <div role="group" aria-label="Período" className="flex gap-1.5">
      {RANGES.map((r) => (
        <button
          key={r.value}
          type="button"
          aria-pressed={value === r.value}
          onClick={() => onChange(r.value)}
          className={cn(
            'h-9 rounded-xl border-2 px-3 text-sm font-semibold transition-colors',
            value === r.value
              ? 'border-line bg-highlight text-[#14213d] shadow-hard-sm'
              : 'border-transparent hover:bg-surface-2',
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone = 'bg-highlight text-[#14213d]',
}: {
  icon: typeof Flame;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <Card className="flex items-center gap-3 p-4 sm:p-5">
      <div
        className={cn(
          'grid size-11 shrink-0 place-items-center rounded-xl border-2 border-line shadow-hard-sm',
          tone,
        )}
      >
        <Icon className="size-5" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-muted">{label}</p>
        <p className="truncate font-display text-xl font-extrabold sm:text-2xl">{value}</p>
      </div>
    </Card>
  );
}

function Bar({ value, label }: { value: number; label: string }) {
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      className="h-3 overflow-hidden rounded-full border-2 border-line bg-surface-2"
    >
      <div
        className={cn(
          'h-full',
          value >= 0.7 ? 'bg-success' : value >= 0.5 ? 'bg-highlight' : 'bg-accent',
        )}
        style={{ width: `${Math.round(value * 100)}%` }}
      />
    </div>
  );
}

function EmptyHint({
  text,
  to,
  action,
}: {
  text: string;
  to: '/simulados' | '/redacao';
  action: string;
}) {
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-muted">{text}</p>
      <Link to={to} className={buttonClasses('secondary', 'sm')}>
        {action}
      </Link>
    </div>
  );
}

function SimuladoEvolution({
  scores,
}: {
  scores: {
    attemptId: string;
    title: string;
    finishedAt: string;
    questionCount: number;
    rawScore: number | null;
    triScore: number | null;
  }[];
}) {
  if (scores.length === 0) {
    return (
      <EmptyHint
        text="Você ainda não finalizou nenhum simulado."
        to="/simulados"
        action="Fazer um simulado"
      />
    );
  }
  const hasTri = scores.some((s) => s.triScore !== null);
  const points = scores.flatMap((s) => {
    const value = hasTri
      ? s.triScore
      : s.rawScore !== null && s.questionCount > 0
        ? Math.round((s.rawScore / s.questionCount) * 100)
        : null;
    return value === null
      ? []
      : [{ label: formatDay(s.finishedAt.slice(0, 10)), value: Math.round(value), title: s.title }];
  });
  return (
    <>
      <ScoreLine
        name={hasTri ? 'Nota TRI' : 'Acerto (%)'}
        domain={hasTri ? [300, 1000] : [0, 100]}
        data={points}
      />
      <ul className="sr-only">
        {points.map((p) => (
          <li key={p.label + p.title}>
            {p.label}: {p.title}, {hasTri ? 'nota' : 'acerto'} {p.value}
          </li>
        ))}
      </ul>
    </>
  );
}

function SubjectRow({ subject }: { subject: SubjectStat }) {
  const [open, setOpen] = useState(false);
  const panelId = `subject-${subject.subjectId}`;
  return (
    <li className="rounded-xl border-2 border-line-soft">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 p-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex justify-between gap-2">
            <span className="truncate font-semibold">{subject.subject}</span>
            <span className="shrink-0 text-sm text-muted">
              {formatPercent(subject.accuracy)} · {subject.correct}/{subject.total}
            </span>
          </div>
          <Bar
            value={subject.accuracy}
            label={`${subject.subject}: ${formatPercent(subject.accuracy)}`}
          />
        </div>
        <ChevronDown
          aria-hidden
          className={cn('size-5 shrink-0 transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div id={panelId} className="border-t-2 border-line-soft p-3">
          <TopicsTable subjectId={subject.subjectId} />
        </div>
      )}
    </li>
  );
}

function TopicsTable({ subjectId }: { subjectId: string }) {
  const { data, isLoading } = useQuery(subjectTopicsQuery(subjectId));
  if (isLoading) return <Skeleton className="h-24" />;
  const topics: TopicStat[] = data?.topics ?? [];
  if (topics.length === 0) return <p className="text-muted">Nenhum assunto cadastrado.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">Acertos por assunto</caption>
        <thead>
          <tr className="text-left text-muted">
            <th scope="col" className="py-1.5 pr-3 font-semibold">
              Assunto
            </th>
            <th scope="col" className="py-1.5 pr-3 text-right font-semibold">
              Respostas
            </th>
            <th scope="col" className="py-1.5 pr-3 text-right font-semibold">
              Acerto
            </th>
            <th scope="col" className="py-1.5 text-right font-semibold">
              <span className="sr-only">Ação</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {topics.map((t) => (
            <tr key={t.topicId} className="border-t border-line-soft">
              <th scope="row" className="py-2 pr-3 text-left font-medium">
                {t.topic}
              </th>
              <td className="py-2 pr-3 text-right tabular-nums">{t.total}</td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {t.total ? formatPercent(t.accuracy) : '—'}
              </td>
              <td className="py-2 text-right">
                <AppLink href={practiceHref(t.topicId)} className="font-semibold underline">
                  Praticar
                </AppLink>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy aria-label="Carregando">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <Skeleton className="h-44" />
      <Skeleton className="h-64" />
    </div>
  );
}
