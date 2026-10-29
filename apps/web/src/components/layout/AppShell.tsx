import { Link, Outlet, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  BookOpenCheck,
  CalendarCheck,
  ClipboardList,
  LogIn,
  LogOut,
  PenLine,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { signOut, useSession } from '@/lib/auth-client';
import { meQuery } from '@/lib/queries';
import { cn } from '@/lib/cn';
import { buttonClasses } from '@/components/ui';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';

interface NavItem {
  to: '/questoes' | '/simulados' | '/redacao' | '/desempenho' | '/plano' | '/admin/revisao';
  label: string;
  icon: LucideIcon;
}

const NAV: NavItem[] = [
  { to: '/questoes', label: 'Questões', icon: BookOpenCheck },
  { to: '/simulados', label: 'Simulados', icon: ClipboardList },
  { to: '/redacao', label: 'Redação', icon: PenLine },
  { to: '/desempenho', label: 'Desempenho', icon: BarChart3 },
  { to: '/plano', label: 'Plano', icon: CalendarCheck },
];
const ADMIN_NAV: NavItem = { to: '/admin/revisao', label: 'Revisão', icon: ShieldCheck };

export function AppShell() {
  const { data: session } = useSession();
  const { data: me } = useQuery({ ...meQuery, enabled: Boolean(session) });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canReview = me?.role === 'admin' || me?.role === 'reviewer';
  const items = canReview ? [...NAV, ADMIN_NAV] : NAV;

  async function handleSignOut() {
    await signOut();
    qc.clear();
    await navigate({ to: '/' });
  }

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[17rem_1fr]">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r-2 border-line bg-surface p-5 md:flex">
        <Logo />
        <nav aria-label="Principal" className="flex flex-1 flex-col gap-1.5">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-3 rounded-xl border-2 border-transparent px-3 py-2.5 font-semibold hover:bg-surface-2"
              activeProps={{
                className:
                  'border-line bg-highlight text-[#14213d] shadow-hard-sm hover:bg-highlight',
              }}
            >
              <item.icon className="size-5" aria-hidden />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center justify-between gap-2">
          {session ? (
            <button
              type="button"
              onClick={handleSignOut}
              className={cn(buttonClasses('secondary', 'sm'), 'flex-1')}
            >
              <LogOut className="size-4" aria-hidden /> Sair
            </button>
          ) : (
            <Link to="/entrar" className={cn(buttonClasses('primary', 'sm'), 'flex-1')}>
              <LogIn className="size-4" aria-hidden /> Entrar
            </Link>
          )}
          <ThemeToggle />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Topbar (mobile) */}
        <header className="sticky top-0 z-20 flex items-center justify-between border-b-2 border-line bg-surface px-4 py-3 md:hidden">
          <Logo className="text-xl" />
          <div className="flex items-center gap-2">
            <ThemeToggle className="size-9" />
            {session ? (
              <button
                type="button"
                onClick={handleSignOut}
                aria-label="Sair"
                className="grid size-9 place-items-center rounded-xl border-2 border-line bg-surface shadow-hard-sm"
              >
                <LogOut className="size-4" />
              </button>
            ) : (
              <Link to="/entrar" className={buttonClasses('primary', 'sm')}>
                Entrar
              </Link>
            )}
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-28 sm:px-6 md:py-10 md:pb-10">
          <Outlet />
        </main>
      </div>

      {/* Bottom nav (mobile) */}
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-30 grid border-t-2 border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex flex-col items-center gap-0.5 px-1 py-2 text-[0.7rem] font-semibold text-muted"
            activeProps={{ className: 'text-ink [&>span]:bg-highlight [&>span]:text-[#14213d]' }}
          >
            <span className="grid h-7 w-12 place-items-center rounded-full transition-colors">
              <item.icon className="size-5" aria-hidden />
            </span>
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
