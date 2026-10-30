import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, CalendarCheck, Dices, PenLine } from 'lucide-react';
import type { EssayListItem } from '@freenem/shared';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, EmptyState, Skeleton, buttonClasses } from '@/components/ui';
import { essayListQuery, essayQuotaQuery, essayThemesQuery, formatDateTime } from '@/lib/essays';

export const Route = createFileRoute('/_app/_auth/redacao/')({
  head: () => ({ meta: [{ title: 'Redação · freenem' }] }),
  component: RedacaoPage,
});

function statusBadge(e: EssayListItem) {
  if (e.isDraft) return <Badge>Rascunho</Badge>;
  if (e.status === 'corrected') return <Badge tone="success">Corrigida</Badge>;
  if (e.status === 'flagged') return <Badge tone="danger">Sinalizada</Badge>;
  if (e.status === 'failed') return <Badge tone="danger">Falhou</Badge>;
  return <Badge tone="highlight">Corrigindo</Badge>;
}

function RedacaoPage() {
  const navigate = useNavigate();
  const themes = useQuery(essayThemesQuery);
  const quota = useQuery(essayQuotaQuery);
  const essays = useQuery(essayListQuery);

  function randomTheme() {
    const items = themes.data?.items ?? [];
    if (items.length === 0) return;
    const t = items[Math.floor(Math.random() * items.length)]!;
    void navigate({ to: '/redacao/nova', search: { tema: t.id } });
  }

  return (
    <>
      <PageHeader
        title="Redação"
        description="Escreva na folha de redação e receba correção por competência, com IA."
        actions={
          <Link to="/redacao/competencias" className={buttonClasses('secondary', 'sm')}>
            <BookOpen className="size-4" aria-hidden /> As 5 competências
          </Link>
        }
      />

      <Card className="mb-6 flex flex-wrap items-center gap-3" aria-live="polite">
        <CalendarCheck className="size-6 shrink-0" aria-hidden />
        {quota.isLoading ? (
          <Skeleton className="h-6 w-64" />
        ) : quota.data?.availableToday ? (
          <p>
            <strong>Sua correção de hoje está disponível.</strong> Você tem 1 correção por dia.
          </p>
        ) : quota.data?.nextAvailableAt ? (
          <p>
            <strong>Você já usou a correção de hoje.</strong> Próxima disponível em{' '}
            {formatDateTime(quota.data.nextAvailableAt)}. Dá para continuar escrevendo rascunhos.
          </p>
        ) : (
          <p>Não foi possível carregar sua cota de correções.</p>
        )}
        {quota.data && !quota.data.aiEnabled && <Badge tone="highlight">Modo demonstração</Badge>}
      </Card>

      <section aria-labelledby="temas-titulo" className="mb-10">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="temas-titulo" className="text-2xl">
            Escolha um tema
          </h2>
          <Button variant="accent" size="sm" onClick={randomTheme} disabled={!themes.data}>
            <Dices className="size-4" aria-hidden /> Tema aleatório
          </Button>
        </div>
        {themes.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        ) : themes.isError ? (
          <p role="alert" className="text-danger">
            Não foi possível carregar os temas.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {themes.data?.items.map((t) => (
              <li key={t.id}>
                <Card className="flex h-full flex-col justify-between gap-3 p-4 sm:p-4">
                  <div className="flex flex-col gap-2">
                    {t.year ? <Badge className="self-start">ENEM {t.year}</Badge> : null}
                    <h3 className="text-base leading-snug">{t.title}</h3>
                  </div>
                  <Link
                    to="/redacao/nova"
                    search={{ tema: t.id }}
                    className={buttonClasses('primary', 'sm') + ' self-start'}
                  >
                    <PenLine className="size-4" aria-hidden /> Escrever
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="minhas-titulo">
        <h2 id="minhas-titulo" className="mb-3 text-2xl">
          Minhas redações
        </h2>
        {essays.isLoading ? (
          <Skeleton className="h-24" />
        ) : (essays.data?.items.length ?? 0) === 0 ? (
          <EmptyState
            icon={<PenLine />}
            title="Nenhuma redação ainda"
            description="Escolha um tema acima e comece a escrever. Seu rascunho é salvo automaticamente."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {essays.data?.items.map((e) => (
              <li key={e.id}>
                <Link
                  to="/redacao/$id"
                  params={{ id: e.id }}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-line bg-surface p-4 shadow-hard-sm transition-transform hover:-translate-y-0.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{e.themeTitle}</p>
                    <p className="text-sm text-muted">{formatDateTime(e.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {e.totalScore !== null && (
                      <span className="font-display text-2xl font-bold">{e.totalScore}</span>
                    )}
                    {statusBadge(e)}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
