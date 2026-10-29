import { createFileRoute } from '@tanstack/react-router';
import { CalendarCheck } from 'lucide-react';
import { EmptyState } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';

export const Route = createFileRoute('/_app/_auth/plano')({
  component: () => (
    <>
      <PageHeader
        title="Plano de estudos"
        description="Um plano semanal baseado nos seus pontos fracos e na data da prova."
      />
      <EmptyState
        icon={<CalendarCheck />}
        title="Em construção"
        description="Esta área chega nas próximas fases do projeto."
      />
    </>
  ),
});
