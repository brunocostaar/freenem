import { useMemo, useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Check, Clock, Info, Minus, X } from 'lucide-react';
import type { AreaResult, AttemptResult, QuestionOutcome, ResultQuestion } from '@freenem/shared';
import { PageHeader } from '@/components/layout/PageHeader';
import { QuestionView } from '@/components/simulado/QuestionView';
import { RichText } from '@/components/RichText';
import { Badge, Card, CardTitle, EmptyState, Skeleton, buttonClasses } from '@/components/ui';
import { cn } from '@/lib/cn';
import { AREA_SHORT, attemptResultQuery, formatDuration } from '@/lib/simulados';

export const Route = createFileRoute('/_app/_auth/simulados/$attemptId/resultado')({
  component: ResultadoPage,
});

function ResultadoPage() {
  const { attemptId } = Route.useParams();
  const { data, error, isPending } = useQuery(attemptResultQuery(attemptId));

  if (isPending) {
    return (
      <div className="space-y-4" aria-busy>
        <Skeleton className="h-12 w-1/2" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <EmptyState
        title="Resultado indisponível"
        description={error instanceof Error ? error.message : undefined}
        action={
          <Link to="/simulados" className={buttonClasses('primary')}>
            Voltar aos simulados
          </Link>
        }
      />
    );
  }
  return <Result r={data} />;
}

function Result({ r }: { r: AttemptResult }) {
  return (
    <>
      <PageHeader
        title="Resultado"
        description={r.title}
        actions={
          <Link to="/simulados" className={buttonClasses('secondary')}>
            Todos os simulados
          </Link>
        }
      />
      <div className="space-y-8">
        <Summary r={r} />
        {r.areas.length > 0 && (
          <section aria-labelledby="areas-title" className="space-y-4">
            <h2 id="areas-title" className="text-2xl">
              Nota estimada por área
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {r.areas.map((a) => (
                <AreaCard key={a.area} a={a} />
              ))}
            </div>
            <TriDisclaimer />
          </section>
        )}
        <SubjectChart r={r} />
        <CoherenceCard r={r} />
        <Review r={r} />
      </div>
    </>
  );
}

function Summary({ r }: { r: AttemptResult }) {
  const stats: { label: string; value: string; tone?: string }[] = [
    { label: 'Acertos', value: `${r.correct}/${r.total}` },
    { label: 'Aproveitamento', value: `${r.percentage.toLocaleString('pt-BR')}%` },
    { label: 'Erros', value: String(r.wrong) },
    { label: 'Em branco', value: String(r.blank) },
    { label: 'Tempo total', value: r.totalTimeMs > 0 ? formatDuration(r.totalTimeMs) : '-' },
  ];
  return (
    <Card>
      <h2 className="sr-only">Resumo</h2>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label}>
            <dt className="text-sm text-muted">{s.label}</dt>
            <dd className="font-display text-3xl font-bold">{s.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function AreaCard({ a }: { a: AreaResult }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <CardTitle>{AREA_SHORT[a.area]}</CardTitle>
        <Badge tone="highlight">Estimativa</Badge>
      </div>
      {a.tri ? (
        <>
          <p className="mt-3 text-sm text-muted">Nota TRI estimada</p>
          <p className="font-display text-5xl font-bold tabular-nums">
            {Math.round(a.tri.score)}
            <span className="ml-2 text-base font-medium text-muted">
              ± {Math.round(a.tri.standardError)}
            </span>
          </p>
        </>
      ) : (
        <p className="mt-3 text-sm text-muted">
          Sem nota TRI: são necessárias pelo menos 5 questões com parâmetros do INEP nesta área
          (esta tem {a.itemsWithParams}).
        </p>
      )}
      <p className="mt-3 text-sm">
        {a.correct} de {a.total} acertos
        {a.blank > 0 && `, ${a.blank} em branco`}
        {a.coherence !== null && ` · coerência ${Math.round(a.coherence * 100)}%`}
      </p>
    </Card>
  );
}

function TriDisclaimer() {
  return (
    <p className="flex gap-2 text-sm text-muted">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        Estimativa com o modelo TRI de 3 parâmetros (EAP) e os parâmetros divulgados pelo INEP,
        convertida para a escala do ENEM (média 500, desvio 100). A nota oficial é calculada pelo
        INEP com a prova completa e varia por área e edição, então use este valor como referência,
        não como nota oficial.
      </span>
    </p>
  );
}

function SubjectChart({ r }: { r: AttemptResult }) {
  const data = r.bySubject.map((s) => ({
    subject: s.subject,
    Acertos: s.correct,
    Erros: s.total - s.correct - s.blank,
    'Em branco': s.blank,
  }));
  if (data.length === 0) return null;
  return (
    <section aria-labelledby="subj-title" className="space-y-3">
      <h2 id="subj-title" className="text-2xl">
        Desempenho por matéria
      </h2>
      <Card>
        <div
          role="img"
          aria-label="Gráfico de barras com acertos, erros e questões em branco por matéria"
        >
          <ResponsiveContainer width="100%" height={Math.max(160, data.length * 48 + 70)}>
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid stroke="var(--border-soft)" horizontal={false} />
              <XAxis
                type="number"
                allowDecimals={false}
                stroke="var(--muted)"
                tick={{ fill: 'var(--ink)', fontSize: 12 }}
              />
              <YAxis
                type="category"
                dataKey="subject"
                width={110}
                stroke="var(--muted)"
                tick={{ fill: 'var(--ink)', fontSize: 12 }}
              />
              <Tooltip
                cursor={{ fill: 'var(--surface-2)' }}
                contentStyle={{
                  background: 'var(--surface)',
                  border: '2px solid var(--border)',
                  borderRadius: 12,
                  color: 'var(--ink)',
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 12 }}
                formatter={(v: string) => <span style={{ color: 'var(--ink)' }}>{v}</span>}
              />
              <Bar dataKey="Acertos" stackId="s" fill="var(--success)" />
              <Bar dataKey="Erros" stackId="s" fill="var(--danger)" />
              <Bar dataKey="Em branco" stackId="s" fill="var(--muted)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <table className="sr-only">
          <caption>Desempenho por matéria</caption>
          <thead>
            <tr>
              <th>Matéria</th>
              <th>Acertos</th>
              <th>Erros</th>
              <th>Em branco</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.subject}>
                <td>{d.subject}</td>
                <td>{d.Acertos}</td>
                <td>{d.Erros}</td>
                <td>{d['Em branco']}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </section>
  );
}

function CoherenceCard({ r }: { r: AttemptResult }) {
  return (
    <section aria-labelledby="coh-title">
      <Card>
        <h2 id="coh-title" className="text-2xl">
          Coerência pedagógica
        </h2>
        {r.coherence !== null ? (
          <p className="mt-2 font-display text-4xl font-bold tabular-nums">
            {Math.round(r.coherence * 100)}%
          </p>
        ) : (
          <p className="mt-2 text-muted">
            Indisponível: há poucas questões com parâmetros TRI neste simulado.
          </p>
        )}
        <div className="mt-3 space-y-2 text-sm text-muted">
          <p>
            Na TRI, errar questões fáceis e acertar difíceis é um sinal de chute, e a nota pesa
            isso: duas pessoas com o mesmo número de acertos podem ter notas bem diferentes. O
            indicador mede quantos pares (questão fácil errada, questão difícil certa) existiram,
            comparado ao máximo possível.
          </p>
          <p>
            100% significa que você acertou as mais fáceis e errou as mais difíceis. Valores baixos
            indicam que os acertos vieram de questões difíceis enquanto fáceis ficaram para trás
            (falta de atenção, ou acertos no chute).
          </p>
        </div>
      </Card>
    </section>
  );
}

type Filter = 'all' | QuestionOutcome;
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'wrong', label: 'Erradas' },
  { id: 'blank', label: 'Em branco' },
  { id: 'correct', label: 'Certas' },
];

function Review({ r }: { r: AttemptResult }) {
  const [filter, setFilter] = useState<Filter>('wrong');
  const counts = useMemo(
    () => ({ all: r.total, wrong: r.wrong, blank: r.blank, correct: r.correct }),
    [r],
  );
  const shown = useMemo(
    () => (filter === 'all' ? r.questions : r.questions.filter((q) => q.outcome === filter)),
    [r.questions, filter],
  );
  return (
    <section aria-labelledby="rev-title" className="space-y-4">
      <h2 id="rev-title" className="text-2xl">
        Revisão questão a questão
      </h2>
      <div role="group" aria-label="Filtrar questões" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              'rounded-full border-2 border-line px-3.5 py-1.5 text-sm font-semibold transition-colors',
              filter === f.id ? 'bg-primary text-primary-ink' : 'bg-surface hover:bg-surface-2',
            )}
          >
            {f.label} ({counts[f.id]})
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <EmptyState title="Nenhuma questão neste filtro" />
      ) : (
        <ul className="space-y-3">
          {shown.map((q) => (
            <ReviewItem key={q.id} q={q} />
          ))}
        </ul>
      )}
    </section>
  );
}

const OUTCOME_UI: Record<
  QuestionOutcome,
  { label: string; tone: 'success' | 'danger' | 'neutral' }
> = {
  correct: { label: 'Certa', tone: 'success' },
  wrong: { label: 'Errada', tone: 'danger' },
  blank: { label: 'Em branco', tone: 'neutral' },
};

function ReviewItem({ q }: { q: ResultQuestion }) {
  const ui = OUTCOME_UI[q.outcome];
  const Icon = q.outcome === 'correct' ? Check : q.outcome === 'wrong' ? X : Minus;
  return (
    <li>
      <details className="group rounded-2xl border-2 border-line bg-surface">
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 p-4 [&::-webkit-details-marker]:hidden">
          <span className="font-display text-lg font-bold">Questão {q.position}</span>
          <Badge tone={ui.tone}>
            <Icon className="size-3" aria-hidden /> {ui.label}
          </Badge>
          {q.subject && <Badge>{q.subject}</Badge>}
          <span className="ml-auto flex items-center gap-3 text-sm text-muted">
            <span>
              Sua resposta: <strong className="text-ink">{q.chosenLetter ?? '-'}</strong> ·
              Gabarito: <strong className="text-ink">{q.correctLetter ?? '?'}</strong>
            </span>
            {q.timeSpentMs > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="size-3.5" aria-hidden />
                {formatDuration(q.timeSpentMs)}
              </span>
            )}
          </span>
        </summary>
        <div className="space-y-5 border-t-2 border-line-soft p-4 sm:p-5">
          <QuestionView
            name={`rev-${q.id}`}
            question={q}
            selected={q.chosenLetter}
            correctLetter={q.correctLetter}
            readOnly
          />
          {q.resolution && (
            <div className="rounded-xl border-2 border-line-soft bg-surface-2 p-4">
              <p className="mb-2 font-semibold">Resolução</p>
              <RichText>{q.resolution}</RichText>
            </div>
          )}
        </div>
      </details>
    </li>
  );
}
