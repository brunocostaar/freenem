import { Link, createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BookOpenCheck,
  CalendarCheck,
  ClipboardList,
  Flame,
  PenLine,
  type LucideIcon,
} from 'lucide-react';
import { Badge, buttonClasses, Card, CardTitle, Skeleton } from '@/components/ui';
import { AppLink } from '@/components/AppLink';
import { useSession } from '@/lib/auth-client';
import {
  formatDuration,
  formatMinutes,
  formatPercent,
  overviewQuery,
  studyPlanQuery,
} from '@/lib/insights';
import { cn } from '@/lib/cn';

export const Route = createFileRoute('/_app/_auth/inicio')({ component: Inicio });

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

const ACTIONS: {
  to: '/questoes' | '/simulados' | '/redacao';
  label: string;
  hint: string;
  icon: LucideIcon;
  tone: string;
}[] = [
  {
    to: '/questoes',
    label: 'Continuar questões',
    hint: 'Treine por matéria e assunto',
    icon: BookOpenCheck,
    tone: 'bg-highlight text-[#14213d]',
  },
  {
    to: '/simulados',
    label: 'Novo simulado',
    hint: 'Com nota TRI',
    icon: ClipboardList,
    tone: 'bg-primary text-primary-ink',
  },
  {
    to: '/redacao',
    label: 'Escrever redação',
    hint: 'Correção por IA',
    icon: PenLine,
    tone: 'bg-accent text-accent-ink',
  },
];

function Inicio() {
  const { data: session } = useSession();
  const overview = useQuery(overviewQuery('7d'));
  const planQ = useQuery(studyPlanQuery);
  const firstName = session?.user.name.split(' ')[0] ?? '';
  const stats = overview.data;
  const plan = planQ.data?.plan ?? null;

  const week = plan?.weeks.find((w) => w.isCurrent);
  const pending = week?.items.filter((i) => !i.done) ?? [];
  const today = stats?.activity.at(-1);
  const answeredToday =
    today && today.date === new Date().toLocaleDateString('en-CA') ? today.total : 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl">
            {greeting()}, <span className="marker">{firstName || 'estudante'}</span>!
          </h1>
          <p className="mt-2 text-muted">
            {plan
              ? plan.daysUntilExam > 0
                ? `Faltam ${plan.daysUntilExam} dias para a prova. Um passo de cada vez.`
                : 'Dia de prova. Você se preparou, boa sorte!'
              : 'Vamos estudar um pouco hoje?'}
          </p>
        </div>
        {stats && (
          <Badge tone={stats.streakDays > 0 ? 'accent' : 'neutral'} className="px-3 py-1.5 text-sm">
            <Flame className="size-4" aria-hidden />
            {stats.streakDays > 0
              ? `${stats.streakDays} ${stats.streakDays === 1 ? 'dia seguido' : 'dias seguidos'}`
              : 'Comece sua sequência hoje'}
          </Badge>
        )}
      </header>

      <section aria-label="Ações rápidas" className="grid gap-4 sm:grid-cols-3">
        {ACTIONS.map((a) => (
          <Link key={a.to} to={a.to} className="group">
            <Card className="flex h-full items-center gap-3 p-4 transition-transform group-hover:-translate-y-1">
              <div
                className={cn(
                  'grid size-12 shrink-0 place-items-center rounded-xl border-2 border-line shadow-hard-sm',
                  a.tone,
                )}
              >
                <a.icon className="size-6" aria-hidden />
              </div>
              <div>
                <p className="font-display text-lg leading-tight font-bold">{a.label}</p>
                <p className="text-sm text-muted">{a.hint}</p>
              </div>
            </Card>
          </Link>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <CalendarCheck className="size-5" aria-hidden /> Para fazer esta semana
            </CardTitle>
            {plan && (
              <Link to="/plano" className="text-sm font-semibold underline">
                Ver plano
              </Link>
            )}
          </div>
          {planQ.isLoading ? (
            <Skeleton className="h-32" />
          ) : !plan ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-muted">
                Crie um plano semanal com base na data da prova e nos seus pontos fracos.
              </p>
              <Link to="/plano" className={buttonClasses('accent', 'sm')}>
                Criar plano de estudos <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
          ) : pending.length === 0 ? (
            <p className="text-muted">
              Tudo em dia nesta semana. Que tal resolver mais algumas questões?
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {pending.slice(0, 4).map((i) => (
                <li
                  key={i.id}
                  className="flex items-center justify-between gap-3 rounded-xl border-2 border-line-soft p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {i.topicName ??
                        (i.kind === 'essay' ? 'Redação da semana' : 'Simulado da semana')}
                    </p>
                    <p className="text-sm text-muted">
                      {
                        {
                          theory: 'Teoria',
                          questions: 'Questões',
                          review: 'Revisão',
                          simulado: 'Simulado',
                          essay: 'Redação',
                        }[i.kind]
                      }{' '}
                      · {formatMinutes(i.minutes)}
                    </p>
                  </div>
                  <AppLink href={i.href} className={buttonClasses('secondary', 'sm')}>
                    Começar
                  </AppLink>
                </li>
              ))}
              {pending.length > 4 && (
                <li className="text-sm text-muted">e mais {pending.length - 4} itens no plano</li>
              )}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle className="mb-4">Últimos 7 dias</CardTitle>
          {overview.isLoading ? (
            <Skeleton className="h-32" />
          ) : stats && stats.lifetimeAnswers > 0 ? (
            <dl className="grid grid-cols-2 gap-4">
              <Mini label="Questões" value={String(stats.totalAnswers)} />
              <Mini
                label="Acerto"
                value={stats.totalAnswers ? formatPercent(stats.accuracy) : '—'}
              />
              <Mini label="Tempo" value={formatDuration(stats.timeStudiedMs)} />
              <Mini label="Hoje" value={`${answeredToday} questões`} />
            </dl>
          ) : (
            <div className="flex flex-col items-start gap-3">
              <p className="text-muted">
                Resolva sua primeira questão e acompanhe sua evolução aqui.
              </p>
              <Link to="/questoes" className={buttonClasses('primary', 'sm')}>
                Resolver agora
              </Link>
            </div>
          )}
          {stats && stats.lifetimeAnswers > 0 && (
            <Link to="/desempenho" className="mt-4 inline-block text-sm font-semibold underline">
              Ver desempenho completo
            </Link>
          )}
        </Card>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="font-display text-2xl font-extrabold">{value}</dd>
    </div>
  );
}
