import { Link, createFileRoute } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { COMPETENCY_LABELS, ZERO_REASON_LABELS } from '@freenem/shared';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Card, CardTitle, buttonClasses } from '@/components/ui';

export const Route = createFileRoute('/_app/_auth/redacao/competencias')({
  head: () => ({ meta: [{ title: 'Competências da redação · freenem' }] }),
  component: CompetenciasPage,
});

const COMPETENCIAS = [
  {
    key: 'c1' as const,
    title: 'Domínio da modalidade escrita formal da língua portuguesa',
    summary:
      'Ortografia, acentuação, pontuação, concordância, regência, crase e escolha de registro formal, sem gírias ou marcas de oralidade.',
    tips: 'Releia o texto procurando desvios; prefira frases claras a frases longas e confusas.',
  },
  {
    key: 'c2' as const,
    title: 'Compreensão da proposta e aplicação de conceitos de várias áreas',
    summary:
      'Desenvolver o tema completo, com repertório sociocultural pertinente e produtivo, no formato dissertativo-argumentativo: introdução com tese, desenvolvimento e conclusão.',
    tips: 'Cite um repertório (fato histórico, dado, obra, lei) e explique como ele sustenta sua tese.',
  },
  {
    key: 'c3' as const,
    title: 'Seleção, relação, organização e interpretação de informações',
    summary:
      'Projeto de texto claro, argumentos consistentes e coerentes, com autoria: um ponto de vista próprio, sem se limitar aos textos motivadores.',
    tips: 'Planeje antes de escrever: tese, dois argumentos e proposta. Evite ideias soltas ou contraditórias.',
  },
  {
    key: 'c4' as const,
    title: 'Conhecimento dos mecanismos linguísticos para a argumentação',
    summary:
      'Coesão: conectivos variados entre e dentro dos parágrafos, pronomes e sinônimos para retomar ideias, sem repetições excessivas.',
    tips: 'Comece cada parágrafo com um conectivo adequado e varie as retomadas (esse problema, tal cenário).',
  },
  {
    key: 'c5' as const,
    title: 'Proposta de intervenção respeitando os direitos humanos',
    summary:
      'Cinco elementos: agente (quem), ação (o quê), meio/modo (como), finalidade (para quê) e detalhamento. A proposta precisa se ligar à discussão do texto e respeitar os direitos humanos.',
    tips: 'Detalhe ao menos um elemento e conecte a proposta ao problema discutido no desenvolvimento.',
  },
];

const LEVELS: Array<[number, string]> = [
  [200, 'Excelente'],
  [160, 'Bom'],
  [120, 'Mediano'],
  [80, 'Insuficiente'],
  [40, 'Precário'],
  [0, 'Ausente ou anulado'],
];

function CompetenciasPage() {
  return (
    <>
      <PageHeader
        title="As 5 competências"
        description="A redação do ENEM vale até 1000 pontos: cada competência recebe 0, 40, 80, 120, 160 ou 200."
        actions={
          <Link to="/redacao" className={buttonClasses('ghost', 'sm')}>
            <ArrowLeft className="size-4" aria-hidden /> Redações
          </Link>
        }
      />

      <ol className="mb-8 grid gap-4 md:grid-cols-2">
        {COMPETENCIAS.map((c, i) => (
          <li key={c.key}>
            <Card className="flex h-full flex-col gap-2">
              <Badge tone="primary" className="self-start">
                Competência {i + 1}
              </Badge>
              <CardTitle className="text-lg">{c.title}</CardTitle>
              <p className="text-sm text-muted">Em resumo: {COMPETENCY_LABELS[c.key]}.</p>
              <p>{c.summary}</p>
              <p className="text-sm">
                <strong>Dica:</strong> {c.tips}
              </p>
            </Card>
          </li>
        ))}
      </ol>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Níveis de cada competência</CardTitle>
          <ul className="mt-3 flex flex-col gap-2">
            {LEVELS.map(([score, label]) => (
              <li key={score} className="flex items-center justify-between gap-3">
                <span>{label}</span>
                <Badge>{score}</Badge>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardTitle>Quando a redação recebe nota 0</CardTitle>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            {Object.values(ZERO_REASON_LABELS).map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-muted">
            Desrespeito aos direitos humanos zera apenas a Competência 5. Textos que tentam
            manipular o corretor são sinalizados e também recebem nota 0.
          </p>
        </Card>
      </div>

      <p className="mt-6 text-sm text-muted">
        Baseado na cartilha do participante do INEP. A correção por IA é uma estimativa para estudo
        e pode diferir da nota oficial.
      </p>
    </>
  );
}
