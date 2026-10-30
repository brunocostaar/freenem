import { useEffect, useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import QRCode from 'qrcode';
import { Copy, CreditCard, Heart } from 'lucide-react';
import { InfoPage, InfoSection } from '@/components/layout/InfoPage';
import { Button, Card, Input, buttonClasses, useToast } from '@/components/ui';
import { cn } from '@/lib/cn';
import { donations, hasCard, hasPix } from '@/lib/donations';
import { buildPixPayload } from '@/lib/pix';

export const Route = createFileRoute('/_app/apoiar')({
  head: () => ({
    meta: [
      { title: 'Apoie o freenem · freenem' },
      {
        name: 'description',
        content:
          'O freenem é gratuito e open-source. Doações voluntárias via Pix ou cartão ajudam a pagar servidor, banco de dados e a correção de redações com IA.',
      },
    ],
  }),
  component: Apoiar,
});

const PRESETS = [5, 10, 25, 50] as const;
const MIN = 1;
const MAX = 10_000;
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

type Choice = { kind: 'preset'; value: number } | { kind: 'custom' } | { kind: 'none' };

/** Interpreta "12,50" ou "12.5"; devolve valor válido (1–10000) ou mensagem de erro. */
function parseCustom(raw: string): { value?: number; error?: string } {
  const text = raw.trim().replace(',', '.');
  if (text === '') return { error: 'Informe um valor.' };
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return { error: 'Use apenas números, ex.: 15 ou 15,50.' };
  const value = Number(text);
  if (value < MIN || value > MAX)
    return { error: `O valor deve ficar entre ${brl(MIN)} e ${brl(MAX)}.` };
  return { value };
}

function Apoiar() {
  return (
    <InfoPage
      title="Apoie o freenem"
      description="O freenem é gratuito e open-source. Se ele ajuda nos seus estudos, você pode ajudar a mantê-lo no ar. Doar é totalmente voluntário."
    >
      <InfoSection title="Por que doar?">
        <p>
          Manter o freenem custa dinheiro de verdade: servidor, banco de dados, armazenamento das
          imagens das questões e, principalmente, a inteligência artificial que corrige as redações.
          Não há plano pago, anúncio nem venda de dados. Cada contribuição, de qualquer tamanho,
          ajuda a manter tudo isso gratuito para quem está estudando.
        </p>
        <p className="text-muted">
          Transparência: o dinheiro arrecadado é usado apenas para cobrir os custos de operação do
          projeto, e o código é aberto para qualquer pessoa conferir.
        </p>
      </InfoSection>

      {hasPix || hasCard ? <Donate /> : <ComingSoon />}
    </InfoPage>
  );
}

function ComingSoon() {
  return (
    <Card className="flex items-start gap-4">
      <Heart className="mt-1 size-7 shrink-0 text-accent" aria-hidden />
      <div>
        <h2 className="text-2xl">Doações em breve</h2>
        <p className="mt-1 text-muted">
          Ainda estamos preparando as formas de doação. Enquanto isso, o melhor apoio é usar, contar
          para um colega e reportar erros nas questões. Obrigado!
        </p>
      </div>
    </Card>
  );
}

function Donate() {
  return (
    <div className="space-y-6">
      {hasPix && <PixCard />}
      {hasCard && (
        <Card>
          <h2 className="flex items-center gap-2 text-2xl">
            <CreditCard className="size-6" aria-hidden /> Doar com cartão
          </h2>
          <p className="mt-2 text-muted">
            Você escolhe o valor em uma página segura do Stripe. O Pix pelo Stripe não é usado: para
            doar por Pix, use o QR code acima.
          </p>
          <a
            href={donations.cardUrl}
            target="_blank"
            rel="noreferrer noopener"
            className={cn(buttonClasses('accent', 'lg'), 'mt-4')}
          >
            <CreditCard className="size-5" aria-hidden /> Doar com cartão
            <span className="sr-only"> (abre em nova aba)</span>
          </a>
        </Card>
      )}
    </div>
  );
}

function PixCard() {
  const toast = useToast();
  const [choice, setChoice] = useState<Choice>({ kind: 'preset', value: 10 });
  const [customRaw, setCustomRaw] = useState('');
  const [svg, setSvg] = useState('');

  const custom = useMemo(() => parseCustom(customRaw), [customRaw]);
  const amount =
    choice.kind === 'preset' ? choice.value : choice.kind === 'custom' ? custom.value : undefined;
  const invalid = choice.kind === 'custom' && custom.value === undefined;

  const payload = useMemo(
    () =>
      invalid
        ? ''
        : buildPixPayload({
            key: donations.pixKey,
            name: donations.pixName,
            city: donations.pixCity,
            amount,
          }),
    [invalid, amount],
  );

  useEffect(() => {
    if (!payload) {
      setSvg('');
      return;
    }
    let cancelled = false;
    QRCode.toString(payload, { type: 'svg', margin: 1 })
      .then((s) => !cancelled && setSvg(s))
      .catch(() => !cancelled && setSvg(''));
    return () => {
      cancelled = true;
    };
  }, [payload]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(payload);
      toast.success('Código Pix copiado. Cole no app do seu banco.');
    } catch {
      toast.error('Não foi possível copiar. Selecione o código e copie manualmente.');
    }
  }

  const chip = (selected: boolean) =>
    cn(
      'h-11 rounded-xl border-2 border-line px-4 font-semibold transition-all',
      selected
        ? 'bg-highlight text-[#14213d] shadow-hard-sm'
        : 'bg-surface text-ink hover:bg-surface-2',
    );
  const label = amount !== undefined ? brl(amount) : 'sem valor definido';

  return (
    <Card>
      <h2 className="text-2xl">Doar com Pix</h2>
      <p className="mt-1 text-muted">Escolha um valor e escaneie o QR code no app do seu banco.</p>

      <div role="group" aria-label="Valor da doação" className="mt-4 flex flex-wrap gap-2">
        {PRESETS.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={choice.kind === 'preset' && choice.value === v}
            onClick={() => setChoice({ kind: 'preset', value: v })}
            className={chip(choice.kind === 'preset' && choice.value === v)}
          >
            R$ {v}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={choice.kind === 'custom'}
          onClick={() => setChoice({ kind: 'custom' })}
          className={chip(choice.kind === 'custom')}
        >
          Outro valor
        </button>
        <button
          type="button"
          aria-pressed={choice.kind === 'none'}
          onClick={() => setChoice({ kind: 'none' })}
          className={chip(choice.kind === 'none')}
        >
          Sem valor definido
        </button>
      </div>

      {choice.kind === 'custom' && (
        <div className="mt-4 max-w-xs">
          <Input
            label="Outro valor (R$)"
            inputMode="decimal"
            autoComplete="off"
            placeholder="Ex.: 15,50"
            hint={`Entre ${brl(MIN)} e ${brl(MAX)}.`}
            value={customRaw}
            onChange={(e) => setCustomRaw(e.target.value)}
            error={customRaw !== '' && custom.error ? custom.error : undefined}
          />
        </div>
      )}

      <div className="mt-6 grid gap-6 md:grid-cols-[auto_1fr] md:items-start">
        <div
          className="mx-auto grid size-56 place-items-center rounded-2xl border-2 border-line bg-white p-2 sm:size-64"
          data-testid="pix-qr"
        >
          {svg ? (
            <div
              role="img"
              aria-label={`QR code Pix para doar ${label} ao freenem`}
              className="size-full [&>svg]:size-full"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          ) : (
            <p className="px-4 text-center text-sm font-medium text-black">
              Informe um valor válido para gerar o QR code.
            </p>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          <p className="text-lg font-semibold">
            {amount !== undefined
              ? `Doação de ${brl(amount)}`
              : 'Você escolhe o valor no seu banco'}
          </p>
          <Button onClick={copy} disabled={!payload} size="lg">
            <Copy className="size-5" aria-hidden /> Copiar código Pix
          </Button>
          <dl className="space-y-1 text-sm">
            <div className="flex flex-wrap gap-x-2">
              <dt className="font-semibold">Chave Pix:</dt>
              <dd className="break-all">{donations.pixKey}</dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="font-semibold">Recebedor:</dt>
              <dd>{donations.pixName}</dd>
            </div>
          </dl>
        </div>
      </div>
    </Card>
  );
}
