import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Clock, Loader2, Send, TriangleAlert } from 'lucide-react';
import {
  ESSAY_DRAFT_MAX_CHARS,
  ESSAY_MAX_CHARS,
  ESSAY_MIN_CHARS,
  ESSAY_SHEET_LINES,
} from '@freenem/shared';
import { Badge, Button, Card, Dialog, useToast } from '@/components/ui';
import { RichText } from '@/components/RichText';
import { ApiError } from '@/lib/api';
import {
  correctEssay,
  createEssayDraft,
  essayListQuery,
  essayQuery,
  essayQuotaQuery,
  estimateLines,
  formatDateTime,
  saveEssayDraft,
} from '@/lib/essays';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface Props {
  /** rascunho existente; ausente = redação nova */
  essayId?: string;
  themeId: string;
  themeTitle: string;
  supportingTexts: string | null;
  initialText: string;
}

const SAVE_DELAY_MS = 1500;

/**
 * Na primeira gravação a rota muda de `/redacao/nova` para `/redacao/$id` e o editor remonta.
 * O texto digitado nesse intervalo viaja numa ref entregue ao novo editor, que a retoma
 * (e agenda novo salvamento se for o caso), sem perder caracteres.
 */
const handoff = new Map<string, { current: string }>();
const TARGET_SECONDS = 60 * 60;

function formatClock(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Editor com aparência de folha de redação do ENEM, autosave e envio para correção. */
export function EssayWorkspace({
  essayId,
  themeId,
  themeTitle,
  supportingTexts,
  initialText,
}: Props) {
  const toast = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const quota = useQuery(essayQuotaQuery);

  const [carried] = useState(() => (essayId ? handoff.get(essayId) : undefined));
  const startText = carried?.current ?? initialText;

  const [text, setText] = useState(startText);
  const [saveState, setSaveState] = useState<SaveState>(
    startText === initialText && initialText ? 'saved' : 'idle',
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [timerOn, setTimerOn] = useState(false);

  const idRef = useRef(essayId);
  const lastSaved = useRef(initialText);
  const latestText = useRef(startText);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const dirtyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // texto digitado durante a troca de rota ainda não foi salvo
    if (essayId) handoff.delete(essayId);
    if (carried && carried.current !== initialText) {
      if (dirtyTimer.current) clearTimeout(dirtyTimer.current);
      dirtyTimer.current = setTimeout(() => void save(), SAVE_DELAY_MS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  useEffect(() => {
    if (!timerOn) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [timerOn]);

  /** Salva (cria ou atualiza) o texto mais recente; chamadas são serializadas. */
  const save = useCallback((): Promise<string | null> => {
    const run = async (): Promise<string | null> => {
      const value = latestText.current;
      if (idRef.current && value === lastSaved.current) return idRef.current;
      if (!idRef.current && value.trim() === '') return null;
      setSaveState('saving');
      try {
        const res = idRef.current
          ? await saveEssayDraft(idRef.current, value)
          : await createEssayDraft(themeId, value);
        const created = !idRef.current;
        idRef.current = res.id;
        lastSaved.current = value;
        qc.setQueryData(essayQuery(res.id).queryKey, res);
        void qc.invalidateQueries({ queryKey: essayListQuery.queryKey });
        setSaveState('saved');
        if (created) {
          handoff.set(res.id, latestText);
          await navigate({ to: '/redacao/$id', params: { id: res.id }, replace: true });
        }
        return res.id;
      } catch (e) {
        setSaveState('error');
        if (e instanceof ApiError && e.status === 409) toast.error(e.message);
        return null;
      }
    };
    const p = chain.current.then(run, run);
    chain.current = p;
    return p;
  }, [themeId, qc, navigate, toast]);

  function onChange(value: string) {
    setText(value);
    latestText.current = value;
    setSaveState('idle');
    if (dirtyTimer.current) clearTimeout(dirtyTimer.current);
    dirtyTimer.current = setTimeout(() => void save(), SAVE_DELAY_MS);
  }

  useEffect(
    () => () => {
      if (dirtyTimer.current) clearTimeout(dirtyTimer.current);
    },
    [],
  );

  const submit = useMutation({
    mutationFn: async () => {
      if (dirtyTimer.current) clearTimeout(dirtyTimer.current);
      const id = await save();
      if (!id) throw new ApiError(0, 'SAVE_FAILED', 'Não foi possível salvar o rascunho.');
      return correctEssay(id);
    },
    onSuccess: (res) => {
      qc.setQueryData(essayQuery(res.id).queryKey, res);
      void qc.invalidateQueries({ queryKey: essayQuotaQuery.queryKey });
      void qc.invalidateQueries({ queryKey: essayListQuery.queryKey });
      setConfirmOpen(false);
      toast.success('Redação corrigida!');
      void navigate({ to: '/redacao/$id', params: { id: res.id }, replace: true });
    },
    onError: (e) => {
      setConfirmOpen(false);
      if (e instanceof ApiError && e.code === 'DAILY_LIMIT') {
        const next = (e.details as { nextAvailableAt?: string } | undefined)?.nextAvailableAt;
        toast.error(next ? `Limite diário atingido. Volte em ${formatDateTime(next)}.` : e.message);
        void qc.invalidateQueries({ queryKey: essayQuotaQuery.queryKey });
      } else {
        toast.error(e instanceof Error ? e.message : 'Erro ao enviar a redação.');
      }
    },
  });

  const chars = text.length;
  const lines = estimateLines(text);
  const tooShort = chars < ESSAY_MIN_CHARS;
  const tooLong = chars > ESSAY_MAX_CHARS;
  const overSheet = lines > ESSAY_SHEET_LINES;
  const quotaOk = quota.data?.availableToday ?? true;
  const canSubmit = !tooShort && !tooLong && quotaOk && chars <= ESSAY_DRAFT_MAX_CHARS;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-2">
          <p className="text-sm font-semibold tracking-wide text-muted uppercase">Tema</p>
          <h2 className="text-xl sm:text-2xl">{themeTitle}</h2>
          {supportingTexts && (
            <details className="mt-1 rounded-xl border-2 border-line-soft p-3">
              <summary className="cursor-pointer text-sm font-semibold">Textos de apoio</summary>
              <RichText className="mt-2 text-sm">{supportingTexts}</RichText>
            </details>
          )}
        </Card>

        <div className="rounded-2xl border-2 border-line bg-surface shadow-hard">
          <label htmlFor="essay-text" className="sr-only">
            Texto da redação
          </label>
          <textarea
            id="essay-text"
            ref={textareaRef}
            value={text}
            onChange={(e) => onChange(e.target.value)}
            spellCheck
            lang="pt-BR"
            aria-describedby="essay-counters"
            placeholder="Escreva sua redação dissertativo-argumentativa aqui…"
            className="paper field-sizing-content block w-full resize-none rounded-2xl border-0 bg-transparent py-0 pr-4 pl-6 text-base text-ink placeholder:text-muted/70"
            style={{ minHeight: `calc(${ESSAY_SHEET_LINES} * 1.875rem)` }}
          />
        </div>
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
        <Card id="essay-counters" className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold">Linhas (estimadas)</span>
            <Badge tone={overSheet ? 'danger' : 'neutral'}>
              {lines}/{ESSAY_SHEET_LINES}
            </Badge>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold">Caracteres</span>
            <Badge tone={tooLong ? 'danger' : tooShort ? 'highlight' : 'success'}>
              {chars}/{ESSAY_MAX_CHARS}
            </Badge>
          </div>
          <p
            role={tooLong || (tooShort && chars > 0) ? 'status' : undefined}
            className="flex items-start gap-2 text-sm text-muted"
          >
            {tooLong ? (
              <>
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
                Passou do limite de {ESSAY_MAX_CHARS} caracteres. Reduza o texto para enviar.
              </>
            ) : tooShort ? (
              <>
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                Mínimo de {ESSAY_MIN_CHARS} caracteres para enviar à correção.
              </>
            ) : overSheet ? (
              'Seu texto pode passar das 30 linhas da folha oficial.'
            ) : (
              'Tamanho adequado para a correção.'
            )}
          </p>
          <p className="flex items-center gap-2 text-sm" aria-live="polite">
            {saveState === 'saving' && (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden /> Salvando…
              </>
            )}
            {saveState === 'saved' && (
              <>
                <Check className="size-4 text-success" aria-hidden /> Rascunho salvo
              </>
            )}
            {saveState === 'error' && (
              <span className="text-danger">Não foi possível salvar. Tentaremos de novo.</span>
            )}
            {saveState === 'idle' && <span className="text-muted">Salvamento automático</span>}
          </p>
        </Card>

        <Card className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Clock className="size-4" aria-hidden /> Cronômetro
            </span>
            <span
              className={`font-mono text-lg ${seconds > TARGET_SECONDS ? 'text-danger' : ''}`}
              aria-live="off"
            >
              {formatClock(seconds)}
            </span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setTimerOn((v) => !v)}>
              {timerOn ? 'Pausar' : seconds > 0 ? 'Retomar' : 'Iniciar'}
            </Button>
            {seconds > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setTimerOn(false);
                  setSeconds(0);
                }}
              >
                Zerar
              </Button>
            )}
          </div>
          <p className="text-xs text-muted">Sugestão: uma hora para a redação, como no ENEM.</p>
        </Card>

        <Card className="flex flex-col gap-3">
          {quota.data && !quota.data.availableToday && quota.data.nextAvailableAt && (
            <p role="status" className="text-sm text-danger">
              Você já usou sua correção de hoje. Próxima em{' '}
              {formatDateTime(quota.data.nextAvailableAt)}.
            </p>
          )}
          <Button size="lg" disabled={!canSubmit} onClick={() => setConfirmOpen(true)}>
            <Send className="size-5" aria-hidden /> Enviar para correção
          </Button>
          <p className="text-xs text-muted">
            Você tem 1 correção por dia. Depois de enviada, a redação não pode mais ser editada.
          </p>
        </Card>
      </aside>

      <Dialog
        open={confirmOpen}
        onClose={() => !submit.isPending && setConfirmOpen(false)}
        title="Enviar para correção?"
      >
        <div className="flex flex-col gap-4">
          <p>
            Você tem direito a <strong>1 correção por dia</strong>. Ao enviar, o limite de hoje será
            usado e a redação ficará bloqueada para edição.
          </p>
          {quota.data && !quota.data.aiEnabled && (
            <p className="rounded-xl border-2 border-line bg-highlight p-3 text-sm text-[#14213d]">
              Este servidor está em modo demonstração: a correção será uma estimativa simples, sem
              IA.
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <Button
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
              disabled={submit.isPending}
            >
              Voltar e revisar
            </Button>
            <Button loading={submit.isPending} onClick={() => submit.mutate()}>
              Enviar agora
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
