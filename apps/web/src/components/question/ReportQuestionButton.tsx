import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { Flag } from 'lucide-react';
import {
  REPORT_KIND_LABELS,
  REPORT_MESSAGE_MAX,
  createReportResponseSchema,
  reportKindSchema,
  type ReportKind,
} from '@freenem/shared';
import { Button, Dialog, Textarea, useToast } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/auth-client';
import { cn } from '@/lib/cn';

const KINDS = reportKindSchema.options;

export interface ReportQuestionButtonProps {
  questionId: string;
  /** `icon` (padrão): botão quadrado para cabeçalhos; `text`: botão discreto com rótulo. */
  variant?: 'icon' | 'text';
  className?: string;
}

/** Botão "Reportar erro" + diálogo com tipo e mensagem. Visitantes são levados ao login. */
export function ReportQuestionButton({
  questionId,
  variant = 'icon',
  className,
}: ReportQuestionButtonProps) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const label = 'Reportar erro na questão';

  const trigger =
    variant === 'icon'
      ? cn('grid size-10 place-items-center rounded-lg hover:bg-surface-2', className)
      : cn(
          'inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-ink',
          className,
        );
  const content =
    variant === 'icon' ? (
      <Flag className="size-5" aria-hidden />
    ) : (
      <>
        <Flag className="size-4" aria-hidden /> Reportar erro
      </>
    );

  if (!session) {
    return (
      <Link
        to="/entrar"
        search={{ redirect: window.location.pathname + window.location.search }}
        aria-label={`${label} (entre para reportar)`}
        title="Entre para reportar um erro"
        className={trigger}
      >
        {content}
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        title={label}
        className={trigger}
      >
        {content}
      </button>
      {/* só monta o formulário aberto: o estado reinicia a cada abertura */}
      {open && <ReportDialog questionId={questionId} onClose={() => setOpen(false)} />}
    </>
  );
}

function ReportDialog({ questionId, onClose }: { questionId: string; onClose: () => void }) {
  const toast = useToast();
  const [kind, setKind] = useState<ReportKind | null>(null);
  const [message, setMessage] = useState('');

  const send = useMutation({
    mutationFn: () =>
      api(`/api/v1/questions/${questionId}/reports`, {
        method: 'POST',
        body: { kind, message },
        schema: createReportResponseSchema,
      }),
    onSuccess: () => {
      toast.success('Obrigado! Recebemos o seu reporte e vamos revisar a questão.');
      onClose();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        toast.show('Você já reportou esta questão. Aguarde a revisão.');
        onClose();
        return;
      }
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível enviar o reporte.');
    },
  });

  return (
    <Dialog open onClose={onClose} title="Reportar erro na questão">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (kind) send.mutate();
        }}
      >
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-semibold">O que está errado?</legend>
          {KINDS.map((k) => (
            <label
              key={k}
              className={cn(
                'flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border-2 px-3 py-2 text-sm font-medium',
                kind === k ? 'border-line bg-surface-2 shadow-hard-sm' : 'border-line-soft',
              )}
            >
              <input
                type="radio"
                name="report-kind"
                value={k}
                checked={kind === k}
                onChange={() => setKind(k)}
                className="size-4 accent-primary"
              />
              {REPORT_KIND_LABELS[k]}
            </label>
          ))}
        </fieldset>
        <Textarea
          label="Detalhes (opcional)"
          rows={4}
          maxLength={REPORT_MESSAGE_MAX}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          hint={`${message.length}/${REPORT_MESSAGE_MAX}`}
          placeholder="Explique o problema para ajudar a revisão."
        />
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!kind} loading={send.isPending}>
            Enviar reporte
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
