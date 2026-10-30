import { Link, createFileRoute } from '@tanstack/react-router';
import { InfoPage, InfoSection } from '@/components/layout/InfoPage';
import { GITHUB_URL } from '@/lib/site';

export const Route = createFileRoute('/_app/sobre')({
  head: () => ({
    meta: [
      { title: 'Sobre · freenem' },
      {
        name: 'description',
        content:
          'O que é o freenem, como funciona a nota TRI estimada, de onde vêm as questões e como contribuir.',
      },
    ],
  }),
  component: Sobre,
});

const ext = { target: '_blank', rel: 'noreferrer noopener' } as const;

function Sobre() {
  return (
    <InfoPage
      title="Sobre o freenem"
      description="Uma plataforma de estudos para o ENEM e vestibulares, gratuita e de código aberto."
    >
      <InfoSection title="O que é">
        <p>
          O freenem reúne em um só lugar o que normalmente está espalhado ou atrás de assinaturas:
          banco de questões com gabarito e resolução, simulados com nota estimada por TRI, correção
          de redação com inteligência artificial e um plano de estudos semanal baseado nos seus
          pontos fracos. Não há plano pago, anúncio nem limite escondido.
        </p>
      </InfoSection>

      <InfoSection title="Código aberto">
        <p>
          O código é livre sob a licença AGPL-3.0: qualquer pessoa pode ler, auditar, sugerir
          melhorias e hospedar a própria cópia. O projeto vive no{' '}
          <a href={GITHUB_URL} {...ext} className="font-semibold underline">
            GitHub
          </a>
          .
        </p>
      </InfoSection>

      <InfoSection title="Como a nota TRI é estimada">
        <p>
          A prova do ENEM não conta acertos: usa a Teoria de Resposta ao Item (TRI). Cada questão
          tem três parâmetros publicados pelo INEP: discriminação (a), dificuldade (b) e chance de
          acerto ao acaso (c). Acertar uma questão difícil vale mais do que acertar uma fácil, e
          acertar uma questão fácil depois de errar várias outras pesa menos.
        </p>
        <p>
          No freenem, o simulado estima o seu nível de proficiência pelo modelo logístico de 3
          parâmetros, com estimativa EAP (esperança a posteriori), e converte o resultado para a
          escala do ENEM (média 500, desvio-padrão 100).
        </p>
        <p className="font-semibold">Limites que você precisa conhecer:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            É uma <strong>estimativa</strong>, não a nota oficial. O INEP calibra cada edição com
            todos os itens e a população do exame, o que não conseguimos reproduzir.
          </li>
          <li>
            Simulados curtos ou com poucas questões com parâmetros têm margem de erro grande. Use a
            nota para acompanhar a evolução, não como previsão exata.
          </li>
          <li>
            Questões sem parâmetros TRI (por exemplo, de outros vestibulares) não entram no cálculo.
          </li>
        </ul>
      </InfoSection>

      <InfoSection title="Fontes dos dados e atribuição">
        <ul className="list-disc space-y-1 pl-6">
          <li>
            As provas e os gabaritos do ENEM são do{' '}
            <a href="https://www.gov.br/inep" {...ext} className="font-semibold underline">
              INEP
            </a>
            , assim como os microdados com os parâmetros da TRI.
          </li>
          <li>
            As questões foram importadas do dataset aberto{' '}
            <a
              href="https://github.com/yunger7/enem-api"
              {...ext}
              className="font-semibold underline"
            >
              enem-api
            </a>{' '}
            (licença GPL-2.0), com classificação por matéria e assunto feita pelo freenem. Cada
            questão mostra a sua fonte.
          </li>
        </ul>
        <p>
          Encontrou um erro? Use o botão “Reportar erro” em qualquer questão: os reportes ajudam a
          manter o banco correto para todo mundo.
        </p>
      </InfoSection>

      <InfoSection title="Contato e como contribuir">
        <p>
          Sugestões, bugs e correções de questões são bem-vindos nas issues do repositório. Quer
          programar? Leia o README e o CLAUDE.md do projeto para ver como rodar localmente e as
          convenções de código. Para assuntos de privacidade, veja a{' '}
          <Link to="/privacidade" className="font-semibold underline">
            política de privacidade
          </Link>
          .
        </p>
      </InfoSection>
    </InfoPage>
  );
}
