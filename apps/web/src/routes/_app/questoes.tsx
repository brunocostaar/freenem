import { createFileRoute } from '@tanstack/react-router';
import { BookOpenCheck } from 'lucide-react';
import { EmptyState } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';

export const Route = createFileRoute('/_app/questoes')({
  component: () => (
    <>
      <PageHeader
        title="Banco de questões"
        description="Resolva questões do ENEM e de vestibulares, filtradas por matéria e assunto."
      />
      <EmptyState
        icon={<BookOpenCheck />}
        title="Em construção"
        description="Esta área chega nas próximas fases do projeto."
      />
    </>
  ),
});
