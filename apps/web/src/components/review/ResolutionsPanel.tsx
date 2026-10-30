import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, Check, Inbox, X } from 'lucide-react';
import {
  RESOLUTION_STATUS_LABELS,
  resolutionReviewListSchema,
  type ResolutionModeration,
  type ResolutionReviewItem,
  type ResolutionStatus,
} from '@freenem/shared';
import { RichText } from '@/components/RichText';
import { Badge, Button, Card, EmptyState, Skeleton, Textarea, useToast } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';

export const resolutionsReviewQuery = (status: ResolutionStatus) => ({
  queryKey: ['review', 'resolutions', status],
  queryFn: () =>
    api('/api/v1/review/resolutions', { query: { status }, schema: resolutionReviewListSchema }),
});

const STATUSES: ResolutionStatus[] = ['pending', 'approved', 'rejected'];
const STATUS_TAB: Record<ResolutionStatus, string> = {
  pending: 'Pendentes',
  approved: 'Aprovadas',
  rejected: 'Rejeitadas',
};

/** Aba "Resoluções" da revisão: fila de moderação das resoluções da comunidade. */
export function ResolutionsPanel({
  status,
  onStatusChange,
}: {
  status: ResolutionStatus;
  onStatusChange: (s: ResolutionStatus) => void;
}) {
  const q = useQuery(resolutionsReviewQuery(status));
  return (
    <section aria-label="Resoluções" className="space-y-4">
      <div
        role="tablist"
        aria-label="Status da resolução"
        className="grid max-w-md grid-cols-3 gap-1.5"
      >
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={status === s}
            onClick={() => onStatusChange(s)}
            className={cn(
              'h-10 rounded-lg border-2 px-1 text-sm font-semibold',
              status === s
                ? 'border-line bg-highlight text-[#14213d] shadow-hard-sm'
                : 'border-line-soft hover:bg-surface-2',
            )}
          >
            {STATUS_TAB[s]}
          </button>
        ))}
      </div>

      {q.isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : q.isError ? (
        <EmptyState title="Não foi possível carregar as resoluções" />
      ) : q.data.items.length === 0 ? (
        <EmptyState
          icon={<Inbox />}
          title="Nenhuma resolução aqui"
          description="Resoluções escritas por alunos aparecem nesta fila para aprovação."
        />
      ) : (
        <ul className="space-y-4">
          {q.data.items.map((item) => (
            <li key={item.id}>
              <ResolutionReviewCard item={item} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ResolutionReviewCard({ item }: { item: ResolutionReviewItem }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const { question: qs } = item;

  const moderate = useMutation({
    mutationFn: (action: ResolutionModeration) =>
      api(`/api/v1/review/resolutions/${item.id}`, { method: 'PATCH', body: action }),
    onSuccess: (_d, action) => {
      toast.success(
        action.action === 'approve'
          ? 'Resolução aprovada.'
          : action.action === 'reject'
            ? 'Resolução rejeitada.'
            : 'Resolução definida como oficial.',
      );
      setRejecting(false);
      void qc.invalidateQueries({ queryKey: ['review', 'resolutions'] });
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível moderar a resolução.'),
  });

  return (
    <Card className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="primary">
            {qs.institution} {qs.year}
          </Badge>
          {qs.number !== null && <Badge>Q{qs.number}</Badge>}
          {qs.subject && <Badge tone="accent">{qs.subject}</Badge>}
          <Badge tone={qs.correctLetter ? 'success' : 'neutral'}>
            Gabarito: {qs.correctLetter ?? '?'}
          </Badge>
          {qs.hasOfficialResolution && <Badge tone="highlight">Já tem oficial</Badge>}
          <Badge tone={item.status === 'approved' ? 'success' : 'neutral'}>
            {RESOLUTION_STATUS_LABELS[item.status]}
          </Badge>
        </div>
        <details className="rounded-lg border-2 border-line-soft p-2">
          <summary className="cursor-pointer text-sm font-semibold">Ver enunciado</summary>
          <div className="mt-2 max-h-64 overflow-y-auto">
            <RichText>{qs.statement}</RichText>
          </div>
        </details>
      </div>

      <div className="space-y-1">
        <p className="text-xs text-muted">
          {item.authorName} · {new Date(item.updatedAt).toLocaleString('pt-BR')} · pontuação{' '}
          {item.score}
        </p>
        <div className="rounded-xl border-2 border-line-soft bg-surface-2 p-3">
          <RichText>{item.body}</RichText>
        </div>
        {item.rejectReason && (
          <p className="text-sm text-danger">Motivo da rejeição: {item.rejectReason}</p>
        )}
      </div>

      {rejecting ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            moderate.mutate({ action: 'reject', reason: reason.trim() });
          }}
        >
          <Textarea
            label="Motivo da rejeição (o autor verá)"
            rows={3}
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              type="submit"
              size="sm"
              variant="danger"
              loading={moderate.isPending}
              disabled={reason.trim().length < 3}
            >
              Confirmar rejeição
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setRejecting(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          {item.status !== 'approved' && (
            <Button
              size="sm"
              variant="secondary"
              disabled={moderate.isPending}
              onClick={() => moderate.mutate({ action: 'approve' })}
            >
              <Check className="size-4" aria-hidden /> Aprovar
            </Button>
          )}
          {item.status !== 'rejected' && (
            <Button size="sm" variant="ghost" onClick={() => setRejecting(true)}>
              <X className="size-4" aria-hidden /> Rejeitar
            </Button>
          )}
          {item.status === 'approved' && (
            <Button
              size="sm"
              variant="secondary"
              disabled={moderate.isPending}
              onClick={() => moderate.mutate({ action: 'promote' })}
            >
              <Award className="size-4" aria-hidden /> Tornar oficial
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
