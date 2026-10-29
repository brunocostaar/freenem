import { Link, createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { EssayResultView } from '@/components/essays/EssayResultView';
import { EssayWorkspace } from '@/components/essays/EssayWorkspace';
import { Card, EmptyState, Skeleton, buttonClasses } from '@/components/ui';
import { essayQuery } from '@/lib/essays';
import { ApiError } from '@/lib/api';

export const Route = createFileRoute('/_app/_auth/redacao/$id')({ component: RedacaoPage });

function RedacaoPage() {
  const { id } = Route.useParams();
  const { data: essay, isLoading, error } = useQuery(essayQuery(id));

  if (isLoading) return <Skeleton className="h-96" />;
  if (!essay) {
    return (
      <EmptyState
        title={
          error instanceof ApiError && error.status === 404
            ? 'Redação não encontrada'
            : 'Não foi possível carregar a redação'
        }
        action={
          <Link to="/redacao" className={buttonClasses('primary')}>
            Voltar para redações
          </Link>
        }
      />
    );
  }

  const back = (
    <Link to="/redacao" className={buttonClasses('ghost', 'sm')}>
      <ArrowLeft className="size-4" aria-hidden /> Redações
    </Link>
  );

  if (essay.isDraft) {
    return (
      <>
        <PageHeader
          title="Rascunho"
          description="Seu texto é salvo automaticamente."
          actions={back}
        />
        <EssayWorkspace
          key={essay.id}
          essayId={essay.id}
          themeId={essay.themeId}
          themeTitle={essay.themeTitle}
          supportingTexts={essay.themeSupportingTexts}
          initialText={essay.text}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Resultado" description={essay.themeTitle} actions={back} />
      <div className="flex flex-col gap-8">
        <EssayResultView essay={essay} />
        <section aria-labelledby="texto-titulo">
          <h2 id="texto-titulo" className="mb-3 text-2xl">
            Seu texto
          </h2>
          <Card>
            <p className="paper whitespace-pre-wrap">{essay.text}</p>
          </Card>
        </section>
      </div>
    </>
  );
}
