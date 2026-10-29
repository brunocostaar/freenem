import { createFileRoute } from '@tanstack/react-router';
import { ClipboardList } from 'lucide-react';
import { EmptyState } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';

export const Route = createFileRoute('/_app/_auth/simulados')({
  component: () => (
    <>
      <PageHeader
        title="Simulados"
        description="Monte simulados personalizados ou refaça provas oficiais com nota TRI."
      />
      <EmptyState
        icon={<ClipboardList />}
        title="Em construção"
        description="Esta área chega nas próximas fases do projeto."
      />
    </>
  ),
});
