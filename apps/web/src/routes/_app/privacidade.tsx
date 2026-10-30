import { Link, createFileRoute } from '@tanstack/react-router';
import { InfoPage, InfoSection } from '@/components/layout/InfoPage';

export const Route = createFileRoute('/_app/privacidade')({
  head: () => ({
    meta: [
      { title: 'Privacidade · freenem' },
      {
        name: 'description',
        content: 'Quais dados o freenem guarda, para quê, e como excluir a sua conta (LGPD).',
      },
    ],
  }),
  component: Privacidade,
});

function Privacidade() {
  return (
    <InfoPage
      title="Política de privacidade"
      description="Em linguagem simples: o que guardamos, por quê e como você controla seus dados (Lei Geral de Proteção de Dados, LGPD)."
    >
      <InfoSection title="Dados que guardamos">
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <strong>Conta:</strong> nome, e-mail e senha (guardada apenas como hash). Se você entrar
            com o Google, recebemos nome, e-mail e foto da sua conta Google.
          </li>
          <li>
            <strong>Estudo:</strong> as questões que você responde (alternativa, acerto, tempo),
            questões salvas, simulados e seus resultados, e seu plano de estudos.
          </li>
          <li>
            <strong>Redações:</strong> o texto que você escreve e as correções geradas.
          </li>
          <li>
            <strong>Sessão:</strong> um cookie de login necessário para o site funcionar. Não usamos
            cookies de publicidade nem rastreadores de terceiros.
          </li>
        </ul>
      </InfoSection>

      <InfoSection title="Para que usamos">
        <p>
          Apenas para oferecer o serviço: mostrar seu desempenho, montar seu plano e calcular suas
          notas. Não vendemos nem compartilhamos seus dados com anunciantes. As estatísticas
          públicas de uma questão (por exemplo, a porcentagem por alternativa) são agregadas e não
          identificam ninguém.
        </p>
      </InfoSection>

      <InfoSection title="Correção de redação com IA">
        <p>
          Quando a correção por IA está ativada, o texto da sua redação é enviado à Anthropic (a
          empresa do modelo Claude) apenas para gerar a correção. O texto é enviado como conteúdo a
          ser avaliado, e não faz parte das instruções do sistema. Não envie dados pessoais
          sensíveis no corpo da redação. Quando a IA está desativada, o servidor usa uma correção de
          demonstração e nada é enviado a terceiros.
        </p>
      </InfoSection>

      <InfoSection title="Seus direitos">
        <p>
          Você pode ver e corrigir seu nome na página{' '}
          <Link to="/conta" className="font-semibold underline">
            Minha conta
          </Link>{' '}
          e <strong>excluir a conta a qualquer momento</strong>. A exclusão apaga imediatamente a
          conta e tudo o que está ligado a ela: respostas, simulados, plano, redações, correções e
          reportes enviados. Não é possível desfazer. Se preferir, também atendemos pedidos de
          exclusão ou de cópia dos seus dados pelas issues do repositório do projeto.
        </p>
      </InfoSection>

      <InfoSection title="Mudanças">
        <p>
          Se esta política mudar de forma relevante, avisaremos no site. O histórico fica registrado
          no repositório público do projeto.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
