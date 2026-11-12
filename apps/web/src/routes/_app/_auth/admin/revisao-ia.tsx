import { useRef, useState } from 'react';
import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Play, Square } from 'lucide-react';
import {
  aiReviewListResponseSchema,
  aiReviewSchema,
  aiReviewStatusSchema,
  type AiReviewFilter,
  type AiReviewItem,
  type AiVerdict,
  type QuestionStatus,
} from '@freenem/shared';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, EmptyState, Input, Select, Skeleton } from '@/components/ui';
import type { BadgeTone } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { meQuery } from '@/lib/queries';

const searchSchema = z.object({
  status: z.enum(['draft', 'published']).optional().catch(undefined),
  filter: z.enum(['pending', 'ok', 'problem', 'unsure', 'mismatch']).optional().catch(undefined),
});

export const Route = createFileRoute('/_app/_auth/admin/revisao-ia')({
  head: () => ({ meta: [{ title: 'Revisão por IA (temporária) · freenem' }] }),
  validateSearch: searchSchema,
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (me?.role !== 'admin') throw redirect({ to: '/questoes' });
  },
  component: AiReviewPage,
});

const FILTERS: [AiReviewFilter, string][] = [
  ['pending', 'Pendentes'],
  ['problem', 'Problemas'],
  ['mismatch', 'Gabarito divergente'],
  ['unsure', 'Incertas'],
  ['ok', 'OK'],
];
const VERDICT: Record<AiVerdict, { label: string; tone: BadgeTone }> = {
  ok: { label: 'OK', tone: 'success' },
  problem: { label: 'Problema', tone: 'danger' },
  unsure: { label: 'Incerta', tone: 'highlight' },
};
const PAGE = 20;
const usd = (n: number) => `US$ ${n.toFixed(4)}`;

const statusQuery = {
  queryKey: ['ai-review', 'status'],
  queryFn: () => api('/api/v1/review/ai/status', { schema: aiReviewStatusSchema }),
};

function listQuery(status: QuestionStatus, filter: AiReviewFilter, offset: number) {
  return {
    queryKey: ['ai-review', 'list', status, filter, offset],
    queryFn: () =>
      api('/api/v1/review/ai/questions', {
        query: { status, filter, limit: PAGE, offset },
        schema: aiReviewListResponseSchema,
      }),
  };
}

function AiReviewPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const qc = useQueryClient();
  const status: QuestionStatus = search.status ?? 'draft';
  const filter: AiReviewFilter = search.filter ?? 'pending';
  const [offset, setOffset] = useState(0);
  const [model, setModel] = useState('');
  const [count, setCount] = useState(20);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, failed: 0, cost: 0 });
  const [error, setError] = useState<string | null>(null);
  const stop = useRef(false);

  const info = useQuery(statusQuery);
  const list = useQuery(listQuery(status, filter, offset));

  async function runNext() {
    stop.current = false;
    setRunning(true);
    setError(null);
    const target = Math.max(1, Math.min(count, 500));
    let done = 0;
    let failed = 0;
    let cost = 0;
    setProgress({ done: 0, total: target, failed: 0, cost: 0 });
    try {
      while (done + failed < target && !stop.current) {
        const batch = await api('/api/v1/review/ai/questions', {
          query: {
            status,
            filter: 'pending',
            limit: Math.min(target - done - failed, 100),
            offset: failed,
          },
          schema: aiReviewListResponseSchema,
        });
        if (batch.items.length === 0) break;
        const queue = [...batch.items];
        let fatal = false;
        const worker = async () => {
          for (let it = queue.shift(); it && !stop.current && !fatal; it = queue.shift()) {
            try {
              const r = await api(`/api/v1/review/ai/questions/${it.questionId}/run`, {
                method: 'POST',
                body: model ? { model } : {},
                schema: aiReviewSchema,
              });
              done += 1;
              cost += r.costUsd ?? 0;
            } catch (e) {
              failed += 1;
              if (
                e instanceof ApiError &&
                (e.status === 503 || e.status === 401 || e.status === 403)
              ) {
                fatal = true;
                setError(e.message);
              }
            }
            setProgress({ done, total: target, failed, cost });
          }
        };
        await Promise.all([worker(), worker()]);
        if (fatal) break;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro inesperado.');
    } finally {
      setRunning(false);
      void qc.invalidateQueries({ queryKey: ['ai-review'] });
    }
  }

  const setParam = (p: { status?: 'draft' | 'published'; filter?: AiReviewFilter }) => {
    setOffset(0);
    void navigate({ search: (prev) => ({ ...prev, ...p }), replace: true });
  };
  const total = list.data?.total ?? 0;

  return (
    <>
      <PageHeader
        title="Revisão por IA (temporária)"
        description="Modelos externos baratos conferem as questões (resolvem sem ver o gabarito e apontam problemas). Use o resultado para priorizar a revisão manual."
      />

      <Card className="mb-6 flex flex-col gap-4 p-4">
        {!info.data?.enabled && info.data && (
          <p role="alert" className="font-medium text-danger">
            FEATHERLESS_API_KEY não configurada na API.
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            label="Situação"
            value={status}
            onChange={(e) => setParam({ status: e.target.value as 'draft' | 'published' })}
          >
            <option value="draft">Rascunho</option>
            <option value="published">Publicada</option>
          </Select>
          <Select label="Modelo" value={model} onChange={(e) => setModel(e.target.value)}>
            <option value="">Padrão ({info.data?.defaultModel ?? '…'})</option>
            {info.data?.models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
          <Select
            label="Filtro"
            value={filter}
            onChange={(e) => setParam({ filter: e.target.value as AiReviewFilter })}
          >
            {FILTERS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
          <Input
            label="Rodar próximas N"
            type="number"
            min={1}
            max={500}
            value={count}
            onChange={(e) => setCount(Number(e.target.value) || 1)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {running ? (
            <Button variant="secondary" onClick={() => (stop.current = true)}>
              <Square className="size-4" aria-hidden /> Parar
            </Button>
          ) : (
            <Button onClick={() => void runNext()} disabled={!info.data?.enabled}>
              <Play className="size-4" aria-hidden /> Rodar próximas {count}
            </Button>
          )}
          {progress.total > 0 && (
            <p className="text-sm font-semibold" aria-live="polite">
              {progress.done}/{progress.total} concluídas
              {progress.failed > 0 && ` · ${progress.failed} com erro`} · custo da execução{' '}
              {usd(progress.cost)}
            </p>
          )}
        </div>
        {error && (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        )}
        {info.data && (
          <p className="text-sm text-muted">
            Total: {info.data.counts.ok} OK · {info.data.counts.problem} problemas ·{' '}
            {info.data.counts.mismatch} divergentes · {info.data.counts.unsure} incertas · gasto{' '}
            {usd(info.data.totalCostUsd)}
          </p>
        )}
      </Card>

      {list.isLoading ? (
        <Skeleton className="h-40" />
      ) : list.data && list.data.items.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {list.data.items.map((it) => (
            <ItemCard key={it.questionId} item={it} status={status} />
          ))}
        </ul>
      ) : (
        <EmptyState title="Nada por aqui" description="Nenhuma questão neste filtro." />
      )}

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button
          variant="secondary"
          disabled={offset === 0}
          onClick={() => setOffset(offset - PAGE)}
        >
          Anterior
        </Button>
        <span className="text-sm text-muted">
          {total === 0 ? 0 : offset + 1}–{Math.min(offset + PAGE, total)} de {total}
        </span>
        <Button
          variant="secondary"
          disabled={offset + PAGE >= total}
          onClick={() => setOffset(offset + PAGE)}
        >
          Próxima
        </Button>
      </div>
    </>
  );
}

function ItemCard({ item, status }: { item: AiReviewItem; status: QuestionStatus }) {
  const r = item.review;
  return (
    <li>
      <Card className="flex flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {r ? (
            <Badge tone={VERDICT[r.verdict].tone}>{VERDICT[r.verdict].label}</Badge>
          ) : (
            <Badge>Pendente</Badge>
          )}
          <span className="text-sm font-semibold">
            {item.year ?? '—'} · {item.examLabel ?? 'sem prova'} · Q{item.number ?? '—'}
            {item.subject ? ` · ${item.subject}` : ''}
          </span>
          <Link
            to="/admin/revisao"
            search={{ id: item.questionId, status }}
            className="ml-auto text-sm font-semibold underline"
          >
            Abrir no editor
          </Link>
        </div>
        <p className="text-sm text-muted">{item.statementExcerpt}</p>
        {r && (
          <>
            <p className="text-sm">
              Modelo: <strong>{r.modelAnswer ?? '—'}</strong> · Gabarito:{' '}
              <strong>{item.correctLetter ?? '—'}</strong>
              {r.answerMatches === false && (
                <Badge tone="danger" className="ml-2">
                  Diverge
                </Badge>
              )}
            </p>
            {r.issues.length > 0 && (
              <ul className="list-disc pl-5 text-sm">
                {r.issues.map((i, n) => (
                  <li key={n}>{i}</li>
                ))}
              </ul>
            )}
            {r.summary && <p className="text-sm">{r.summary}</p>}
            <p className="text-xs text-muted">
              {r.model}
              {r.costUsd !== null && ` · ${usd(r.costUsd)}`}
            </p>
          </>
        )}
      </Card>
    </li>
  );
}
