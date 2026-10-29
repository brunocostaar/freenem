import { createFileRoute } from '@tanstack/react-router';
import { PenLine } from 'lucide-react';
import { EmptyState } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';

export const Route = createFileRoute('/_app/_auth/redacao')({
  component: () => (
    <>
      <PageHeader
        title="Redação"
        description="Escreva e receba correção por competência, com IA."
      />
      <EmptyState
        icon={<PenLine />}
        title="Em construção"
        description="Esta área chega nas próximas fases do projeto."
      />
    </>
  ),
});
