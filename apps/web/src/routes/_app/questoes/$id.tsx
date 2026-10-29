import { useEffect } from 'react';
import { Link, createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, FileQuestion } from 'lucide-react';
import { QuestionCard, usePractice } from '@/components/question';
import { Button, Card, EmptyState, Skeleton, buttonClasses } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { useSession } from '@/lib/auth-client';
import { questionQuery } from '@/lib/questions';

export const Route = createFileRoute('/_app/questoes/$id')({
  component: QuestionPage,
});

/** Página de uma questão (compartilhável). */
function QuestionPage() {
  const { id } = Route.useParams();
  const { data: session } = useSession();
  const q = useQuery(questionQuery(id, session?.user.id ?? null));
  const practice = usePractice();

  useEffect(() => {
    if (!q.data) return;
    practice.markShown(q.data.id);
    const prev = document.title;
    document.title = `${q.data.institution} ${q.data.year} · ${q.data.subject} — freenem`;
    return () => {
      document.title = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data?.id]);

  const entry = q.data ? practice.entries[q.data.id] : undefined;

  // Enter responde
  useEffect(() => {
    if (!q.data) return;
    const qid = q.data.id;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) void practice.submit(qid);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [q.data, practice]);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link to="/questoes" className={buttonClasses('ghost', 'sm')}>
        <ArrowLeft className="size-4" aria-hidden />
        Banco de questões
      </Link>

      {q.isPending ? (
        <Card className="space-y-4">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-40 w-full" />
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </Card>
      ) : q.isError ? (
        <EmptyState
          icon={<FileQuestion />}
          title={
            q.error instanceof ApiError && q.error.status === 404
              ? 'Questão não encontrada'
              : 'Não foi possível carregar a questão'
          }
          description="Ela pode ter sido removida ou ainda não foi publicada."
          action={
            <Link to="/questoes" className={buttonClasses('primary')}>
              Ver outras questões
            </Link>
          }
        />
      ) : (
        <>
          <QuestionCard {...practice.bind(q.data)} hotkeys hideLink />
          {!practice.loggedIn && entry?.result && (
            <Card className="flex flex-wrap items-center justify-between gap-3 bg-highlight/30 p-4 sm:p-4">
              <p className="text-sm font-medium">
                Entre na sua conta para salvar seu progresso e acompanhar seu desempenho.
              </p>
              <Link
                to="/entrar"
                search={{ redirect: `/questoes/${id}` }}
                className={buttonClasses('primary', 'sm')}
              >
                Entrar
              </Link>
            </Card>
          )}
          <Link to="/questoes" className="block">
            <Button variant="secondary" className="w-full">
              Resolver mais questões
            </Button>
          </Link>
        </>
      )}
    </div>
  );
}
