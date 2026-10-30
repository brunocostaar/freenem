import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  SearchX,
  SlidersHorizontal,
  Target,
} from 'lucide-react';
import { questionSearchSchema, type QuestionSearch } from '@freenem/shared';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  QuestionCard,
  QuestionFilters,
  hasActiveFilters,
  isTypingTarget,
  usePractice,
} from '@/components/question';
import { Button, Card, EmptyState, Sheet, Skeleton, buttonClasses } from '@/components/ui';
import { useSession } from '@/lib/auth-client';
import { cn } from '@/lib/cn';
import { catalogQuery, questionsInfiniteQuery } from '@/lib/questions';

export const Route = createFileRoute('/_app/questoes/')({
  head: () => ({ meta: [{ title: 'Questões · freenem' }] }),
  validateSearch: questionSearchSchema,
  component: QuestionsPage,
});

function QuestionsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data: session } = useSession();
  const userId = session?.user.id ?? null;
  const view = search.view ?? 'focus';

  const catalog = useQuery(catalogQuery);
  const list = useInfiniteQuery(questionsInfiniteQuery(search, userId));
  const practice = usePractice();

  const [cursor, setCursor] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [promptDismissed, setPromptDismissed] = useState(false);

  const items = useMemo(() => list.data?.pages.flatMap((p) => p.items) ?? [], [list.data]);
  const total = list.data?.pages[0]?.total ?? 0;
  const current = items[Math.min(cursor, Math.max(items.length - 1, 0))];

  const update = useCallback(
    (patch: Partial<QuestionSearch>) => {
      setCursor(0);
      void navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });
    },
    [navigate],
  );
  const reset = useCallback(() => {
    setCursor(0);
    void navigate({ search: (prev) => ({ view: prev.view }), replace: true });
  }, [navigate]);

  const goTo = useCallback(
    (next: number) => {
      const target = Math.max(0, Math.min(next, items.length - 1));
      setCursor(target);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      // pré-carrega a próxima página quando faltam poucas
      if (target >= items.length - 3 && list.hasNextPage && !list.isFetchingNextPage) {
        void list.fetchNextPage();
      }
    },
    [items.length, list],
  );

  // registra o instante em que a questão do modo foco apareceu
  useEffect(() => {
    if (view === 'focus' && current) practice.markShown(current.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, current?.id]);

  // atalhos do modo foco: J/K ou setas navegam, Enter responde / avança
  useEffect(() => {
    if (view !== 'focus') return;
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      if (document.querySelector('dialog[open]')) return;
      if (e.key === 'j' || e.key === 'ArrowRight') goTo(cursor + 1);
      else if (e.key === 'k' || e.key === 'ArrowLeft') goTo(cursor - 1);
      else if (e.key === 'Enter' && current) {
        const entry = practice.entries[current.id];
        if (entry?.result) goTo(cursor + 1);
        else if (entry?.selected) void practice.submit(current.id);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, cursor, current, goTo, practice]);

  const anyAnswered = Object.values(practice.entries).some((e) => e.result);
  const showLoginPrompt = !practice.loggedIn && anyAnswered && !promptDismissed;

  const filters = (
    <QuestionFilters
      value={search}
      onChange={update}
      onReset={reset}
      catalog={catalog.data}
      loggedIn={practice.loggedIn}
    />
  );

  return (
    <>
      <PageHeader
        title="Banco de questões"
        description="Resolva questões do ENEM e de vestibulares, filtradas por matéria e assunto."
        actions={
          <div
            role="group"
            aria-label="Modo de visualização"
            className="flex rounded-xl border-2 border-line bg-surface p-1"
          >
            {(
              [
                ['focus', 'Foco', Target],
                ['list', 'Lista', ListChecks],
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                aria-pressed={view === key}
                onClick={() => update({ view: key === 'focus' ? undefined : key })}
                className={cn(
                  'flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold',
                  view === key ? 'bg-primary text-primary-ink' : 'hover:bg-surface-2',
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <aside className="hidden lg:block">
          <Card className="sticky top-6 max-h-[calc(100dvh-3rem)] overflow-y-auto">{filters}</Card>
        </aside>

        <section aria-label="Questões" className="min-w-0 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted" aria-live="polite">
              {list.isPending
                ? 'Carregando…'
                : `${total.toLocaleString('pt-BR')} ${total === 1 ? 'questão' : 'questões'}`}
              {hasActiveFilters(search) && ' com os filtros atuais'}
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="lg:hidden"
              onClick={() => setFiltersOpen(true)}
            >
              <SlidersHorizontal className="size-4" aria-hidden />
              Filtros
            </Button>
          </div>

          {showLoginPrompt && (
            <Card className="flex flex-wrap items-center justify-between gap-3 bg-highlight/30 p-4 sm:p-4">
              <p className="max-w-xl text-sm font-medium">
                Gostou? Entre na sua conta (é grátis) para salvar seu progresso, ver seu desempenho
                e revisar as questões que errou.
              </p>
              <div className="flex gap-2">
                <Link
                  to="/entrar"
                  search={{ redirect: '/questoes' }}
                  className={buttonClasses('primary', 'sm')}
                >
                  Entrar
                </Link>
                <Button size="sm" variant="ghost" onClick={() => setPromptDismissed(true)}>
                  Agora não
                </Button>
              </div>
            </Card>
          )}

          {list.isPending ? (
            <Card className="space-y-4">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-40 w-full" />
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </Card>
          ) : list.isError ? (
            <EmptyState
              icon={<AlertTriangle />}
              title="Não foi possível carregar as questões"
              description="Verifique sua conexão e tente novamente."
              action={<Button onClick={() => void list.refetch()}>Tentar novamente</Button>}
            />
          ) : items.length === 0 ? (
            <EmptyState
              icon={<SearchX />}
              title="Nenhuma questão encontrada"
              description="Tente remover alguns filtros ou buscar por outro termo."
              action={
                hasActiveFilters(search) ? (
                  <Button onClick={reset}>Limpar filtros</Button>
                ) : undefined
              }
            />
          ) : view === 'focus' && current ? (
            <div className="space-y-4">
              <QuestionCard
                key={current.id}
                {...practice.bind(current)}
                hotkeys
                footer={
                  <nav
                    aria-label="Navegação entre questões"
                    className="flex items-center justify-between gap-3 border-t-2 border-line-soft pt-4"
                  >
                    <Button
                      variant="secondary"
                      onClick={() => goTo(cursor - 1)}
                      disabled={cursor === 0}
                      aria-keyshortcuts="K ArrowLeft"
                    >
                      <ChevronLeft className="size-5" aria-hidden />
                      Anterior
                    </Button>
                    <span className="text-sm font-semibold whitespace-nowrap tabular-nums">
                      {cursor + 1} de {total.toLocaleString('pt-BR')}
                    </span>
                    <Button
                      variant={practice.entries[current.id]?.result ? 'primary' : 'secondary'}
                      onClick={() => goTo(cursor + 1)}
                      disabled={cursor >= items.length - 1 && !list.hasNextPage}
                      loading={list.isFetchingNextPage}
                      aria-keyshortcuts="J ArrowRight"
                    >
                      Próxima
                      <ChevronRight className="size-5" aria-hidden />
                    </Button>
                  </nav>
                }
              />
              <p className="hidden text-center text-xs text-muted sm:block">
                Atalhos: <kbd>A</kbd>–<kbd>E</kbd> marcam · <kbd>Enter</kbd> responde e avança ·{' '}
                <kbd>J</kbd>/<kbd>K</kbd> ou setas navegam
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {items.map((q) => (
                <QuestionCard key={q.id} {...practice.bind(q)} />
              ))}
              {list.hasNextPage && (
                <div className="flex justify-center">
                  <Button
                    variant="secondary"
                    loading={list.isFetchingNextPage}
                    onClick={() => void list.fetchNextPage()}
                  >
                    Carregar mais questões
                  </Button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      <Sheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filtros"
        side="bottom"
        className="max-h-[88dvh] overflow-y-auto"
      >
        {filtersOpen && (
          <div className="space-y-4">
            {filters}
            <Button className="w-full" onClick={() => setFiltersOpen(false)}>
              Ver {total.toLocaleString('pt-BR')} {total === 1 ? 'questão' : 'questões'}
            </Button>
          </div>
        )}
      </Sheet>
    </>
  );
}
