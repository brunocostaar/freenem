import { Link, createFileRoute, redirect } from '@tanstack/react-router';
import {
  ArrowRight,
  BookOpenCheck,
  CalendarCheck,
  ClipboardList,
  GitFork,
  Heart,
  PenLine,
} from 'lucide-react';
import { Badge, buttonClasses, Card } from '@/components/ui';
import { RichText } from '@/components/RichText';
import { Logo } from '@/components/layout/Logo';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { authClient, useSession } from '@/lib/auth-client';
import { cn } from '@/lib/cn';
import { GITHUB_URL } from '@/lib/site';
import { SiteFooterLinks } from '@/components/layout/SiteFooter';

export const Route = createFileRoute('/')({
  // Quem já está logado vai direto para o painel pessoal; a landing é só para visitantes.
  beforeLoad: async () => {
    const { data } = await authClient.getSession();
    if (data) throw redirect({ to: '/inicio' });
  },
  component: Landing,
});

const FEATURES = [
  {
    icon: BookOpenCheck,
    title: 'Banco de questões',
    text: 'Provas do ENEM e de vestibulares por matéria e assunto, com gabarito, resolução e busca por texto.',
    tone: 'bg-highlight text-[#14213d]',
  },
  {
    icon: ClipboardList,
    title: 'Simulados com TRI',
    text: 'Monte o seu simulado ou refaça uma prova oficial. A nota vem na escala do ENEM, calculada por TRI.',
    tone: 'bg-primary text-primary-ink',
  },
  {
    icon: PenLine,
    title: 'Redação com IA',
    text: 'Correção por competência (C1 a C5) com feedback para você melhorar a próxima. Uma por dia, de graça.',
    tone: 'bg-accent text-accent-ink',
  },
  {
    icon: CalendarCheck,
    title: 'Plano de estudos',
    text: 'Um cronograma semanal que cruza seus pontos fracos, o que mais cai na prova e o tempo que falta.',
    tone: 'bg-success text-bg',
  },
];

function Landing() {
  const { data: session } = useSession();
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          {session ? (
            <Link to="/questoes" className={buttonClasses('primary', 'sm')}>
              Ir para o app
            </Link>
          ) : (
            <>
              <Link
                to="/entrar"
                className={cn(buttonClasses('ghost', 'sm'), 'hidden sm:inline-flex')}
              >
                Entrar
              </Link>
              <Link to="/cadastro" className={buttonClasses('accent', 'sm')}>
                Criar conta
              </Link>
            </>
          )}
        </nav>
      </header>

      {/* Hero */}
      <main>
        <section className="dotgrid border-y-2 border-line-soft">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 md:py-20 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <Badge tone="highlight" className="mb-5">
                100% gratuito &middot; código aberto
              </Badge>
              <h1 className="text-5xl leading-[0.98] sm:text-6xl lg:text-7xl">
                Estude para o ENEM <span className="marker">sem pagar nada</span>.
              </h1>
              <p className="mt-6 max-w-xl text-lg text-muted">
                Questões, simulados, correção de redação e plano de estudos num só lugar. O que
                plataformas pagas cobram por mês, aqui é de todo mundo.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to={session ? '/questoes' : '/cadastro'}
                  className={buttonClasses('accent', 'lg')}
                >
                  Começar agora <ArrowRight className="size-5" aria-hidden />
                </Link>
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonClasses('secondary', 'lg')}
                >
                  <GitFork className="size-5" aria-hidden /> Ver no GitHub
                </a>
              </div>
            </div>

            {/* "Adesivo" com questão de exemplo */}
            <div className="relative mx-auto w-full max-w-md lg:rotate-2">
              <Card className="relative">
                <div className="mb-3 flex items-center gap-2">
                  <Badge tone="primary">ENEM</Badge>
                  <Badge>Matemática</Badge>
                  <Badge tone="success">Funções</Badge>
                </div>
                <RichText>
                  {
                    'Uma função quadrática tem raízes $x_1 = 2$ e $x_2 = 6$. Qual é a coordenada $x$ do vértice da parábola?\n\n$$x_v = \\frac{x_1 + x_2}{2}$$'
                  }
                </RichText>
                <ul className="mt-4 grid grid-cols-5 gap-2" aria-label="Alternativas de exemplo">
                  {['A', 'B', 'C', 'D', 'E'].map((l) => (
                    <li
                      key={l}
                      className={cn(
                        'grid h-11 place-items-center rounded-xl border-2 border-line font-display text-lg font-bold',
                        l === 'C' ? 'bg-highlight text-[#14213d] shadow-hard-sm' : 'bg-surface',
                      )}
                    >
                      {l}
                    </li>
                  ))}
                </ul>
              </Card>
              <div className="absolute -right-3 -bottom-5 rotate-6 rounded-xl border-2 border-line bg-accent px-3 py-1.5 font-display text-sm font-extrabold text-accent-ink shadow-hard-sm">
                nota TRI: 712
              </div>
            </div>
          </div>
        </section>

        {/* Funcionalidades */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
          <h2 className="max-w-2xl text-4xl sm:text-5xl">
            Tudo para a sua prova, <span className="marker">num lugar só</span>
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <Card
                key={f.title}
                className="flex flex-col gap-3 transition-transform hover:-translate-y-1"
              >
                <div
                  className={cn(
                    'grid size-12 place-items-center rounded-xl border-2 border-line shadow-hard-sm',
                    f.tone,
                  )}
                >
                  <f.icon className="size-6" aria-hidden />
                </div>
                <h3 className="text-2xl">{f.title}</h3>
                <p className="text-muted">{f.text}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Open source */}
        <section className="border-y-2 border-line bg-highlight text-[#14213d]">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <h2 className="flex items-center gap-3 text-4xl sm:text-5xl">
                <Heart className="size-9 shrink-0 fill-current" aria-hidden /> Gratuito de verdade
              </h2>
              <p className="mt-4 text-lg font-medium">
                Sem plano pago, sem anúncio, sem limite escondido. O freenem é open-source
                (AGPL-3.0): qualquer pessoa pode ler o código, sugerir melhorias, corrigir questões
                e hospedar a própria cópia.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row md:flex-col">
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-14 items-center gap-2 rounded-xl border-2 border-[#14213d] bg-[#14213d] px-7 text-lg font-semibold whitespace-nowrap text-[#fbf6ea] shadow-[4px_4px_0_0_#ff5b2e] transition-transform hover:-translate-y-0.5"
              >
                <GitFork className="size-5" aria-hidden /> Contribuir no GitHub
              </a>
              <Link
                to="/apoiar"
                className="inline-flex h-14 items-center justify-center gap-2 rounded-xl border-2 border-[#14213d] px-7 text-lg font-semibold whitespace-nowrap text-[#14213d] transition-transform hover:-translate-y-0.5"
              >
                <Heart className="size-5" aria-hidden /> Apoiar o projeto
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-10 text-sm text-muted sm:flex-row sm:px-6">
        <Logo className="text-xl" />
        <p>Feito por estudantes, para estudantes. Licença AGPL-3.0.</p>
        <SiteFooterLinks />
      </footer>
    </div>
  );
}
