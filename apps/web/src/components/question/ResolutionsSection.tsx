import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, PencilLine, Trash2 } from 'lucide-react';
import {
  RESOLUTION_BODY_MAX,
  RESOLUTION_BODY_MIN,
  resolutionListResponseSchema,
  resolutionSchema,
  voteResolutionResponseSchema,
  type Resolution,
} from '@freenem/shared';
import { RichText } from '@/components/RichText';
import { Badge, Button, Textarea, buttonClasses, useToast } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/auth-client';
import { cn } from '@/lib/cn';

const resolutionsKey = (questionId: string) => ['resolutions', questionId] as const;

function relativeDate(iso: string): string {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
  const abs = Math.abs(diff);
  if (abs < 60) return 'agora há pouco';
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  if (abs < 86400 * 365) return rtf.format(Math.round(diff / (86400 * 30)), 'month');
  return rtf.format(Math.round(diff / (86400 * 365)), 'year');
}

/**
 * Resoluções da comunidade de uma questão. Carregado sob demanda (React.lazy no QuestionCard)
 * e só montado depois que a pessoa respondeu: as resoluções revelam o raciocínio e a resposta.
 */
export default function ResolutionsSection({ questionId }: { questionId: string }) {
  const { data: session } = useSession();
  const [editing, setEditing] = useState(false);
  const q = useQuery({
    queryKey: resolutionsKey(questionId),
    queryFn: () =>
      api(`/api/v1/questions/${questionId}/resolutions`, {
        schema: resolutionListResponseSchema,
      }),
  });

  const mine = q.data?.mine ?? null;
  const approvedMine = q.data?.items.find((r) => r.mine) ?? null;
  const own = mine ?? approvedMine;
  const heading = `resolucoes-${questionId}`;

  return (
    <section aria-labelledby={heading} className="space-y-3 border-t-2 border-line-soft pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={heading} className="text-base">
          Resoluções da comunidade
        </h3>
        {session && !own && !editing && (
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            <PencilLine className="size-4" aria-hidden /> Escrever resolução
          </Button>
        )}
        {!session && (
          <Link
            to="/entrar"
            search={{ redirect: window.location.pathname + window.location.search }}
            className={buttonClasses('secondary', 'sm')}
          >
            Entre para escrever uma resolução
          </Link>
        )}
      </div>

      {editing && !own && (
        <ResolutionEditor questionId={questionId} onDone={() => setEditing(false)} />
      )}

      {mine && <ResolutionItem resolution={mine} questionId={questionId} />}

      {q.isPending ? (
        <p className="text-sm text-muted">Carregando resoluções…</p>
      ) : q.isError ? (
        <p role="alert" className="text-sm text-danger">
          Não foi possível carregar as resoluções.
        </p>
      ) : q.data.items.length === 0 && !mine ? (
        <p className="text-sm text-muted">
          Ainda não há resoluções da comunidade para esta questão. Que tal escrever a primeira?
        </p>
      ) : (
        <ul className="space-y-3">
          {q.data.items.map((r) => (
            <li key={r.id}>
              <ResolutionItem resolution={r} questionId={questionId} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ResolutionItem({
  resolution: r,
  questionId,
}: {
  resolution: Resolution;
  questionId: string;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const { data: session } = useSession();
  const [editing, setEditing] = useState(false);

  const vote = useMutation({
    mutationFn: (value: 1 | -1) =>
      api(`/api/v1/resolutions/${r.id}/vote`, {
        method: 'POST',
        body: { value },
        schema: voteResolutionResponseSchema,
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: resolutionsKey(questionId) }),
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível registrar o voto.'),
  });
  const remove = useMutation({
    mutationFn: () => api(`/api/v1/resolutions/${r.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Resolução excluída.');
      void qc.invalidateQueries({ queryKey: resolutionsKey(questionId) });
      void qc.invalidateQueries({ queryKey: ['me', 'resolutions'] });
    },
    onError: () => toast.error('Não foi possível excluir a resolução.'),
  });

  if (editing) {
    return (
      <ResolutionEditor questionId={questionId} existing={r} onDone={() => setEditing(false)} />
    );
  }

  const canVote = Boolean(session) && !r.mine && r.status === 'approved';
  const voteBtn = (value: 1 | -1) => {
    const active = r.myVote === value;
    const Icon = value === 1 ? ChevronUp : ChevronDown;
    return (
      <button
        type="button"
        aria-pressed={active}
        aria-label={value === 1 ? 'Voto positivo' : 'Voto negativo'}
        disabled={!canVote || vote.isPending}
        onClick={() => vote.mutate(value)}
        className={cn(
          'grid size-10 place-items-center rounded-lg border-2 disabled:opacity-50',
          active
            ? 'border-line bg-highlight text-[#14213d]'
            : 'border-line-soft hover:bg-surface-2',
        )}
      >
        <Icon className="size-5" aria-hidden />
      </button>
    );
  };

  return (
    <article
      className="flex gap-3 rounded-xl border-2 border-line-soft bg-surface-2 p-3 sm:p-4"
      aria-label={`Resolução de ${r.authorName}`}
    >
      {r.status === 'approved' && (
        <div className="flex shrink-0 flex-col items-center gap-0.5">
          {voteBtn(1)}
          <span className="text-sm font-bold">
            {r.score}
            <span className="sr-only"> pontos</span>
          </span>
          {voteBtn(-1)}
        </div>
      )}
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className="font-semibold text-ink">{r.mine ? 'Você' : r.authorName}</span>
          <span>· {relativeDate(r.createdAt)}</span>
          {r.status === 'pending' && <Badge tone="highlight">Em análise</Badge>}
          {r.status === 'rejected' && <Badge tone="danger">Rejeitada</Badge>}
        </div>
        <RichText>{r.body}</RichText>
        {r.status === 'rejected' && r.rejectReason && (
          <p className="text-sm text-danger">Motivo: {r.rejectReason}</p>
        )}
        {r.status === 'pending' && r.mine && (
          <p className="text-xs text-muted">
            Só você vê esta resolução até ela ser aprovada por um revisor.
          </p>
        )}
        {r.mine && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              <PencilLine className="size-4" aria-hidden /> Editar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              loading={remove.isPending}
              onClick={() => {
                if (window.confirm('Excluir sua resolução?')) remove.mutate();
              }}
            >
              <Trash2 className="size-4" aria-hidden /> Excluir
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}

function ResolutionEditor({
  questionId,
  existing,
  onDone,
}: {
  questionId: string;
  existing?: Resolution;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [body, setBody] = useState(existing?.body ?? '');
  const trimmed = body.trim();
  const tooShort = trimmed.length < RESOLUTION_BODY_MIN;

  const save = useMutation({
    mutationFn: () =>
      existing
        ? api(`/api/v1/resolutions/${existing.id}`, {
            method: 'PUT',
            body: { body: trimmed },
            schema: resolutionSchema,
          })
        : api(`/api/v1/questions/${questionId}/resolutions`, {
            method: 'POST',
            body: { body: trimmed },
            schema: resolutionSchema,
          }),
    onSuccess: () => {
      toast.success(
        existing
          ? 'Resolução atualizada e enviada para nova análise.'
          : 'Resolução enviada! Ela aparece para todos depois da análise de um revisor.',
      );
      void qc.invalidateQueries({ queryKey: resolutionsKey(questionId) });
      void qc.invalidateQueries({ queryKey: ['me', 'resolutions'] });
      onDone();
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível salvar a resolução.'),
  });

  return (
    <form
      className="space-y-3 rounded-xl border-2 border-line bg-surface p-3 sm:p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!tooShort) save.mutate();
      }}
    >
      <Textarea
        label={existing ? 'Editar resolução' : 'Sua resolução'}
        rows={7}
        value={body}
        maxLength={RESOLUTION_BODY_MAX}
        onChange={(e) => setBody(e.target.value)}
        hint="Explique o raciocínio, não só a resposta. Use Markdown e LaTeX ($x^2$). HTML e imagens não são permitidos."
      />
      <p className="text-xs text-muted" aria-live="polite">
        {trimmed.length}/{RESOLUTION_BODY_MAX} caracteres
        {tooShort && ` · mínimo de ${RESOLUTION_BODY_MIN}`}
      </p>
      {trimmed && (
        <div className="space-y-1">
          <p className="text-sm font-semibold">Pré-visualização</p>
          <div className="rounded-lg border-2 border-line-soft bg-surface-2 p-3">
            <RichText>{trimmed}</RichText>
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" loading={save.isPending} disabled={tooShort}>
          {existing ? 'Salvar alterações' : 'Enviar para análise'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
