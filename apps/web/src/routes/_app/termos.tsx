import { Link, createFileRoute } from '@tanstack/react-router';
import { InfoPage, InfoSection } from '@/components/layout/InfoPage';
import { GITHUB_URL } from '@/lib/site';

const UPDATED_AT = '15 de novembro de 2026';

export const Route = createFileRoute('/_app/termos')({
  head: () => ({
    meta: [
      { title: 'Termos de uso · freenem' },
      {
        name: 'description',
        content:
          'Regras de uso do freenem: conta, conteúdo, correção por IA, notas estimadas e responsabilidades.',
      },
    ],
  }),
  component: Termos,
});

const link = 'font-semibold underline';

function Termos() {
  return (
    <InfoPage
      title="Termos de uso"
      description="As regras para usar o freenem, em linguagem simples. Ao criar uma conta ou usar o site, você concorda com elas."
    >
      <p className="text-sm text-muted">Última atualização: {UPDATED_AT}.</p>

      <InfoSection title="O que é o freenem">
        <p>
          O freenem (freenem.com.br) é uma plataforma gratuita e de código aberto para estudar para
          o ENEM e vestibulares: banco de questões, simulados com nota estimada, plano de estudos e
          correção de redação com inteligência artificial. Não há planos pagos nem anúncios. O
          freenem não tem vínculo com o INEP, o MEC nem com as bancas e universidades cujas provas
          aparecem no site.
        </p>
      </InfoSection>

      <InfoSection title="Sua conta">
        <ul className="list-disc space-y-1 pl-6">
          <li>Use informações verdadeiras e mantenha sua senha em segredo; a conta é pessoal.</li>
          <li>Se você tem menos de 18 anos, use o site com o conhecimento de um responsável.</li>
          <li>
            Você pode excluir a conta quando quiser em{' '}
            <Link to="/conta" className={link}>
              Minha conta
            </Link>
            . O que acontece com os seus dados está na{' '}
            <Link to="/privacidade" className={link}>
              Política de privacidade
            </Link>
            .
          </li>
        </ul>
      </InfoSection>

      <InfoSection title="Uso aceitável">
        <p>Para manter o site útil e no ar para todo mundo, não é permitido:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            publicar conteúdo ofensivo, discriminatório, ilegal, spam ou dados pessoais de outras
            pessoas;
          </li>
          <li>
            tentar invadir, sobrecarregar ou burlar limites do sistema, inclusive com robôs que
            copiem o banco de questões em massa;
          </li>
          <li>usar a conta de outra pessoa ou se passar por alguém.</li>
        </ul>
        <p>Podemos remover conteúdo e suspender ou excluir contas que descumpram estas regras.</p>
      </InfoSection>

      <InfoSection title="O que você publica">
        <p>
          Resoluções e reportes de erro que você envia continuam sendo seus. Ao publicá-los, você
          autoriza o freenem a exibi-los, adaptá-los (por exemplo, corrigir a formatação) e
          mantê-los no site, gratuitamente, para ajudar outros estudantes. Resoluções passam por
          moderação e podem ser editadas ou removidas. Não publique textos de terceiros sem
          permissão.
        </p>
      </InfoSection>

      <InfoSection title="Questões e direitos autorais">
        <p>
          As questões do ENEM são públicas (INEP). As de vestibulares (como FUVEST, UNICAMP e UFRGS)
          pertencem às respectivas instituições e aparecem para fins educacionais, sempre com a
          fonte citada. Se você é titular de algum conteúdo e quer a remoção, peça pelas{' '}
          <a href={`${GITHUB_URL}/issues`} target="_blank" rel="noreferrer" className={link}>
            issues do repositório
          </a>{' '}
          e atenderemos. O código do freenem é livre sob a licença AGPL-3.0; isso vale para o
          software, não para o conteúdo das provas.
        </p>
      </InfoSection>

      <InfoSection title="Notas, gabaritos e correção por IA">
        <p>
          A nota TRI dos simulados é uma <strong>estimativa</strong> calculada a partir de
          parâmetros públicos do INEP; ela não é a nota oficial e pode diferir do resultado real. A
          correção de redação é feita por inteligência artificial seguindo as competências do ENEM,
          serve para treino e pode errar: não é a avaliação de um corretor oficial. Revisamos as
          questões com cuidado, mas erros de digitação, de imagem ou de gabarito podem acontecer; se
          encontrar um, use o botão de reportar na questão.
        </p>
      </InfoSection>

      <InfoSection title="Doações">
        <p>
          Doações pelo{' '}
          <Link to="/apoiar" className={link}>
            Apoiar
          </Link>{' '}
          são voluntárias, ajudam a pagar os custos do site e não dão acesso a recursos extras. Se
          você doou por engano, entre em contato pelas issues do repositório.
        </p>
      </InfoSection>

      <InfoSection title="Disponibilidade e responsabilidade">
        <p>
          O freenem é oferecido gratuitamente, como está, e é mantido de forma independente. Fazemos
          o possível para mantê-lo no ar e correto, mas ele pode ficar fora do ar, mudar ou ter
          recursos removidos, e não garantimos aprovação em nenhum exame. Na medida permitida pela
          lei, o freenem não se responsabiliza por decisões tomadas com base em notas estimadas,
          correções automáticas ou eventuais erros de conteúdo. Nada nestes termos limita direitos
          que você tenha pelo Código de Defesa do Consumidor.
        </p>
      </InfoSection>

      <InfoSection title="Mudanças nestes termos">
        <p>
          Podemos atualizar estes termos. Mudanças relevantes serão avisadas no site e a data no
          topo será atualizada; o histórico fica no repositório público. Continuar usando o freenem
          depois de uma mudança significa concordar com a nova versão.
        </p>
      </InfoSection>

      <InfoSection title="Lei aplicável e contato">
        <p>
          Estes termos seguem as leis brasileiras, incluindo o Marco Civil da Internet, a LGPD e o
          Código de Defesa do Consumidor, e eventuais conflitos podem ser resolvidos no foro do seu
          domicílio. Dúvidas e pedidos: pelas{' '}
          <a href={`${GITHUB_URL}/issues`} target="_blank" rel="noreferrer" className={link}>
            issues do repositório
          </a>
          .
        </p>
      </InfoSection>
    </InfoPage>
  );
}
