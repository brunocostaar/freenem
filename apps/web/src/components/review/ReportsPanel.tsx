import { Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Inbox, PencilLine, X } from 'lucide-react';
import {
  REPORT_KIND_LABELS,
  reportListResponseSchema,
  type ReportGroup,
  type ReportItem,
  type ReportStatus,
} from '@freenem/shared';
import { Badge, Button, Card, EmptyState, Skeleton, useToast } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';

export const reportsQuery = (status: ReportStatus) => ({
  queryKey: ['review', 'reports', status],
  queryFn: () =>
    api('/api/v1/review/reports', { query: { status }, schema: reportListResponseSchema }),
});

const STATUS_TABS: { value: ReportStatus; label: string }[] = [
  { value: 'open', label: 'Abertos' },
  { value: 'resolved', label: 'Resolvidos' },
  { value: 'dismissed', label: 'Descartados' },
];

const QUESTION_STATUS_LABEL = { draft: 'Rascunho', reviewed: 'Revisada', published: 'Publicada' };

/** Aba "Reportes" da revisão: reportes dos alunos agrupados por questão. */
export function ReportsPanel({
  status,
  onStatusChange,
}: {
  status: ReportStatus;
  onStatusChange: (s: ReportStatus) => void;
}) {
  const q = useQuery(reportsQuery(status));

  return (
    <section aria-label="Reportes" className="space-y-4">
      <div
        role="tablist"
        aria-label="Status do reporte"
        className="grid max-w-md grid-cols-3 gap-1.5"
      >
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={status === t.value}
            onClick={() => onStatusChange(t.value)}
            className={cn(
              'h-10 rounded-lg border-2 px-1 text-sm font-semibold',
              status === t.value
                ? 'border-line bg-highlight text-[#14213d] shadow-hard-sm'
                : 'border-line-soft hover:bg-surface-2',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {q.isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : q.isError ? (
        <EmptyState title="Não foi possível carregar os reportes" />
      ) : q.data.groups.length === 0 ? (
        <EmptyState
          icon={<Inbox />}
          title="Nenhum reporte aqui"
          description="Quando alunos reportarem erros nas questões, eles aparecem nesta lista."
        />
      ) : (
        <ul className="space-y-4">
          {q.data.groups.map((g) => (
            <li key={g.question.id}>
              <ReportGroupCard group={g} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ReportGroupCard({ group }: { group: ReportGroup }) {
  const { question: qs } = group;
  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="primary">
              {qs.institution} {qs.year}
            </Badge>
            {qs.number !== null && <Badge>Q{qs.number}</Badge>}
            {qs.subject && <Badge tone="accent">{qs.subject}</Badge>}
            <Badge tone={qs.status === 'published' ? 'success' : 'highlight'}>
              {QUESTION_STATUS_LABEL[qs.status]}
            </Badge>
            <Badge tone={group.openCount > 0 ? 'danger' : 'neutral'}>
              {group.openCount} {group.openCount === 1 ? 'reporte aberto' : 'reportes abertos'}
            </Badge>
          </div>
          <p className="line-clamp-2 text-sm text-muted">{qs.excerpt}</p>
        </div>
        <Link
          to="/admin/revisao"
          search={{ id: qs.id }}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border-2 border-line bg-surface px-3 text-sm font-semibold shadow-hard-sm hover:bg-surface-2"
        >
          <PencilLine className="size-4" aria-hidden /> Abrir no editor
        </Link>
      </div>
      <ul className="space-y-2">
        {group.reports.map((r) => (
          <li key={r.id}>
            <ReportRow report={r} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ReportRow({ report }: { report: ReportItem }) {
  const qc = useQueryClient();
  const toast = useToast();
  const close = useMutation({
    mutationFn: (status: 'resolved' | 'dismissed') =>
      api(`/api/v1/review/reports/${report.id}`, { method: 'PATCH', body: { status } }),
    onSuccess: (_d, status) => {
      toast.success(status === 'resolved' ? 'Reporte resolvido.' : 'Reporte descartado.');
      void qc.invalidateQueries({ queryKey: ['review', 'reports'] });
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível atualizar o reporte.'),
  });

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-line-soft p-3">
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{REPORT_KIND_LABELS[report.kind]}</p>
        {report.message && <p className="mt-0.5 text-sm break-words">{report.message}</p>}
        <p className="mt-1 text-xs text-muted">
          {report.userName} · {new Date(report.createdAt).toLocaleDateString('pt-BR')}
        </p>
      </div>
      {report.status === 'open' && (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={close.isPending}
            onClick={() => close.mutate('resolved')}
          >
            <Check className="size-4" aria-hidden /> Resolver
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={close.isPending}
            onClick={() => close.mutate('dismissed')}
          >
            <X className="size-4" aria-hidden /> Descartar
          </Button>
        </div>
      )}
    </div>
  );
}
