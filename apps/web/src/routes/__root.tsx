import { Link, Outlet, createRootRouteWithContext } from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';
import { buttonClasses } from '@/components/ui';

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: () => <Outlet />,
  notFoundComponent: () => (
    <div className="grid min-h-dvh place-items-center px-4 text-center">
      <div className="flex flex-col items-center gap-4">
        <p className="font-display text-8xl font-extrabold text-accent-strong">404</p>
        <h1 className="text-3xl">Página não encontrada</h1>
        <Link to="/" className={buttonClasses('primary')}>
          Voltar ao início
        </Link>
      </div>
    </div>
  ),
});
