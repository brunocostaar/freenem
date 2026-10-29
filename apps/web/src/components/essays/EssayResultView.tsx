import { AlertTriangle, FlaskConical, ShieldAlert } from 'lucide-react';
import {
  COMPETENCY_KEYS,
  COMPETENCY_LABELS,
  ZERO_REASON_LABELS,
  type EssayResult,
} from '@freenem/shared';
import { Badge, Card, CardTitle } from '@/components/ui';

const COMPETENCY_NUMBERS = { c1: 1, c2: 2, c3: 3, c4: 4, c5: 5 } as const;

function ScoreBar({ score, label }: { score: number; label: string }) {
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={200}
      aria-valuenow={score}
      className="h-3 w-full overflow-hidden rounded-full border-2 border-line bg-surface-2"
    >
      <div className="h-full bg-primary" style={{ width: `${(score / 200) * 100}%` }} />
    </div>
  );
}

/** Resultado da correção: nota, competências, feedback e avisos. */
export function EssayResultView({ essay }: { essay: EssayResult }) {
  const c = essay.correction;
  if (!c) return null;
  const flagged = essay.status === 'flagged';
  const total = essay.totalScore ?? 0;

  return (
    <div className="flex flex-col gap-5">
      {c.isDemo && (
        <div
          role="note"
          className="flex items-start gap-3 rounded-2xl border-2 border-line bg-highlight p-4 text-[#14213d]"
        >
          <FlaskConical className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p className="text-sm font-medium">
            <strong>Correção de demonstração.</strong> Esta nota foi estimada por regras simples,
            sem inteligência artificial, e não reflete uma avaliação real.
          </p>
        </div>
      )}

      {flagged && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border-2 border-danger bg-surface p-4"
        >
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />
          <div className="text-sm">
            <p className="font-bold text-danger">Redação sinalizada</p>
            <p className="mt-1">
              O texto contém trechos que tentam manipular a correção. Pelas regras do ENEM, partes
              deliberadamente desconectadas do tema são desconsideradas, e a nota foi 0.
            </p>
          </div>
        </div>
      )}

      {!flagged && c.zeroReason && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border-2 border-danger bg-surface p-4"
        >
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />
          <div className="text-sm">
            <p className="font-bold text-danger">Redação anulada (nota 0)</p>
            <p className="mt-1">Motivo: {ZERO_REASON_LABELS[c.zeroReason]}.</p>
          </div>
        </div>
      )}

      {!flagged && c.humanRightsViolation && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border-2 border-danger bg-surface p-4"
        >
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />
          <p className="text-sm">
            <strong className="text-danger">Desrespeito aos direitos humanos:</strong> a Competência
            5 recebeu nota 0. As demais competências não são afetadas.
          </p>
        </div>
      )}

      <Card className="flex flex-col items-center gap-1 text-center">
        <p className="text-sm font-semibold tracking-wide text-muted uppercase">Nota final</p>
        <p className="font-display text-7xl leading-none font-extrabold sm:text-8xl">
          <span className="marker" aria-label={`${total} de 1000`}>
            {total}
          </span>
        </p>
        <p className="text-muted">de 1000 pontos</p>
      </Card>

      <section aria-labelledby="competencias-titulo" className="flex flex-col gap-3">
        <h2 id="competencias-titulo" className="text-2xl">
          Competências
        </h2>
        <ul className="grid gap-4 md:grid-cols-2">
          {COMPETENCY_KEYS.map((k) => {
            const r = c[k];
            return (
              <li key={k}>
                <Card className="flex h-full flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-lg">
                      C{COMPETENCY_NUMBERS[k]} · {COMPETENCY_LABELS[k]}
                    </CardTitle>
                    <Badge tone={r.score >= 160 ? 'success' : r.score >= 80 ? 'neutral' : 'danger'}>
                      {r.score}/200
                    </Badge>
                  </div>
                  <ScoreBar score={r.score} label={`Competência ${COMPETENCY_NUMBERS[k]}`} />
                  <p className="text-sm">{r.justification}</p>
                  {r.suggestions.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold">Como melhorar</p>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted">
                        {r.suggestions.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      </section>

      <Card>
        <CardTitle>Feedback geral</CardTitle>
        <p className="mt-2 whitespace-pre-line">{c.generalFeedback}</p>
      </Card>
    </div>
  );
}
