import { Link, createFileRoute } from '@tanstack/react-router';
import { InfoPage, InfoSection } from '@/components/layout/InfoPage';

const UPDATED_AT = '15 de novembro de 2026';
const REPO_ISSUES = 'https://github.com/brunocostaar/freenem/issues';

export const Route = createFileRoute('/_app/privacidade')({
  head: () => ({
    meta: [
      { title: 'Privacidade · freenem' },
      {
        name: 'description',
        content:
          'Quais dados o freenem guarda, para quê, com quem compartilha e como excluir a sua conta (LGPD).',
      },
    ],
  }),
  component: Privacidade,
});

const extLink = 'font-semibold underline';

function Privacidade() {
  return (
    <InfoPage
      title="Política de privacidade"
      description="Em linguagem simples: o que guardamos, por quê, com quem e como você controla seus dados (Lei Geral de Proteção de Dados, LGPD)."
    >
      <p className="text-sm text-muted">Última atualização: {UPDATED_AT}.</p>

      <InfoSection title="Quem somos">
        <p>
          O freenem (freenem.com.br) é uma plataforma gratuita e de código aberto para estudar para
          o ENEM e vestibulares. Ele é o responsável (controlador) pelos dados descritos aqui. As
          regras de uso do site estão nos{' '}
          <Link to="/termos" className={extLink}>
            Termos de uso
          </Link>
          .
        </p>
      </InfoSection>

      <InfoSection title="Dados que guardamos">
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <strong>Conta:</strong> nome, e-mail e senha (guardada apenas como hash, nunca em
            texto). Se você entrar com o Google, recebemos só o nome, o e-mail e a foto do seu
            perfil Google.
          </li>
          <li>
            <strong>Estudo:</strong> as questões que você responde (alternativa, acerto, tempo),
            questões salvas, simulados e seus resultados, e seu plano de estudos.
          </li>
          <li>
            <strong>Redações:</strong> o texto que você escreve e as correções geradas.
          </li>
          <li>
            <strong>Contribuições:</strong> resoluções e reportes de erro que você envia.
          </li>
          <li>
            <strong>Sessão e segurança:</strong> um cookie de login necessário para o site
            funcionar, e registros técnicos de acesso (como endereço IP e navegador) usados para
            segurança e para corrigir falhas. Não usamos cookies de publicidade nem rastreadores de
            terceiros.
          </li>
        </ul>
      </InfoSection>

      <InfoSection title="Para que usamos">
        <p>
          Apenas para oferecer o serviço: manter sua conta, mostrar seu desempenho, montar seu
          plano, calcular suas notas e corrigir suas redações. Não vendemos seus dados, não os
          usamos para publicidade e não os compartilhamos com anunciantes. As estatísticas públicas
          de uma questão (por exemplo, a porcentagem por alternativa) são agregadas e não
          identificam ninguém. A base legal é a execução do serviço que você pediu ao criar a conta
          (LGPD, art. 7º, V) e, para os registros de segurança, o nosso legítimo interesse (art. 7º,
          IX).
        </p>
      </InfoSection>

      <InfoSection title="Login com o Google">
        <p>
          Se você escolher "Continuar com Google", pedimos ao Google apenas o seu perfil básico
          (nome, e-mail e foto). Não temos acesso a Gmail, Drive, contatos ou qualquer outro dado da
          sua conta Google. Usamos essas informações só para criar e identificar a sua conta no
          freenem, e elas não são vendidas, não são usadas para publicidade e não são usadas para
          treinar modelos de inteligência artificial.
        </p>
        <p>
          O uso e a transferência, para qualquer outro aplicativo, das informações recebidas das
          APIs do Google seguem a{' '}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noreferrer"
            className={extLink}
          >
            Política de Dados do Usuário dos Serviços de API do Google
          </a>
          , incluindo os requisitos de Uso Limitado. Você pode revogar o acesso a qualquer momento
          em{' '}
          <a
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noreferrer"
            className={extLink}
          >
            myaccount.google.com/permissions
          </a>
          .
        </p>
      </InfoSection>

      <InfoSection title="Correção de redação com IA">
        <p>
          Para corrigir uma redação, o texto dela e o tema são enviados a um provedor de
          inteligência artificial, hoje a DeepSeek (com servidores na China). Seu nome e seu e-mail
          não são enviados. O texto vai como conteúdo a ser avaliado, e não como instrução ao
          modelo. Evite colocar dados pessoais no corpo da redação. Quando a correção por IA está
          desativada, o servidor usa uma correção de demonstração e nada é enviado a terceiros.
        </p>
      </InfoSection>

      <InfoSection title="Onde os dados ficam e com quem compartilhamos">
        <p>
          Usamos alguns fornecedores para operar o site, que tratam os dados apenas em nosso nome:
        </p>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <strong>Railway</strong>: servidores da aplicação e banco de dados (Estados Unidos).
          </li>
          <li>
            <strong>Cloudflare</strong>: hospedagem do site e das imagens das questões, e proteção
            contra ataques. As fontes de texto são servidas por nós mesmos, sem consultar o Google.
          </li>
          <li>
            <strong>Google</strong>: somente se você usar o login com Google.
          </li>
          <li>
            <strong>DeepSeek</strong>: somente o texto das redações enviadas para correção.
          </li>
        </ul>
        <p>
          Por isso, parte dos dados é armazenada ou processada fora do Brasil, sempre com
          fornecedores que adotam medidas de segurança compatíveis com a LGPD (art. 33). Também
          podemos fornecer dados quando exigido por lei ou por ordem judicial.
        </p>
      </InfoSection>

      <InfoSection title="Por quanto tempo guardamos">
        <p>
          Enquanto a sua conta existir. Ao excluir a conta, os dados são apagados imediatamente do
          banco de dados; cópias de segurança técnicas dos fornecedores são descartadas no ciclo
          normal delas. Registros técnicos de acesso são mantidos por pouco tempo, apenas para
          segurança.
        </p>
      </InfoSection>

      <InfoSection title="Menores de idade">
        <p>
          O freenem é feito para estudantes, e muitos têm menos de 18 anos. Coletamos apenas o
          mínimo necessário para o estudo e nunca usamos dados para publicidade. Se você é menor de
          idade, use o site com o conhecimento de um responsável.
        </p>
      </InfoSection>

      <InfoSection title="Seus direitos">
        <p>
          Você pode ver e corrigir seu nome na página{' '}
          <Link to="/conta" className={extLink}>
            Minha conta
          </Link>
          , <strong>baixar uma cópia dos seus dados</strong> em JSON (botão "Baixar meus dados",
          portabilidade) e <strong>excluir a conta a qualquer momento</strong>. A exclusão apaga a
          conta e tudo o que está ligado a ela: respostas, simulados, plano, redações, correções e
          reportes enviados. Não é possível desfazer.
        </p>
        <p>
          Pela LGPD você também pode pedir confirmação de que tratamos seus dados, acesso, correção
          ou exclusão, e informações sobre compartilhamento. Faça o pedido pelas{' '}
          <a href={REPO_ISSUES} target="_blank" rel="noreferrer" className={extLink}>
            issues do repositório do projeto
          </a>{' '}
          (sem expor dados pessoais na issue; combinamos lá um canal privado). Você também pode
          reclamar à Autoridade Nacional de Proteção de Dados (ANPD).
        </p>
      </InfoSection>

      <InfoSection title="Mudanças">
        <p>
          Se esta política mudar de forma relevante, avisaremos no site e atualizaremos a data no
          topo. O histórico fica registrado no repositório público do projeto.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
