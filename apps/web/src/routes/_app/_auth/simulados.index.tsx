import { useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Plus } from 'lucide-react';
import { attemptSchema, type Simulado } from '@freenem/shared';
import { z } from 'zod';
import { PageHeader } from '@/components/layout/PageHeader';
import { SimuladoBuilder } from '@/components/simulado/SimuladoBuilder';
import {
  Badge,
  Button,
  Card,
  CardTitle,
  EmptyState,
  Skeleton,
  buttonClasses,
  useToast,
} from '@/components/ui';
import { api } from '@/lib/api';
import { formatMinutes, simuladosQuery } from '@/lib/simulados';

export const Route = createFileRoute('/_app/_auth/simulados/')({
  component: SimuladosPage,
});

function SimuladosPage() {
  const [building, setBuilding] = useState(false);
  const { data, isPending, error } = useQuery(simuladosQuery);

  return (
    <>
      <PageHeader
        title="Simulados"
        description="Monte simulados personalizados ou refaça provas oficiais com nota TRI estimada."
        actions={
          <Button onClick={() => setBuilding((b) => !b)} aria-expanded={building}>
            <Plus className="size-4" aria-hidden />
            Novo simulado
          </Button>
        }
      />
      <div className="space-y-8">
        {building && <SimuladoBuilder onDone={() => setBuilding(false)} />}
        {isPending ? (
          <div className="space-y-3" aria-busy>
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : error ? (
          <p role="alert" className="text-danger">
            Não foi possível carregar seus simulados.
          </p>
        ) : data.items.length === 0 ? (
          <EmptyState
            icon={<ClipboardList />}
            title="Nenhum simulado ainda"
            description="Crie seu primeiro simulado com uma prova oficial ou com questões escolhidas por você."
            action={
              !building && (
                <Button onClick={() => setBuilding(true)}>
                  <Plus className="size-4" aria-hidden />
                  Novo simulado
                </Button>
              )
            }
          />
        ) : (
          <ul className="space-y-4">
            {data.items.map((s) => (
              <li key={s.id}>
                <SimuladoCard s={s} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function SimuladoCard({ s }: { s: Simulado }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const inProgress = s.attempts.find((a) => a.status === 'in_progress');
  const finished = s.attempts.filter((a) => a.status === 'finished');

  const start = useMutation({
    mutationFn: () =>
      api(`/api/v1/simulados/${s.id}/attempts`, {
        method: 'POST',
        body: {},
        schema: z.object({ attempt: attemptSchema }),
      }),
    onSuccess: ({ attempt }) => {
      void qc.invalidateQueries({ queryKey: ['simulados'] });
      void navigate({ to: '/simulados/$attemptId/fazer', params: { attemptId: attempt.id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Não foi possível iniciar.'),
  });

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle>{s.title}</CardTitle>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone={s.mode === 'official' ? 'primary' : 'neutral'}>
              {s.mode === 'official' ? 'Prova oficial' : 'Personalizado'}
            </Badge>
            <Badge>{s.questionCount} questões</Badge>
            <Badge>{formatMinutes(s.timeLimitMinutes)}</Badge>
            {inProgress && <Badge tone="highlight">Em andamento</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {inProgress ? (
            <Link
              to="/simulados/$attemptId/fazer"
              params={{ attemptId: inProgress.id }}
              className={buttonClasses('primary')}
            >
              Continuar
            </Link>
          ) : (
            <Button
              variant={finished.length ? 'secondary' : 'primary'}
              loading={start.isPending}
              onClick={() => start.mutate()}
            >
              {finished.length ? 'Refazer' : 'Começar'}
            </Button>
          )}
        </div>
      </div>
      {finished.length > 0 && (
        <ul className="mt-4 divide-y-2 divide-line-soft border-t-2 border-line-soft">
          {finished.slice(0, 3).map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <span className="text-sm text-muted">
                {new Date(a.finishedAt ?? a.startedAt).toLocaleString('pt-BR', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </span>
              <span className="text-sm">
                <strong>
                  {a.rawScore ?? 0}/{s.questionCount}
                </strong>{' '}
                acertos
                {a.triScore !== null && (
                  <>
                    {' '}
                    · nota estimada <strong>{Math.round(a.triScore)}</strong>
                  </>
                )}
              </span>
              <Link
                to="/simulados/$attemptId/resultado"
                params={{ attemptId: a.id }}
                className={buttonClasses('ghost', 'sm')}
              >
                Ver resultado
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
