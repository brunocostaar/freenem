import { createFileRoute } from '@tanstack/react-router';
import { BarChart3 } from 'lucide-react';
import { EmptyState } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';

export const Route = createFileRoute('/_app/_auth/desempenho')({
  component: () => (
    <>
      <PageHeader
        title="Desempenho"
        description="Acompanhe acertos por matéria e assunto, e sua evolução."
      />
      <EmptyState
        icon={<BarChart3 />}
        title="Em construção"
        description="Esta área chega nas próximas fases do projeto."
      />
    </>
  ),
});
