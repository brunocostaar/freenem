import { Link, createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { PageHeader } from '@/components/layout/PageHeader';
import { EssayWorkspace } from '@/components/essays/EssayWorkspace';
import { EmptyState, Skeleton, buttonClasses } from '@/components/ui';
import { essayThemesQuery } from '@/lib/essays';

export const Route = createFileRoute('/_app/_auth/redacao/nova')({
  validateSearch: z.object({ tema: z.string().uuid().optional() }),
  component: NovaRedacao,
});

function NovaRedacao() {
  const { tema } = Route.useSearch();
  const themes = useQuery(essayThemesQuery);
  const theme = themes.data?.items.find((t) => t.id === tema);

  return (
    <>
      <PageHeader title="Nova redação" description="Seu rascunho é salvo automaticamente." />
      {themes.isLoading ? (
        <Skeleton className="h-96" />
      ) : !theme ? (
        <EmptyState
          title="Tema não encontrado"
          description="Escolha um tema para começar a escrever."
          action={
            <Link to="/redacao" className={buttonClasses('primary')}>
              Ver temas
            </Link>
          }
        />
      ) : (
        <EssayWorkspace
          key={theme.id}
          themeId={theme.id}
          themeTitle={theme.title}
          supportingTexts={theme.supportingTexts}
          initialText=""
        />
      )}
    </>
  );
}
