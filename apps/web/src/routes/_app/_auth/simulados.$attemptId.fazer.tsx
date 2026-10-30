import { useEffect } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { attemptSessionQuery } from '@/lib/simulados';
import { ExamRunner } from '@/components/simulado/ExamRunner';
import { Skeleton, EmptyState, buttonClasses } from '@/components/ui';
import { ApiError } from '@/lib/api';

export const Route = createFileRoute('/_app/_auth/simulados/$attemptId/fazer')({
  head: () => ({ meta: [{ title: 'Simulado em andamento · freenem' }] }),
  component: FazerPage,
});

function FazerPage() {
  const { attemptId } = Route.useParams();
  const navigate = useNavigate();
  const { data, error, isPending } = useQuery(attemptSessionQuery(attemptId));
  const finished = data?.attempt.status !== undefined && data.attempt.status !== 'in_progress';

  useEffect(() => {
    if (finished) {
      void navigate({
        to: '/simulados/$attemptId/resultado',
        params: { attemptId },
        replace: true,
      });
    }
  }, [finished, navigate, attemptId]);

  if (isPending) {
    return (
      <div className="space-y-4" aria-busy>
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (error || !data) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <EmptyState
        title={notFound ? 'Simulado não encontrado' : 'Não foi possível carregar a prova'}
        description={error instanceof Error ? error.message : undefined}
        action={
          <Link to="/simulados" className={buttonClasses('primary')}>
            Voltar aos simulados
          </Link>
        }
      />
    );
  }
  if (finished) return null;
  return <ExamRunner session={data} />;
}
