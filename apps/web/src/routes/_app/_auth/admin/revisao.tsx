import { createFileRoute, redirect } from '@tanstack/react-router';
import { meQuery } from '@/lib/queries';
import { ShieldCheck } from 'lucide-react';
import { EmptyState } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';

export const Route = createFileRoute('/_app/_auth/admin/revisao')({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (me?.role !== 'admin' && me?.role !== 'reviewer') throw redirect({ to: '/questoes' });
  },
  component: () => (
    <>
      <PageHeader
        title="Revisão de questões"
        description="Fila de questões importadas aguardando revisão."
      />
      <EmptyState
        icon={<ShieldCheck />}
        title="Em construção"
        description="Esta área chega nas próximas fases do projeto."
      />
    </>
  ),
});
