import { useEffect, useMemo, useState } from 'react';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { z } from 'zod';
import { ArrowLeft, CheckCheck, Inbox, Save } from 'lucide-react';
import {
  reviewQuestionSchema,
  type AlternativeLetter,
  type CatalogResponse,
  type QuestionStatus,
  type ReviewListResponse,
  type ReviewQuestion,
} from '@freenem/shared';
import { PageHeader } from '@/components/layout/PageHeader';
import { ReportsPanel, reportsQuery } from '@/components/review/ReportsPanel';
import { ResolutionsPanel, resolutionsReviewQuery } from '@/components/review/ResolutionsPanel';
import { RichText } from '@/components/RichText';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Select,
  Skeleton,
  Textarea,
  useToast,
} from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { meQuery } from '@/lib/queries';
import { catalogQuery, reviewListInfiniteQuery, reviewQuestionQuery } from '@/lib/questions';

const searchSchema = z.object({
  tab: z.enum(['fila', 'reportes', 'resolucoes']).optional().catch(undefined),
  resStatus: z.enum(['pending', 'approved', 'rejected']).optional().catch(undefined),
  reportStatus: z.enum(['open', 'resolved', 'dismissed']).optional().catch(undefined),
  id: z.string().uuid().optional().catch(undefined),
  status: z.enum(['draft', 'reviewed', 'published']).optional().catch(undefined),
  subjectId: z.string().uuid().optional().catch(undefined),
  q: z
    .preprocess((v) => (typeof v === 'number' ? String(v) : v), z.string().min(2).max(200))
    .optional()
    .catch(undefined),
});

export const Route = createFileRoute('/_app/_auth/admin/revisao')({
  head: () => ({ meta: [{ title: 'Revisão de questões · freenem' }] }),
  validateSearch: searchSchema,
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (me?.role !== 'admin' && me?.role !== 'reviewer') throw redirect({ to: '/questoes' });
  },
  component: ReviewPage,
});

const STATUS_LABELS: Record<QuestionStatus, string> = {
  draft: 'Rascunhos',
  reviewed: 'Revisadas',
  published: 'Publicadas',
};
const LETTERS: AlternativeLetter[] = ['A', 'B', 'C', 'D', 'E'];

/** Texto puro do Markdown para o resumo da fila. */
function excerpt(md: string, n = 110): string {
  const plain = md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '[imagem]')
    .replace(/[*_`#>$\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > n ? `${plain.slice(0, n)}…` : plain;
}

function ReviewPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const status = search.status ?? 'draft';
  const catalog = useQuery(catalogQuery);
  const [text, setText] = useState(search.q ?? '');

  const list = useInfiniteQuery(
    reviewListInfiniteQuery({ status, subjectId: search.subjectId, q: search.q }),
  );
  const items = useMemo(() => list.data?.pages.flatMap((p) => p.items) ?? [], [list.data]);
  const total = list.data?.pages[0]?.total ?? 0;

  useEffect(() => {
    const t = setTimeout(() => {
      const q = text.trim().length >= 2 ? text.trim() : undefined;
      if (q !== search.q)
        void navigate({ search: (p) => ({ ...p, q, id: undefined }), replace: true });
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const select = (id: string | undefined) =>
    void navigate({ search: (p) => ({ ...p, id }), replace: false });

  const nextId = (current: string): string | undefined => {
    const i = items.findIndex((x) => x.id === current);
    return items[i + 1]?.id ?? items[i - 1]?.id;
  };

  const tab = search.tab ?? 'fila';
  const openReports = useQuery(reportsQuery('open'));
  const openTotal = openReports.data?.openTotal ?? 0;
  const pendingRes = useQuery(resolutionsReviewQuery('pending'));
  const pendingResTotal = pendingRes.data?.pendingTotal ?? 0;

  return (
    <>
      <PageHeader
        title="Revisão de questões"
        description="Fila de questões importadas aguardando revisão: confira enunciado, gabarito, matéria e assuntos antes de publicar."
      />
      <div role="tablist" aria-label="Seção" className="mb-6 grid max-w-lg grid-cols-3 gap-1.5">
        {(
          [
            ['fila', 'Fila'],
            ['reportes', openTotal > 0 ? `Reportes (${openTotal})` : 'Reportes'],
            ['resolucoes', pendingResTotal > 0 ? `Resoluções (${pendingResTotal})` : 'Resoluções'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => void navigate({ search: (p) => ({ ...p, tab: value, id: undefined }) })}
            className={cn(
              'h-10 rounded-lg border-2 px-2 text-sm font-semibold',
              tab === value
                ? 'border-line bg-primary text-primary-ink shadow-hard-sm'
                : 'border-line-soft hover:bg-surface-2',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'resolucoes' ? (
        <ResolutionsPanel
          status={search.resStatus ?? 'pending'}
          onStatusChange={(s) => void navigate({ search: (p) => ({ ...p, resStatus: s }) })}
        />
      ) : tab === 'reportes' ? (
        <ReportsPanel
          status={search.reportStatus ?? 'open'}
          onStatusChange={(s) => void navigate({ search: (p) => ({ ...p, reportStatus: s }) })}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
          <section
            aria-label="Fila de revisão"
            className={cn('min-w-0 space-y-3', search.id && 'hidden lg:block')}
          >
            <div role="tablist" aria-label="Status" className="grid grid-cols-3 gap-1.5">
              {(Object.keys(STATUS_LABELS) as QuestionStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  role="tab"
                  aria-selected={status === s}
                  onClick={() =>
                    void navigate({ search: (p) => ({ ...p, status: s, id: undefined }) })
                  }
                  className={cn(
                    'h-10 rounded-lg border-2 px-1 text-sm font-semibold',
                    status === s
                      ? 'border-line bg-highlight text-[#14213d] shadow-hard-sm'
                      : 'border-line-soft hover:bg-surface-2',
                  )}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
            <Select
              aria-label="Matéria"
              value={search.subjectId ?? ''}
              onChange={(e) =>
                void navigate({
                  search: (p) => ({ ...p, subjectId: e.target.value || undefined, id: undefined }),
                })
              }
            >
              <option value="">Todas as matérias</option>
              {catalog.data?.subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Input
              aria-label="Buscar"
              type="search"
              placeholder="Buscar no enunciado"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <p className="text-sm text-muted" aria-live="polite">
              {list.isPending ? 'Carregando…' : `${total.toLocaleString('pt-BR')} na fila`}
            </p>

            {list.isPending ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }, (_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <EmptyState icon={<Inbox />} title="Fila vazia" description="Nada por aqui." />
            ) : (
              <ul className="max-h-[70dvh] space-y-2 overflow-y-auto pr-1">
                {items.map((it) => (
                  <li key={it.id}>
                    <button
                      type="button"
                      onClick={() => select(it.id)}
                      aria-current={search.id === it.id}
                      className={cn(
                        'w-full rounded-xl border-2 p-3 text-left hover:bg-surface-2',
                        search.id === it.id
                          ? 'border-line bg-surface-2 shadow-hard-sm'
                          : 'border-line-soft bg-surface',
                      )}
                    >
                      <div className="mb-1 flex flex-wrap items-center gap-1.5">
                        <Badge tone="primary">
                          {it.institution} {it.year}
                        </Badge>
                        {it.number !== null && <Badge>Q{it.number}</Badge>}
                        <Badge tone={it.subject ? 'accent' : 'danger'}>
                          {it.subject ?? 'Sem matéria'}
                        </Badge>
                      </div>
                      <p className="line-clamp-2 text-sm text-muted">{excerpt(it.statement)}</p>
                    </button>
                  </li>
                ))}
                {list.hasNextPage && (
                  <li>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      loading={list.isFetchingNextPage}
                      onClick={() => void list.fetchNextPage()}
                    >
                      Carregar mais
                    </Button>
                  </li>
                )}
              </ul>
            )}
          </section>

          <section aria-label="Editor" className={cn('min-w-0', !search.id && 'hidden lg:block')}>
            {search.id ? (
              <ReviewEditor
                key={search.id}
                id={search.id}
                catalog={catalog.data}
                onBack={() => select(undefined)}
                onDone={(finishedId) => select(nextId(finishedId))}
              />
            ) : (
              <EmptyState
                icon={<CheckCheck />}
                title="Selecione uma questão"
                description="Escolha um item da fila para editar e publicar."
              />
            )}
          </section>
        </div>
      )}
    </>
  );
}

interface FormState {
  statement: string;
  resolution: string;
  alternatives: Record<AlternativeLetter, { text: string; imageUrl: string | null }>;
  correct: AlternativeLetter | null;
  subjectId: string;
  topicIds: string[];
}

function toForm(q: ReviewQuestion): FormState {
  const alternatives = Object.fromEntries(
    LETTERS.map((l) => {
      const a = q.alternatives.find((x) => x.letter === l);
      return [l, { text: a?.text ?? '', imageUrl: a?.imageUrl ?? null }];
    }),
  ) as FormState['alternatives'];
  return {
    statement: q.statement,
    resolution: q.resolution ?? '',
    alternatives,
    correct: q.alternatives.find((a) => a.isCorrect)?.letter ?? null,
    subjectId: q.subjectId ?? '',
    topicIds: q.topicIds,
  };
}

function ReviewEditor({
  id,
  catalog,
  onBack,
  onDone,
}: {
  id: string;
  catalog: CatalogResponse | undefined;
  onBack: () => void;
  onDone: (id: string) => void;
}) {
  const q = useQuery(reviewQuestionQuery(id));
  if (q.isPending) return <Skeleton className="h-96 w-full" />;
  if (q.isError) {
    return (
      <EmptyState
        title="Não foi possível carregar a questão"
        action={<Button onClick={onBack}>Voltar à fila</Button>}
      />
    );
  }
  return <EditorForm question={q.data} catalog={catalog} onBack={onBack} onDone={onDone} />;
}

function EditorForm({
  question,
  catalog,
  onBack,
  onDone,
}: {
  question: ReviewQuestion;
  catalog: CatalogResponse | undefined;
  onBack: () => void;
  onDone: (id: string) => void;
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(() => toForm(question));
  const base = catalog?.storageBaseUrl ?? '';
  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(question));

  const subject = catalog?.subjects.find((s) => s.id === form.subjectId);
  const preview = (md: string) => (base ? md.replaceAll('storage://', `${base}/`) : md);

  const save = useMutation({
    mutationFn: async (status: QuestionStatus | undefined) => {
      const alternatives = LETTERS.filter(
        (l) => form.alternatives[l].text.trim() || form.alternatives[l].imageUrl,
      ).map((l) => ({
        letter: l,
        text: form.alternatives[l].text,
        imageUrl: form.alternatives[l].imageUrl,
      }));
      return api(`/api/v1/review/questions/${question.id}`, {
        method: 'PATCH',
        schema: reviewQuestionSchema,
        body: {
          statement: form.statement,
          resolution: form.resolution.trim() || null,
          alternatives,
          ...(form.correct ? { correctLetter: form.correct } : {}),
          subjectId: form.subjectId || null,
          topicIds: form.topicIds,
          ...(status ? { status } : {}),
        },
      });
    },
    onSuccess: (saved, status) => {
      toast.success(status === 'published' ? 'Questão publicada.' : 'Alterações salvas.');
      qc.setQueryData(['review', 'question', question.id], saved);
      // remove da fila atual se o status mudou
      if (status && status !== question.status) {
        qc.setQueriesData<InfiniteData<ReviewListResponse>>(
          { queryKey: ['review', 'list'] },
          (old) =>
            old && {
              ...old,
              pages: old.pages.map((p) => ({
                ...p,
                items: p.items.filter((i) => i.id !== question.id),
                total: Math.max(0, p.total - 1),
              })),
            },
        );
        onDone(question.id);
      } else {
        void qc.invalidateQueries({ queryKey: ['review', 'list'] });
      }
      void qc.invalidateQueries({ queryKey: ['catalog'] });
      void qc.invalidateQueries({ queryKey: ['questions'] });
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível salvar.'),
  });

  function toggleTopic(topicId: string) {
    setForm((f) => ({
      ...f,
      topicIds: f.topicIds.includes(topicId)
        ? f.topicIds.filter((t) => t !== topicId)
        : [...f.topicIds, topicId].slice(-5),
    }));
  }

  const canPublish = form.correct !== null && form.subjectId !== '' && form.topicIds.length > 0;

  return (
    <Card className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button variant="ghost" size="sm" className="lg:hidden" onClick={onBack}>
            <ArrowLeft className="size-4" aria-hidden />
            Fila
          </Button>
          <Badge tone="primary">
            {question.institution} {question.year}
          </Badge>
          {question.number !== null && <Badge>Questão {question.number}</Badge>}
          <Badge tone={question.status === 'published' ? 'success' : 'highlight'}>
            {STATUS_LABELS[question.status]}
          </Badge>
          {question.irtB !== null && <Badge>b = {question.irtB.toFixed(2)}</Badge>}
        </div>
        {question.source && <p className="text-xs text-muted">Fonte: {question.source.name}</p>}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Textarea
          label="Enunciado (Markdown + LaTeX)"
          rows={14}
          className="font-mono text-sm"
          value={form.statement}
          onChange={(e) => setForm({ ...form, statement: e.target.value })}
        />
        <div className="space-y-1.5">
          <p className="text-sm font-semibold">Pré-visualização</p>
          <div className="max-h-[22rem] overflow-y-auto rounded-xl border-2 border-line-soft bg-bg p-4">
            <RichText>{preview(form.statement)}</RichText>
          </div>
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className="mb-1 text-sm font-semibold">
          Alternativas e gabarito (marque a correta)
        </legend>
        {LETTERS.map((l) => {
          const alt = form.alternatives[l];
          return (
            <div key={l} className="space-y-1">
              <div className="flex items-start gap-2">
                <label
                  className={cn(
                    'mt-1 grid size-10 shrink-0 cursor-pointer place-items-center rounded-full border-2 font-display font-bold',
                    form.correct === l
                      ? 'border-success bg-success text-bg'
                      : 'border-line-soft hover:bg-surface-2',
                  )}
                  title={`Marcar ${l} como correta`}
                >
                  <input
                    type="radio"
                    name="correct"
                    className="sr-only"
                    checked={form.correct === l}
                    onChange={() => setForm({ ...form, correct: l })}
                    aria-label={`Alternativa ${l} é a correta`}
                  />
                  {l}
                </label>
                <Textarea
                  aria-label={`Texto da alternativa ${l}`}
                  rows={2}
                  value={alt.text}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      alternatives: { ...form.alternatives, [l]: { ...alt, text: e.target.value } },
                    })
                  }
                  className="flex-1"
                />
              </div>
              {alt.imageUrl && (
                <div className="ml-12 max-w-sm">
                  <RichText>{preview(`![Alternativa ${l}](${alt.imageUrl})`)}</RichText>
                </div>
              )}
            </div>
          );
        })}
      </fieldset>

      <div className="grid gap-4 md:grid-cols-2">
        <Select
          label="Matéria"
          value={form.subjectId}
          onChange={(e) => setForm({ ...form, subjectId: e.target.value, topicIds: [] })}
        >
          <option value="">Selecione…</option>
          {catalog?.subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold">
            Assuntos ({form.topicIds.length}/5)
          </legend>
          <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border-2 border-line-soft p-3">
            {!subject && <p className="text-sm text-muted">Escolha uma matéria.</p>}
            {subject?.topics.map((parent) => (
              <div key={parent.id}>
                <TopicCheck
                  label={parent.name}
                  strong
                  checked={form.topicIds.includes(parent.id)}
                  onChange={() => toggleTopic(parent.id)}
                />
                <div className="ml-5">
                  {parent.children.map((c) => (
                    <TopicCheck
                      key={c.id}
                      label={c.name}
                      checked={form.topicIds.includes(c.id)}
                      onChange={() => toggleTopic(c.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </fieldset>
      </div>

      <Textarea
        label="Resolução comentada (opcional, Markdown + LaTeX)"
        rows={5}
        className="font-mono text-sm"
        value={form.resolution}
        onChange={(e) => setForm({ ...form, resolution: e.target.value })}
      />

      <div className="flex flex-wrap items-center gap-3 border-t-2 border-line-soft pt-4">
        <Button
          variant="secondary"
          loading={save.isPending}
          disabled={!dirty}
          onClick={() => save.mutate(undefined)}
        >
          <Save className="size-4" aria-hidden />
          Salvar alterações
        </Button>
        {question.status !== 'published' ? (
          <Button
            loading={save.isPending}
            disabled={!canPublish}
            onClick={() => save.mutate('published')}
          >
            <CheckCheck className="size-4" aria-hidden />
            Publicar
          </Button>
        ) : (
          <Button variant="danger" loading={save.isPending} onClick={() => save.mutate('draft')}>
            Voltar para rascunho
          </Button>
        )}
        {question.status === 'draft' && (
          <Button
            variant="ghost"
            loading={save.isPending}
            disabled={!canPublish}
            onClick={() => save.mutate('reviewed')}
          >
            Marcar como revisada
          </Button>
        )}
        {!canPublish && question.status !== 'published' && (
          <p className="text-xs text-muted">
            Para publicar: defina gabarito, matéria e ao menos um assunto.
          </p>
        )}
      </div>
    </Card>
  );
}

function TopicCheck({
  label,
  checked,
  onChange,
  strong,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  strong?: boolean;
}) {
  return (
    <label className="flex min-h-8 cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="size-4 accent-primary"
      />
      <span className={cn(strong && 'font-bold')}>{label}</span>
    </label>
  );
}
